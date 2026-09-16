// Minimal headless Chromium/Edge driver over the Chrome DevTools Protocol.
// It uses only Node built-ins (child_process, fs, WebSocket), so the tests need no browser automation dependency.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

function onPath(command) {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(finder, [command], { encoding: 'utf8' });
  if (result.status !== 0) return undefined;
  return result.stdout.split(/\r?\n/).find(Boolean);
}

/** Finds a Chromium-based browser: ZENWAVE_TEST_BROWSER or CHROME_PATH first, then standard install locations. */
export function findBrowser() {
  for (const variable of ['ZENWAVE_TEST_BROWSER', 'CHROME_PATH']) {
    const value = process.env[variable];
    if (value && existsSync(value)) return value;
  }

  const candidates = [];
  if (process.platform === 'win32') {
    for (const base of [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA]) {
      if (!base) continue;
      candidates.push(
        path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      );
    }
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    );
  } else {
    for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      const found = onPath(command);
      if (found) candidates.push(found);
    }
  }

  return candidates.find((candidate) => existsSync(candidate));
}

class CdpConnection {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.socket = new WebSocket(url);
    this.opened = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', () => resolve());
      this.socket.addEventListener('error', (event) => reject(new Error(`CDP connection failed: ${event.message ?? event}`)));
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const waiter = this.pending.get(message.id);
        if (!waiter) return;
        this.pending.delete(message.id);
        if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
        else waiter.resolve(message.result);
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify(payload));
    });
  }

  close() {
    this.socket.close();
  }
}

/** A browser tab. Records network requests, console errors, exceptions and CSP violations reported by the browser. */
export class Page {
  constructor(connection, sessionId) {
    this.connection = connection;
    this.sessionId = sessionId;
    this.requests = [];
    this.failedRequests = [];
    this.exceptions = [];
    this.logEntries = [];
    connection.listeners.add((message) => {
      if (message.sessionId !== sessionId) return;
      const { method, params } = message;
      if (method === 'Network.requestWillBeSent') this.requests.push(params.request.url);
      if (method === 'Network.loadingFailed') this.failedRequests.push(params);
      if (method === 'Network.responseReceived' && params.response.status >= 400) {
        this.failedRequests.push({ url: params.response.url, status: params.response.status });
      }
      if (method === 'Runtime.exceptionThrown') this.exceptions.push(params.exceptionDetails);
      if (method === 'Log.entryAdded') this.logEntries.push(params.entry);
      if (method === 'Runtime.consoleAPICalled' && (params.type === 'error' || params.type === 'warning')) {
        this.logEntries.push({
          level: params.type,
          source: 'console-api',
          text: params.args.map((argument) => argument.value ?? argument.description ?? '').join(' '),
        });
      }
    });
  }

  send(method, params) {
    return this.connection.send(method, params, this.sessionId);
  }

  async init() {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
    await this.send('Log.enable');
    await this.send('Network.setCacheDisabled', { cacheDisabled: true });
  }

  /** Runs source in every frame of every document before any page script, like a host-injected preload. */
  addInitScript(source) {
    return this.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }

  async goto(url) {
    await this.send('Page.navigate', { url });
    await this.waitFor(`document.readyState === 'complete' && location.href === ${JSON.stringify(url)}`);
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`Evaluation failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
    }
    return result.result.value;
  }

  /** Evaluates expression in the first child frame (an iframe) of the page. */
  async evaluateInChildFrame(expression) {
    const { frameTree } = await this.send('Page.getFrameTree');
    const child = frameTree.childFrames?.[0];
    if (!child) throw new Error('The page has no child frame');
    const { executionContextId } = await this.send('Page.createIsolatedWorld', {
      frameId: child.frame.id,
      worldName: 'zenwave-test',
    });
    const result = await this.send('Runtime.evaluate', {
      expression,
      contextId: executionContextId,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(`Evaluation failed: ${result.exceptionDetails.text}`);
    return result.result.value;
  }

  async waitFor(expression, { timeout = 15000, frame = 'main' } = {}) {
    const deadline = Date.now() + timeout;
    let lastError;
    while (Date.now() < deadline) {
      try {
        const value = frame === 'child'
          ? await this.evaluateInChildFrame(expression)
          : await this.evaluate(expression);
        if (value) return value;
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for: ${expression}${lastError ? ` (last error: ${lastError.message})` : ''}`);
  }

  cspViolations() {
    return this.logEntries.filter((entry) => /content security policy/i.test(entry.text ?? ''));
  }
}

/** Launches a headless browser with a throwaway profile. */
export async function launchBrowser(executable) {
  const profile = mkdtempSync(path.join(tmpdir(), 'zenwave-webview-test-'));
  const argumentsList = [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--disable-features=Translate,OptimizationHints,MediaRouter',
    'about:blank',
  ];
  if (process.platform === 'linux') argumentsList.unshift('--no-sandbox');

  const child = spawn(executable, argumentsList, { stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Browser did not start: ${output}`)), 30000);
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Browser exited with ${code}: ${output}`));
    });
  });

  const connection = new CdpConnection(endpoint);
  await connection.opened;

  return {
    async newPage() {
      const { targetId } = await connection.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await connection.send('Target.attachToTarget', { targetId, flatten: true });
      const page = new Page(connection, sessionId);
      page.targetId = targetId;
      await page.init();
      return page;
    },
    async closePage(page) {
      await connection.send('Target.closeTarget', { targetId: page.targetId });
    },
    async close() {
      try {
        await connection.send('Browser.close');
      } catch {
        // The browser may already be gone.
      }
      connection.close();
      await new Promise((resolve) => {
        if (child.exitCode !== null) resolve();
        else {
          child.once('exit', resolve);
          setTimeout(() => {
            child.kill();
            resolve();
          }, 5000);
        }
      });
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        // A locked profile directory on Windows is not a test failure.
      }
    },
  };
}
