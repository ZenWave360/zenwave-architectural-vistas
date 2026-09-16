// Loads the packaged webview in a headless Chromium-based browser, the way each kind of host embeds it.
//
// Every scenario fails on an uncaught exception, a content security policy violation, a request to anything other
// than the local test server, or a failed request.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { EVENTFLOW_WEBVIEW_PROTOCOL, EVENTFLOW_WEBVIEW_PROTOCOL_VERSION } from '../index.js';
import { findBrowser, launchBrowser } from './support/browser.mjs';
import { startServer } from './support/server.mjs';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const webviewDirectory = path.join(packageDirectory, 'webview');
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

// Responses of zenwave/eventFlowViews from zenwave-lsp (lsp-js and lsp-jvm) for the same ZFL document.
const SAMPLES = {
  'lsp-js': fixture('eventFlowViews.lsp-js.json'),
  'lsp-jvm': fixture('eventFlowViews.lsp-jvm.json'),
};

const expectedReady = {
  type: 'webviewReady',
  payload: { protocol: EVENTFLOW_WEBVIEW_PROTOCOL, protocolVersion: EVENTFLOW_WEBVIEW_PROTOCOL_VERSION },
};

const executable = findBrowser();
const requireBrowser = Boolean(process.env.CI) || process.env.ZENWAVE_REQUIRE_BROWSER === 'true';
const skip = executable
  ? false
  : 'no Chromium-based browser found; set ZENWAVE_TEST_BROWSER to run the webview browser tests';
if (!executable && requireBrowser) {
  throw new Error('No Chromium-based browser found, and CI requires the webview browser tests. Set ZENWAVE_TEST_BROWSER.');
}

// Records CSP violations the page itself observes, in addition to what the browser logs.
const RECORD_VIOLATIONS = `
  window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation', (event) => {
    window.__cspViolations.push(event.violatedDirective + ' ' + event.blockedURI);
  });
`;

// A stand-in for the object VS Code injects into a webview: acquireVsCodeApi works once and throws after that.
const FAKE_VSCODE_API = `
  window.__vscodeMessages = [];
  window.__acquireCalls = 0;
  window.acquireVsCodeApi = function () {
    window.__acquireCalls += 1;
    if (window.__acquireCalls > 1) throw new Error('An instance of the VS Code API has already been acquired');
    return {
      postMessage: (message) => window.__vscodeMessages.push(message),
      getState: () => undefined,
      setState: () => undefined,
    };
  };
`;

// Sends renderBundle as early as a script can: before the page's own module has run or React has mounted.
const renderBundleEarly = (payload) => `
  document.addEventListener('DOMContentLoaded', () => {
    window.postMessage(${JSON.stringify({ type: 'renderBundle', payload })}, '*');
  }, { once: true });
`;

const nodeSelector = (id) => `.react-flow__node[data-id=${JSON.stringify(id)}]`;
const flowRendered = (bundle) =>
  `${JSON.stringify(bundle.flowGraph.nodes.map((node) => node.id))}.every((id) => document.querySelector('.react-flow__node[data-id="' + CSS.escape(id) + '"]'))`;
const serviceRendered = (bundle) =>
  `${JSON.stringify(bundle.serviceGraph.nodes.map((node) => node.id))}.every((id) => document.querySelector('.react-flow__node[data-id="' + CSS.escape(id) + '"]'))`;

describe('packaged EventFlow webview in a browser', { skip }, () => {
  let server;
  let browser;

  before(async () => {
    server = await startServer(webviewDirectory);
    browser = await launchBrowser(executable);
  });

  after(async () => {
    await browser?.close();
    await server?.close();
  });

  async function openPage(initScripts) {
    const page = await browser.newPage();
    await page.addInitScript(RECORD_VIOLATIONS);
    for (const script of initScripts) await page.addInitScript(script);
    return page;
  }

  async function assertClean(page, { allowFavicon = true } = {}) {
    assert.deepEqual(page.exceptions.map((exception) => exception.exception?.description ?? exception.text), []);
    assert.deepEqual(page.cspViolations().map((entry) => entry.text), []);
    const observed = await page.evaluate('window.__cspViolations').catch(() => []);
    assert.deepEqual(observed ?? [], []);
    const remote = page.requests.filter(
      (url) => !server.localOrigins.some((origin) => url.startsWith(`${origin}/`))
        && !/^(data|blob|about):/.test(url),
    );
    assert.deepEqual(remote, [], 'no request leaves the local host');
    const failed = page.failedRequests.filter((failure) => !(allowFavicon && /favicon\.ico$/.test(failure.url ?? '')));
    assert.deepEqual(failed, []);
    const errors = page.logEntries.filter((entry) => entry.level === 'error');
    assert.deepEqual(errors.map((entry) => entry.text), []);
  }

  for (const [source, bundle] of Object.entries(SAMPLES)) {
    test(`VS Code-like host: renders the ${source} sample under a strict CSP and drives it by message`, async () => {
      const page = await openPage([
        FAKE_VSCODE_API,
        renderBundleEarly({ ...bundle, viewMode: 'flow', displaySettings: { humanizeLabels: true } }),
      ]);
      try {
        await page.goto(`${server.origin}/webview/index.html`);
        await page.waitFor(flowRendered(bundle));

        // Readiness went through the VS Code API, acquired exactly once, and carries the protocol version.
        await page.waitFor('window.__vscodeMessages.length > 0');
        assert.deepEqual(await page.evaluate('window.__vscodeMessages'), [expectedReady]);
        assert.equal(await page.evaluate('window.__acquireCalls'), 1);
        assert.equal(await page.evaluate('window.__zenwaveVsCodeApi !== undefined'), true);

        // Humanised labels are on, then turned off without resending the model.
        const startNode = nodeSelector('event:CheckoutStarted');
        await page.waitFor(`document.querySelector(${JSON.stringify(startNode)}).innerText.includes('Checkout Started')`);
        await page.evaluate(`window.postMessage({ type: 'setDisplaySettings', payload: { displaySettings: { humanizeLabels: false } } }, '*')`);
        await page.waitFor(`document.querySelector(${JSON.stringify(startNode)}).innerText.includes('CheckoutStarted')`);

        // Highlight a node by its view node id, then clear it.
        const highlighted = `${nodeSelector('command:createOrder')} .eventflow-node-highlighted, ${nodeSelector('command:createOrder')}.eventflow-node-highlighted`;
        await page.evaluate(`window.postMessage({ type: 'highlightNode', payload: { nodeId: 'command:createOrder' } }, '*')`);
        await page.waitFor(`document.querySelector(${JSON.stringify(highlighted)}) !== null`);
        await page.evaluate(`window.postMessage({ type: 'highlightNode', payload: { nodeId: null } }, '*')`);
        await page.waitFor(`document.querySelector('.eventflow-node-highlighted') === null`);

        // Unknown and malformed messages are ignored.
        await page.evaluate(`window.postMessage({ type: 'fromTheFuture', payload: {} }, '*'); window.postMessage('noise', '*'); window.postMessage(null, '*')`);

        // Switch to the service map for the model the page already has.
        await page.evaluate(`window.postMessage({ type: 'setViewMode', payload: { viewMode: 'services' } }, '*')`);
        await page.waitFor(serviceRendered(bundle));

        // Replace the model.
        await page.evaluate(`window.postMessage({ type: 'renderBundle', payload: { flowGraph: null, serviceGraph: null, viewMode: 'flow' } }, '*')`);
        await page.waitFor(`document.body.innerText.includes('Waiting for graph data from host')`);

        await assertClean(page);
      } finally {
        await browser.closePage(page);
      }
    });
  }

  test('VS Code-like host: a host script that acquired the API first shares it through window.__zenwaveVsCodeApi', async () => {
    const page = await openPage([
      FAKE_VSCODE_API,
      `window.__zenwaveVsCodeApi = window.acquireVsCodeApi();`,
    ]);
    try {
      await page.goto(`${server.origin}/webview/index.html`);
      await page.waitFor('window.__vscodeMessages.length > 0');
      assert.deepEqual(await page.evaluate('window.__vscodeMessages'), [expectedReady]);
      assert.equal(await page.evaluate('window.__acquireCalls'), 1, 'the page does not acquire the API a second time');
      await assertClean(page);
    } finally {
      await browser.closePage(page);
    }
  });

  test('a host-injected window.__zenwaveHost channel is preferred over the VS Code API and the parent frame', async () => {
    const page = await openPage([
      FAKE_VSCODE_API,
      `window.__hostMessages = []; window.__zenwaveHost = { postMessage: (message) => window.__hostMessages.push(message) };`,
    ]);
    try {
      await page.goto(`${server.origin}/webview/index.html`);
      await page.waitFor('window.__hostMessages.length > 0');
      assert.deepEqual(await page.evaluate('window.__hostMessages'), [expectedReady]);
      assert.equal(await page.evaluate('window.__acquireCalls'), 0);
      assert.deepEqual(await page.evaluate('window.__vscodeMessages'), []);
      await assertClean(page);
    } finally {
      await browser.closePage(page);
    }
  });

  test('VS Code-like host: asset URLs rewritten to another origin load under a CSP naming that origin', async () => {
    const bundle = SAMPLES['lsp-js'];
    const page = await openPage([FAKE_VSCODE_API, renderBundleEarly({ ...bundle, viewMode: 'flow' })]);
    try {
      await page.goto(`${server.origin}/rewritten/index.html`);
      await page.waitFor(flowRendered(bundle));
      await page.waitFor('window.__vscodeMessages.length > 0');
      assert.deepEqual(await page.evaluate('window.__vscodeMessages'), [expectedReady]);
      assert.ok(page.requests.some((url) => url.startsWith(`http://localhost:${server.port}/webview/assets/`)));
      await assertClean(page);
    } finally {
      await browser.closePage(page);
    }
  });

  test('iframe host: readiness reaches the parent frame, and the parent can render into the page', async () => {
    const bundle = SAMPLES['lsp-jvm'];
    const page = await openPage([]);
    try {
      await page.goto(`${server.origin}/host/parent.html`);
      await page.waitFor('window.__received.some((entry) => entry.data && entry.data.type === "webviewReady")');
      const received = await page.evaluate('window.__received');
      assert.deepEqual(received, [{ data: expectedReady, fromWebview: true }]);

      await page.evaluate(`document.getElementById('webview').contentWindow.postMessage(${JSON.stringify({
        type: 'renderBundle',
        payload: { ...bundle, viewMode: 'flow' },
      })}, '*')`);
      await page.waitFor(flowRendered(bundle), { frame: 'child' });
      await assertClean(page);
    } finally {
      await browser.closePage(page);
    }
  });

  test('IntelliJ JCEF-like host: top frame, only index.html-registered assets, renderBundle after load', async () => {
    const bundle = SAMPLES['lsp-jvm'];
    // Record any readiness message the page posts to itself. JCEF does not listen for it; the page must not fail.
    const page = await openPage([`
      window.__selfPosted = [];
      const originalPostMessage = window.postMessage.bind(window);
      window.postMessage = (message, ...rest) => { window.__selfPosted.push(message); return originalPostMessage(message, ...rest); };
    `]);
    try {
      await page.goto(`${server.origin}/jcef/index.html`);
      // ZflJcefDiagramHost sends on CEF onLoadEnd through executeJavaScript, which is what evaluate does here.
      await page.evaluate(`(function () {
        const bundle = JSON.parse(${JSON.stringify(JSON.stringify(bundle))});
        window.postMessage({ type: 'renderBundle', payload: {
          flowGraph: bundle.flowGraph, serviceGraph: bundle.serviceGraph, viewMode: 'flow',
          displaySettings: { humanizeLabels: true } } }, '*');
      })()`);
      await page.waitFor(flowRendered(bundle));
      await page.evaluate(`window.postMessage({ type: 'setViewMode', payload: { viewMode: 'services' } }, '*')`);
      await page.waitFor(serviceRendered(bundle));

      const selfPosted = await page.evaluate('window.__selfPosted.map((message) => message && message.type)');
      assert.ok(!selfPosted.includes('webviewReady'), 'a top-level page with no host channel addresses nobody');
      assert.equal(await page.evaluate('window.__zenwaveVsCodeApi === undefined'), true);
      await assertClean(page);
    } finally {
      await browser.closePage(page);
    }
  });
});
