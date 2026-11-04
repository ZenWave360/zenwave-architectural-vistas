// Save positions on the toolbar page (EF-R14): the control follows a drag in the full diagram, posts every node,
// and the minimal page has neither control nor note. The note for a saved layout that did not match comes with the bundle.
import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { EVENTFLOW_WEBVIEW_PROTOCOL, EVENTFLOW_WEBVIEW_PROTOCOL_VERSION } from '../index.js';
import { findBrowser, launchBrowser } from './support/browser.mjs';
import { startServer } from './support/server.mjs';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const diagramId = 'file:///flows/checkout.zfl#Checkout';
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

const FAKE_VSCODE_API = `
  window.__vscodeMessages = [];
  window.acquireVsCodeApi = function () {
    return { postMessage: (message) => window.__vscodeMessages.push(message), getState: () => undefined, setState: () => undefined };
  };
`;

const variants = [{ id: 'OrderCancelled', title: 'Order Cancelled' }];
function flowNode(id, type, x, y = 80) {
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

const fullNodes = [flowNode('event:Start', 'START', 40), flowNode('command:PlaceOrder', 'COMMAND', 320)];
const variantNodes = [flowNode('event:Start', 'START', 40), flowNode('command:CancelOrder', 'COMMAND', 640)];

const post = (message) => `window.postMessage(${JSON.stringify(message)}, '*')`;
const bundle = (payload) => ({
  type: 'renderBundle',
  payload: { flowGraph: flowGraph(fullNodes), serviceGraph: null, viewMode: 'flow', diagramId, ...payload },
});
const hasNode = (id) => `document.querySelector('.react-flow__node[data-id=${JSON.stringify(id)}]') !== null`;
const nodeTransform = (id) => `(document.querySelector('.react-flow__node[data-id=${JSON.stringify(id)}]') || {}).style.transform || ''`;
const saveButton = `document.querySelector('.save-positions')`;
const saveMessages = `window.__vscodeMessages.filter((message) => message.type === 'savePositions')`;
const note = `(document.querySelector('.saved-positions-note') || {}).textContent || null`;
const frames = `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))`;

// The opening zoom runs after the first bundle; a drag before it ends would miss the node.
async function settled(page) {
  let last = '';
  for (let i = 0; i < 40; i += 1) {
    const now = await page.evaluate(`document.querySelector('.react-flow__viewport').style.transform`);
    if (now === last) return;
    last = now;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

describe('EventFlow save positions', { skip }, () => {
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

  async function openPage(server) {
    const page = await browser.newPage();
    await page.addInitScript(FAKE_VSCODE_API);
    await page.goto(`${server.origin}/webview/index.html`);
    await page.waitFor(`typeof window.renderBundle === 'function'`);
    return page;
  }

  async function dragNode(page, id, dx, dy) {
    const start = await page.evaluate(`(() => {
      const node = document.querySelector('.react-flow__node[data-id=${JSON.stringify(id)}]');
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return {
        x: box.left + box.width / 2,
        y: box.top + box.height / 2,
        transform: node.style.transform,
        width: box.width,
        height: box.height,
      };
    })()`);
    assert.ok(start && start.width > 20 && start.height > 20, `node ${id} is not on screen`);
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: start.x, y: start.y, button: 'left', buttons: 1, clickCount: 1 });
    for (let step = 1; step <= 6; step += 1) {
      await page.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: start.x + (dx * step) / 6,
        y: start.y + (dy * step) / 6,
        button: 'left',
        buttons: 1,
      });
    }
    await page.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: start.x + dx,
      y: start.y + dy,
      button: 'left',
      buttons: 0,
      clickCount: 1,
    });
    await page.evaluate(frames);
    return start.transform;
  }

  test('toolbar page: the control appears after a drag, posts every node rounded, and hides until the next move', async () => {
    const page = await openPage(toolbarServer);
    try {
      await page.evaluate(post(bundle({})));
      await page.waitFor(hasNode('command:PlaceOrder'));
      assert.equal(await page.evaluate(`${saveButton} === null`), true);
      await settled(page);

      await dragNode(page, 'event:Start', 140, 30);
      await page.waitFor(`${saveButton} !== null`);
      assert.equal(await page.evaluate(`${saveButton}.textContent`), 'Save positions');
      const right = await page.evaluate(`(() => {
        const bar = document.querySelector('.eventflow-toolbar').getBoundingClientRect();
        return bar.right - ${saveButton}.getBoundingClientRect().right;
      })()`);
      assert.ok(right < 24, `control inset ${right}`);
      assert.deepEqual(await page.evaluate(saveMessages), []);

      await page.evaluate(`${saveButton}.click()`);
      const sent = await page.evaluate(saveMessages);
      assert.equal(sent.length, 1);
      const message = sent[0];
      assert.equal(message.type, 'savePositions');
      assert.deepEqual(Object.keys(message.payload), ['positions']);
      assert.deepEqual(Object.keys(message.payload.positions).sort(), ['command:PlaceOrder', 'event:Start']);
      for (const position of Object.values(message.payload.positions)) {
        assert.deepEqual(Object.keys(position).sort(), ['x', 'y']);
        assert.ok(Number.isInteger(position.x) && Number.isInteger(position.y), JSON.stringify(position));
      }
      assert.ok(message.payload.positions['event:Start'].x > 100, 'the dragged node is sent where it now is');
      assert.deepEqual(message.payload.positions['command:PlaceOrder'], { x: 320, y: 80 });

      await page.waitFor(`${saveButton} === null`);
      await dragNode(page, 'command:PlaceOrder', 0, 40);
      await page.waitFor(`${saveButton} !== null`);
      await page.evaluate(post(bundle({})));
      await page.waitFor(`${saveButton} === null`);
      assert.equal((await page.evaluate(saveMessages)).length, 1);
      assert.deepEqual(page.exceptions, []);
    } finally {
      await browser.closePage(page);
    }
  });

  test('toolbar page: no control in a variant, in Systems, or before any move', async () => {
    const page = await openPage(toolbarServer);
    try {
      await page.evaluate(post(bundle({ flowGraph: flowGraph(variantNodes), variants, variant: 'OrderCancelled' })));
      await page.waitFor(hasNode('command:CancelOrder'));
      await settled(page);
      const before = await dragNode(page, 'event:Start', 140, 30);
      assert.notEqual(await page.evaluate(nodeTransform('event:Start')), before, 'the node moved');
      assert.equal(await page.evaluate(`${saveButton} === null`), true);

      await page.evaluate(post(bundle({ variants, variant: null })));
      await page.waitFor(hasNode('command:PlaceOrder'));
      assert.equal(await page.evaluate(`${saveButton} === null`), true);

      await dragNode(page, 'event:Start', 140, 30);
      await page.waitFor(`${saveButton} !== null`);
      await page.evaluate(post({ type: 'setViewMode', payload: { viewMode: 'services' } }));
      await page.waitFor(`${saveButton} === null`);
      await page.evaluate(post({ type: 'setViewMode', payload: { viewMode: 'flow' } }));
      await page.waitFor(`${saveButton} !== null`);
      assert.deepEqual(await page.evaluate(saveMessages), []);
    } finally {
      await browser.closePage(page);
    }
  });

  test('minimal page: no control, no note, and never posts savePositions', async () => {
    const page = await openPage(minimalServer);
    try {
      await page.evaluate(post(bundle({ savedPositions: { exists: true, applied: false, missing: 2 } })));
      await page.waitFor(hasNode('command:PlaceOrder'));
      await settled(page);
      const before = await dragNode(page, 'event:Start', 140, 30);
      assert.notEqual(await page.evaluate(nodeTransform('event:Start')), before, 'the node moved');
      assert.equal(await page.evaluate(`${saveButton} === null && document.querySelector('.saved-positions-note') === null`), true);
      assert.equal(await page.evaluate(`document.body.innerText.includes('Saved positions')`), false);
      assert.deepEqual(await page.evaluate(saveMessages), []);
    } finally {
      await browser.closePage(page);
    }
  });

  test('toolbar page: a saved layout that did not match is noted, with the missing count', async () => {
    const page = await openPage(toolbarServer);
    try {
      await page.evaluate(post(bundle({})));
      await page.waitFor(hasNode('command:PlaceOrder'));
      assert.equal(await page.evaluate(note), null);

      await page.evaluate(post(bundle({ savedPositions: { exists: true, applied: false, missing: 3 } })));
      await page.waitFor(`${note} !== null`);
      assert.equal(await page.evaluate(note), 'Saved positions do not match this flow; automatic layout (3 missing)');

      await page.evaluate(post(bundle({ savedPositions: { exists: true, applied: false } })));
      await page.waitFor(`${note} === 'Saved positions do not match this flow; automatic layout'`);

      await page.evaluate(post(bundle({ savedPositions: { exists: true, applied: true } })));
      await page.waitFor(`${note} === 'Saved layout'`);

      await page.evaluate(post(bundle({ savedPositions: { exists: false, applied: false } })));
      await page.waitFor(`${note} === null`);

      await page.evaluate(post(bundle({ savedPositions: { exists: true, applied: false, missing: 1 } })));
      await page.waitFor(`${note} !== null`);
      await page.evaluate(post(bundle({ flowGraph: flowGraph(variantNodes), variants, variant: 'OrderCancelled' })));
      await page.waitFor(`${note} === null`);
      assert.deepEqual(await page.evaluate(saveMessages), []);
    } finally {
      await browser.closePage(page);
    }
  });
});
