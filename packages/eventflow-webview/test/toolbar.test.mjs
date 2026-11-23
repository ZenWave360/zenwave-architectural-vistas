// Loads the page with a view selector (webview-toolbar/) and the minimal page (webview/) in a headless browser, the
// way VS Code and IntelliJ embed them. The selector reports only the user's own choice, as viewModeChanged.
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
const bundle = JSON.parse(readFileSync(new URL('./fixtures/eventFlowViews.lsp-js.json', import.meta.url), 'utf8'));

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

const RECORD_VIOLATIONS = `
  window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation', (event) => {
    window.__cspViolations.push(event.violatedDirective + ' ' + event.blockedURI);
  });
`;

const FAKE_VSCODE_API = `
  window.__vscodeMessages = [];
  window.acquireVsCodeApi = function () {
    return { postMessage: (message) => window.__vscodeMessages.push(message), getState: () => undefined, setState: () => undefined };
  };
`;

const rendered = (nodes) =>
  `${JSON.stringify(nodes.map((node) => node.id))}.every((id) => document.querySelector('.react-flow__node[data-id="' + CSS.escape(id) + '"]'))`;
const flowRendered = rendered(bundle.flowGraph.nodes);
const serviceRendered = rendered(bundle.serviceGraph.nodes);

const post = (message) => `window.postMessage(${JSON.stringify(message)}, '*')`;
const selected = `(document.querySelector('.view-selector input:checked') || {}).value`;

function flowNode(id, type, x, y) {
  return {
    id,
    type,
    label: id,
    system: null,
    service: null,
    sourceRef: { file: '<zfl>', line: 1, column: 1 },
    position: { x, y },
    dimensions: { width: 180, height: 112 },
  };
}

function flowGraph(nodes) {
  return { schema: 'zfl.eventflow.view@1', nodes, edges: [], layout: null, bounds: null, systemGroups: null };
}

// Where a node sits in the diagram pane. Null until both are on the page and the pane has a size.
const placed = (startId, otherId) => `(() => {
  const pane = document.querySelector('.react-flow');
  const start = document.querySelector('.react-flow__node[data-id=${JSON.stringify(startId)}]');
  const other = document.querySelector('.react-flow__node[data-id=${JSON.stringify(otherId)}]');
  if (!pane || !start || !other) return null;
  const paneBox = pane.getBoundingClientRect();
  const startBox = start.getBoundingClientRect();
  const otherBox = other.getBoundingClientRect();
  if (paneBox.width < 200 || paneBox.height < 200) return null;
  return {
    inset: startBox.left - paneBox.left,
    paneWidth: paneBox.width,
    paneHeight: paneBox.height,
    vertical: Math.abs((startBox.top + startBox.bottom) / 2 - (paneBox.top + paneBox.bottom) / 2),
    otherRight: otherBox.right - paneBox.left,
    otherLeft: otherBox.left - paneBox.left,
    startRight: startBox.right - paneBox.left,
  };
})()`;
const choose = (value) => `document.querySelector('.view-selector input[value=${JSON.stringify(value)}]').click()`;
const sent = `window.__vscodeMessages.filter((message) => message.type === 'viewModeChanged')`;

describe('EventFlow pages with and without a view selector', { skip }, () => {
  let toolbarServer;
  let minimalServer;
  let browser;

  before(async () => {
    toolbarServer = await startServer(path.join(packageDirectory, 'webview-toolbar'));
    minimalServer = await startServer(path.join(packageDirectory, 'webview'));
    browser = await launchBrowser(executable);
  });

  after(async () => {
    await browser?.close();
    await toolbarServer?.close();
    await minimalServer?.close();
  });

  async function openPage(initScripts = [FAKE_VSCODE_API]) {
    const page = await browser.newPage();
    await page.addInitScript(RECORD_VIOLATIONS);
    for (const script of initScripts) await page.addInitScript(script);
    return page;
  }

  async function assertClean(page, server) {
    assert.deepEqual(page.exceptions.map((exception) => exception.exception?.description ?? exception.text), []);
    assert.deepEqual(page.cspViolations().map((entry) => entry.text), []);
    assert.deepEqual((await page.evaluate('window.__cspViolations').catch(() => [])) ?? [], []);
    const remote = page.requests.filter(
      (url) => !server.localOrigins.some((origin) => url.startsWith(`${origin}/`)) && !/^(data|blob|about):/.test(url),
    );
    assert.deepEqual(remote, [], 'no request leaves the local host');
    assert.deepEqual(page.failedRequests.filter((failure) => !/favicon\.ico$/.test(failure.url ?? '')), []);
    assert.deepEqual(page.logEntries.filter((entry) => entry.level === 'error').map((entry) => entry.text), []);
  }

  test('toolbar page: renders under a strict CSP, offers Flow and Systems, and the selector shows the current view', async () => {
    const page = await openPage();
    try {
      await page.goto(`${toolbarServer.origin}/webview/index.html`);
      // The selector is usable while a view has no model: the waiting state shows next to it.
      await page.waitFor(`document.body.innerText.includes('Waiting for graph data from host')`);
      assert.equal(await page.evaluate(selected), 'flow');
      assert.deepEqual(
        await page.evaluate(`[...document.querySelectorAll('.view-selector label')].map((label) => label.innerText.trim())`),
        ['Flow', 'Systems'],
      );
      assert.equal(await page.evaluate(`document.querySelector('.view-selector').getAttribute('role')`), 'radiogroup');
      assert.deepEqual(await page.evaluate('window.__vscodeMessages'), [expectedReady]);

      await page.evaluate(post({ type: 'renderBundle', payload: { ...bundle, viewMode: 'flow' } }));
      await page.waitFor(flowRendered);
      // Zoom and fit come from the visualizer, not from the page.
      assert.equal(await page.evaluate(`document.querySelector('.react-flow__controls') !== null`), true);
      assert.equal(await page.evaluate(`document.querySelectorAll('.view-selector button').length`), 0);
      await assertClean(page, toolbarServer);
    } finally {
      await browser.closePage(page);
    }
  });

  test('toolbar page: choosing a view in the selector switches the diagram and sends exactly one viewModeChanged', async () => {
    const page = await openPage();
    try {
      await page.goto(`${toolbarServer.origin}/webview/index.html`);
      await page.evaluate(post({ type: 'renderBundle', payload: { ...bundle, viewMode: 'flow' } }));
      await page.waitFor(flowRendered);
      assert.deepEqual(await page.evaluate(sent), [], 'a renderBundle is not reported back');

      await page.evaluate(choose('services'));
      await page.waitFor(serviceRendered);
      assert.equal(await page.evaluate(selected), 'services');
      assert.deepEqual(await page.evaluate(sent), [{ type: 'viewModeChanged', payload: { viewMode: 'services' } }]);

      // Choosing the view that is already shown is not a change.
      await page.evaluate(choose('services'));
      assert.equal((await page.evaluate(sent)).length, 1);

      await page.evaluate(choose('flow'));
      await page.waitFor(flowRendered);
      assert.deepEqual(await page.evaluate(sent), [
        { type: 'viewModeChanged', payload: { viewMode: 'services' } },
        { type: 'viewModeChanged', payload: { viewMode: 'flow' } },
      ]);
      await assertClean(page, toolbarServer);
    } finally {
      await browser.closePage(page);
    }
  });

  test('toolbar page: a host setViewMode or renderBundle moves the selector and sends no viewModeChanged', async () => {
    const page = await openPage();
    try {
      await page.goto(`${toolbarServer.origin}/webview/index.html`);
      await page.evaluate(post({ type: 'renderBundle', payload: { ...bundle, viewMode: 'flow' } }));
      await page.waitFor(flowRendered);

      await page.evaluate(post({ type: 'setViewMode', payload: { viewMode: 'services' } }));
      await page.waitFor(serviceRendered);
      await page.waitFor(`${selected} === 'services'`);

      await page.evaluate(post({ type: 'renderBundle', payload: { ...bundle, viewMode: 'flow' } }));
      await page.waitFor(`${selected} === 'flow'`);
      await page.waitFor(flowRendered);

      // A view with no model still shows the selector and the waiting state.
      await page.evaluate(post({ type: 'renderBundle', payload: { flowGraph: bundle.flowGraph, serviceGraph: null, viewMode: 'services' } }));
      await page.waitFor(`document.body.innerText.includes('Waiting for services view data from host')`);
      assert.equal(await page.evaluate(selected), 'services');

      assert.deepEqual(await page.evaluate(sent), []);
      await assertClean(page, toolbarServer);
    } finally {
      await browser.closePage(page);
    }
  });

  test('toolbar page: the selector is made of focusable native radio inputs', async () => {
    const page = await openPage();
    try {
      await page.goto(`${toolbarServer.origin}/webview/index.html`);
      assert.equal(await page.evaluate(`document.querySelectorAll('.view-selector input[type=radio]').length`), 2);
      assert.equal(
        await page.evaluate(`(() => { const input = document.querySelector('.view-selector input:checked'); input.focus(); return document.activeElement === input && input.tabIndex >= 0; })()`),
        true,
      );
    } finally {
      await browser.closePage(page);
    }
  });

  test('toolbar page: the controls sit on the right, with room beside them', async () => {
    const page = await openPage();
    try {
      await page.goto(`${toolbarServer.origin}/webview/index.html`);
      await page.waitFor(`document.querySelector('.eventflow-toolbar') !== null && document.querySelector('.view-selector') !== null`);
      const box = await page.evaluate(`(() => {
        const bar = document.querySelector('.eventflow-toolbar').getBoundingClientRect();
        const selector = document.querySelector('.view-selector').getBoundingClientRect();
        return {
          barWidth: bar.width,
          spaceOnTheLeft: selector.left - bar.left,
          spaceOnTheRight: bar.right - selector.right,
        };
      })()`);
      assert.ok(box.barWidth > box.spaceOnTheLeft, `toolbar width ${box.barWidth}`);
      assert.ok(box.spaceOnTheLeft > box.spaceOnTheRight + 40, `room on the left ${box.spaceOnTheLeft}, on the right ${box.spaceOnTheRight}`);
      assert.ok(box.spaceOnTheRight < 24, `selector inset from the right ${box.spaceOnTheRight}`);
      await assertClean(page, toolbarServer);
    } finally {
      await browser.closePage(page);
    }
  });

  test('toolbar page: a flow opens on its first start, and an update of that diagram does not move the view', async () => {
    const page = await openPage();
    try {
      await page.goto(`${toolbarServer.origin}/webview/index.html`);
      // The first start is the right-hand one. The diagram is far too wide to fit at the minimum zoom.
      const first = flowNode('event:LaterStart', 'START', 40000, 400);
      const leftmost = flowNode('event:LeftStart', 'START', 0, 400);
      await page.evaluate(post({
        type: 'renderBundle',
        payload: {
          flowGraph: flowGraph([first, leftmost]),
          serviceGraph: null,
          viewMode: 'flow',
          diagramId: 'file:///flows/one.zfl#Checkout',
        },
      }));
      await page.waitFor(`${placed('event:LaterStart', 'event:LeftStart')}?.inset < 80`);
      const opened = await page.evaluate(placed('event:LaterStart', 'event:LeftStart'));
      assert.ok(opened.inset < opened.paneWidth * 0.15, `first start inset ${opened.inset} of ${opened.paneWidth}`);
      assert.ok(opened.vertical < 40, `first start is ${opened.vertical}px from the vertical centre`);
      assert.ok(opened.otherRight < 0, `the later, leftmost start is still in view at ${opened.otherRight}`);

      // Same diagram, new positions: the user's viewport stays, so the moved start leaves the pane.
      const moved = flowNode('event:LaterStart', 'START', 20000, 400);
      await page.evaluate(post({
        type: 'renderBundle',
        payload: {
          flowGraph: flowGraph([moved, leftmost]),
          serviceGraph: null,
          viewMode: 'flow',
          diagramId: 'file:///flows/one.zfl#Checkout',
        },
      }));
      await page.waitFor(`(document.querySelector('.react-flow__node[data-id="event:LaterStart"]') || {}).style.transform.includes('20000')`);
      const afterUpdate = await page.evaluate(placed('event:LaterStart', 'event:LeftStart'));
      assert.ok(afterUpdate.startRight < 0, `update put the start back on screen at ${afterUpdate.startRight}`);

      // A different diagram, named by diagramId, opens on its own first start.
      await page.evaluate(post({
        type: 'renderBundle',
        payload: {
          flowGraph: flowGraph([
            flowNode('event:OtherStart', 'START', 0, 400),
            flowNode('command:OtherFar', 'COMMAND', 50000, 400),
          ]),
          serviceGraph: null,
          viewMode: 'flow',
          diagramId: 'file:///flows/other.zfl#Checkout',
        },
      }));
      await page.waitFor(`${placed('event:OtherStart', 'command:OtherFar')}?.inset < 80`);
      const nextDiagram = await page.evaluate(placed('event:OtherStart', 'command:OtherFar'));
      assert.ok(nextDiagram.inset < nextDiagram.paneWidth * 0.15, `new diagram inset ${nextDiagram.inset}`);
      assert.ok(nextDiagram.otherLeft > nextDiagram.paneWidth, `the far node is in view at ${nextDiagram.otherLeft}`);
      await assertClean(page, toolbarServer);
    } finally {
      await browser.closePage(page);
    }
  });

  test('minimal page: has no selector, and never sends viewModeChanged', async () => {
    const page = await openPage();
    try {
      await page.goto(`${minimalServer.origin}/webview/index.html`);
      await page.evaluate(post({ type: 'renderBundle', payload: { ...bundle, viewMode: 'flow' } }));
      await page.waitFor(flowRendered);
      await page.evaluate(post({ type: 'setViewMode', payload: { viewMode: 'services' } }));
      await page.waitFor(serviceRendered);
      assert.equal(await page.evaluate(`document.querySelector('.view-selector, input[type=radio], select') === null`), true);
      assert.deepEqual(await page.evaluate('window.__vscodeMessages'), [expectedReady]);
      await assertClean(page, minimalServer);
    } finally {
      await browser.closePage(page);
    }
  });
});
