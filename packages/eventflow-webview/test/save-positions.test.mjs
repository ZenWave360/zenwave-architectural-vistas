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
const note = `(document.querySelector('.eventflow-page__status .status-message') || {}).textContent || null`;
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
      await page.waitFor(hasNode('event:Start'));
      await page.evaluate(frames);
      // The diagram was redrawn from the server graph, so the earlier move is not on screen and cannot be saved.
      assert.equal(await page.evaluate(`${saveButton} === null`), true);
      assert.deepEqual(await page.evaluate(saveMessages), []);
    } finally {
      await browser.closePage(page);
    }
  });

  test('minimal page: no control, no note, and never posts savePositions', async () => {
    const page = await openPage(minimalServer);
    try {
      await page.evaluate(post(bundle({ savedPositions: { exists: true, applied: false, missing: ['a', 'b'] } })));
      await page.waitFor(hasNode('command:PlaceOrder'));
      await settled(page);
      const before = await dragNode(page, 'event:Start', 140, 30);
      assert.notEqual(await page.evaluate(nodeTransform('event:Start')), before, 'the node moved');
      assert.equal(await page.evaluate(`${saveButton} === null && document.querySelector('.eventflow-page__status .status-message') === null`), true);
      assert.equal(await page.evaluate(`document.body.innerText.includes('Saved positions')`), false);
      assert.deepEqual(await page.evaluate(saveMessages), []);
    } finally {
      await browser.closePage(page);
    }
  });

  test('toolbar page: a saved layout that did not match is noted in the status bar, not the toolbar, with the missing count', async () => {
    const page = await openPage(toolbarServer);
    try {
      await page.evaluate(post(bundle({})));
      await page.waitFor(hasNode('command:PlaceOrder'));
      assert.equal(await page.evaluate(note), null);

      await page.evaluate(post(bundle({ savedPositions: { exists: true, applied: false, missing: ['a', 'b', 'c'] } })));
      await page.waitFor(`${note} !== null`);
      assert.equal(await page.evaluate(note), 'Saved positions do not match this flow; automatic layout (3 missing)');
      assert.equal(await page.evaluate(`document.querySelector('.eventflow-toolbar .status-message') === null`), true);
      assert.equal(await page.evaluate(`document.querySelector('.eventflow-page__status .status-message').title`), 'a, b, c');
      assert.equal(await page.evaluate(`document.querySelector('.eventflow-page__status').getBoundingClientRect().bottom`), await page.evaluate(`window.innerHeight`));

      await page.evaluate(post(bundle({ savedPositions: { exists: true, applied: false } })));
      await page.waitFor(`${note} === 'Saved positions do not match this flow; automatic layout'`);

      await page.evaluate(post(bundle({ savedPositions: { exists: true, applied: true } })));
      await page.waitFor(`${note} === 'Saved layout'`);

      await page.evaluate(post(bundle({ savedPositions: { exists: false, applied: false } })));
      await page.waitFor(`${note} === null`);

      await page.evaluate(post(bundle({ savedPositions: { exists: true, applied: false, missing: ['a'] } })));
      await page.waitFor(`${note} !== null`);
      await page.evaluate(post(bundle({ flowGraph: flowGraph(variantNodes), variants, variant: 'OrderCancelled' })));
      await page.waitFor(`${note} === null`);
      assert.deepEqual(await page.evaluate(saveMessages), []);
    } finally {
      await browser.closePage(page);
    }
  });

  const realisticNodes = () => [
    { ...flowNode('event:OrderPlaced', 'EVENT', 40, 100), dimensions: { width: 160, height: 48 } },
    { ...flowNode('command:PlaceOrder', 'COMMAND', 320, 100), dimensions: { width: 180, height: 56 } },
    { ...flowNode('readmodel:Orders', 'READ_MODEL', 600, 101), dimensions: { width: 124, height: 124 } },
    { ...flowNode('policy:Notify', 'POLICY', 860, 103), dimensions: { width: 220, height: 64 } },
  ];
  const drawn = (page) => page.evaluate(`Object.fromEntries([...document.querySelectorAll('.react-flow__node')]
    .map((node) => [node.dataset.id, node.style.transform]))`);
  const serverPositions = (nodes) => Object.fromEntries(nodes.map((node) => [node.id, node.position]));

  test('toolbar page: saved positions are server coordinates, so saving and reopening never drifts', async () => {
    const page = await openPage(toolbarServer);
    try {
      const nodes = realisticNodes();
      await page.evaluate(post(bundle({ flowGraph: flowGraph(nodes) })));
      await page.waitFor(hasNode('policy:Notify'));
      await settled(page);
      const before = await drawn(page);

      await dragNode(page, 'command:PlaceOrder', 0, 40);
      await page.waitFor(`${saveButton} !== null`);
      await page.evaluate(`${saveButton}.click()`);
      const first = (await page.evaluate(saveMessages))[0].payload.positions;
      const moved = (await drawn(page))['command:PlaceOrder'];
      const parse = (transform) => transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/).slice(1).map(Number);
      const [bx, by] = parse(before['command:PlaceOrder']);
      const [mx, my] = parse(moved);
      const expected = serverPositions(nodes);
      for (const id of Object.keys(expected)) {
        if (id === 'command:PlaceOrder') continue;
        assert.deepEqual(first[id], expected[id], `${id} is unchanged`);
      }
      assert.deepEqual(first['command:PlaceOrder'], {
        x: Math.round(expected['command:PlaceOrder'].x + (mx - bx)),
        y: Math.round(expected['command:PlaceOrder'].y + (my - by)),
      });
      assert.ok(my - by > 5 && Math.abs(mx - bx) < 1, `the node moved down only: ${mx - bx}, ${my - by}`);

      // The saved positions come back as the server's positions: the drawing equals what it was.
      const reopened = nodes.map((node) => ({ ...node, position: first[node.id] }));
      await page.evaluate(post(bundle({ flowGraph: flowGraph(reopened) })));
      await page.waitFor(`${saveButton} === null`);
      await page.evaluate(frames);
      // Saved positions are whole numbers, so the moved node is drawn where it was, rounded.
      assert.deepEqual(await drawn(page), { ...before, 'command:PlaceOrder': `translate(${Math.round(mx)}px, ${Math.round(my)}px)` });

      // Saving a second time without moving anything keeps every position.
      await dragNode(page, 'readmodel:Orders', 0, 20);
      await page.waitFor(`${saveButton} !== null`);
      await page.evaluate(`${saveButton}.click()`);
      const second = (await page.evaluate(saveMessages))[1].payload.positions;
      assert.deepEqual(second['command:PlaceOrder'], first['command:PlaceOrder']);
      assert.deepEqual(second['event:OrderPlaced'], expected['event:OrderPlaced']);
      assert.deepEqual(second['policy:Notify'], expected['policy:Notify']);
      assert.deepEqual(page.exceptions, []);
    } finally {
      await browser.closePage(page);
    }
  });

  test('toolbar page: the control never saves positions that are not on screen', async () => {
    const page = await openPage(toolbarServer);
    try {
      const shown = async () => Object.fromEntries(Object.entries(await drawn(page)).filter(([id]) => !id.includes(':in')));
      const saveAndCheck = async () => {
        if (await page.evaluate(`${saveButton} === null`)) return;
        // Present: it must save exactly what is on screen.
        const nodes = realisticNodes();
        const onScreen = await shown();
        const count = (await page.evaluate(saveMessages)).length;
        await page.evaluate(`${saveButton}.click()`);
        const sent = (await page.evaluate(saveMessages))[count].payload.positions;
        for (const node of nodes) {
          const [x, y] = onScreen[node.id].match(/-?[\d.]+/g).map(Number);
          const dims = { width: Math.max(node.dimensions.width, 180), height: Math.max(node.dimensions.height, 112) };
          assert.deepEqual(sent[node.id], {
            x: Math.round(x + (dims.width - node.dimensions.width) / 2),
            y: Math.round(y + (dims.height - node.dimensions.height) / 2),
          });
        }
      };
      await page.evaluate(post(bundle({ flowGraph: flowGraph(realisticNodes()), serviceGraph: null })));
      await page.waitFor(hasNode('policy:Notify'));
      await settled(page);

      await dragNode(page, 'event:OrderPlaced', 100, 30);
      await page.waitFor(`${saveButton} !== null`);
      await page.evaluate(`window.setDisplaySettings({ humanizeLabels: false })`);
      await page.evaluate(frames);
      assert.equal(await page.evaluate(`${saveButton} === null`), true);
      await saveAndCheck();
      assert.deepEqual(await page.evaluate(saveMessages), [], 'a redraw from the server graph hides the control');

      await dragNode(page, 'event:OrderPlaced', 100, 30);
      await page.waitFor(`${saveButton} !== null`);
      await page.evaluate(`window.highlightNode('command:PlaceOrder')`);
      await page.evaluate(frames);
      assert.equal(await page.evaluate(`${saveButton} === null`), true);
      await saveAndCheck();
      assert.deepEqual(await page.evaluate(saveMessages), []);

      await dragNode(page, 'event:OrderPlaced', 100, 30);
      await page.waitFor(`${saveButton} !== null`);
      await page.evaluate(post({ type: 'setViewMode', payload: { viewMode: 'services' } }));
      await page.evaluate(post({ type: 'setViewMode', payload: { viewMode: 'flow' } }));
      await page.waitFor(hasNode('policy:Notify'));
      await settled(page);
      assert.equal(await page.evaluate(`${saveButton} === null`), true);
      await saveAndCheck();
      assert.deepEqual(await page.evaluate(saveMessages), []);
      assert.deepEqual(page.exceptions, []);
    } finally {
      await browser.closePage(page);
    }
  });
});
