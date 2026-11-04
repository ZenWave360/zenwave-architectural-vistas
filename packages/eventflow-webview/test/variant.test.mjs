// Variant dropdown on the toolbar page, and the same choice sent by a host to the minimal page.
// The page posts the user's choice and waits for the host to send the laid-out graph.
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

const variants = [
  { id: 'PaymentFailed', title: 'Payment Failed' },
  { id: 'OrderCancelled', title: 'Order Cancelled' },
];

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
const selectedVariant = `(document.querySelector('.variant-selector select') || {}).value`;
const variantMessages = `window.__vscodeMessages.filter((message) => message.type === 'variantChanged')`;
const optionList = `[...document.querySelectorAll('.variant-selector select option')].map((option) => ({ value: option.value, label: option.textContent }))`;
const chooseVariant = (value) => `(() => {
  const select = document.querySelector('.variant-selector select');
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  const tracker = select._valueTracker;
  if (tracker) tracker.setValue(${JSON.stringify(value === '' ? 'other' : '')});
  set.call(select, ${JSON.stringify(value)});
  select.dispatchEvent(new Event('change', { bubbles: true }));
})()`;
const frames = `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))`;
const viewportTransform = `document.querySelector('.react-flow__viewport').style.transform`;

function translateX(transform) {
  const match = /translate\(\s*(-?\d+(?:\.\d+)?)px/.exec(transform ?? '');
  return match ? Number(match[1]) : null;
}

describe('EventFlow variant dropdown', { skip }, () => {
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

  async function moveViewport(page) {
    const initial = await page.evaluate(viewportTransform);
    await page.evaluate(`document.querySelector('.react-flow__controls-zoomin').click()`);
    await page.waitFor(`${viewportTransform} !== ${JSON.stringify(initial)}`);
    const point = await page.evaluate(`(() => {
      const box = document.querySelector('.react-flow__pane').getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + 60 };
    })()`);
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x + 90, y: point.y + 50, button: 'left', buttons: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x + 90, y: point.y + 50, button: 'left', buttons: 0, clickCount: 1 });
    await page.evaluate(frames);
    return page.evaluate(viewportTransform);
  }

  test('toolbar page: the dropdown is hidden without variants, with an empty list, and in Systems', async () => {
    const page = await openPage(toolbarServer);
    try {
      assert.equal(await page.evaluate(`document.querySelector('.variant-selector') === null`), true);

      await page.evaluate(post(bundle({})));
      await page.waitFor(hasNode('command:PlaceOrder'));
      assert.equal(await page.evaluate(`document.querySelector('.variant-selector, select') === null`), true);

      await page.evaluate(post(bundle({ variants: [] })));
      assert.equal(await page.evaluate(`document.querySelector('.variant-selector') === null`), true);

      await page.evaluate(post(bundle({ variants })));
      await page.waitFor(`document.querySelector('.variant-selector select') !== null`);

      await page.evaluate(post({ type: 'setViewMode', payload: { viewMode: 'services' } }));
      await page.waitFor(`document.querySelector('.variant-selector') === null && document.body.innerText.includes('Waiting for services view data from host')`);
      await page.evaluate(post(bundle({ variants, variant: 'PaymentFailed', viewMode: 'services' })));
      assert.equal(await page.evaluate(`document.querySelector('.variant-selector') === null`), true);

      await page.evaluate(post({ type: 'setViewMode', payload: { viewMode: 'flow' } }));
      await page.waitFor(`${selectedVariant} === 'PaymentFailed'`);
      assert.deepEqual(await page.evaluate(variantMessages), []);
      assert.deepEqual(await page.evaluate(`window.__vscodeMessages.filter((message) => message.type === 'viewModeChanged')`), []);
    } finally {
      await browser.closePage(page);
    }
  });

  test('toolbar page: the dropdown lists the full diagram and the host variants, on the right', async () => {
    const page = await openPage(toolbarServer);
    try {
      await page.evaluate(post(bundle({
        variants: [
          { id: '', title: 'blank' },
          { title: 'no id' },
          null,
          { id: 'PaymentFailed', title: 'Payment Failed' },
          { id: 'OrderCancelled', title: 'Order Cancelled' },
          { id: 'OrderCancelled', title: 'Duplicate' },
          { id: 'Bare', title: '' },
        ],
      })));
      await page.waitFor(`document.querySelectorAll('.variant-selector option').length === 4`);
      assert.deepEqual(await page.evaluate(optionList), [
        { value: '', label: 'Full diagram' },
        { value: 'PaymentFailed', label: 'Payment Failed' },
        { value: 'OrderCancelled', label: 'Order Cancelled' },
        { value: 'Bare', label: 'Bare' },
      ]);
      assert.equal(await page.evaluate(selectedVariant), '');

      const box = await page.evaluate(`(() => {
        const bar = document.querySelector('.eventflow-toolbar').getBoundingClientRect();
        const variant = document.querySelector('.variant-selector').getBoundingClientRect();
        const view = document.querySelector('.view-selector').getBoundingClientRect();
        return {
          variantBeforeView: variant.right <= view.left + 1,
          insetRight: bar.right - view.right,
          roomLeft: variant.left - bar.left,
        };
      })()`);
      assert.equal(box.variantBeforeView, true);
      assert.ok(box.insetRight < 24, `view selector inset ${box.insetRight}`);
      assert.ok(box.roomLeft > 40, `room to the left of the variant dropdown ${box.roomLeft}`);
    } finally {
      await browser.closePage(page);
    }
  });

  test('toolbar page: choosing a variant posts variantChanged and does not swap the graph', async () => {
    const page = await openPage(toolbarServer);
    try {
      await page.evaluate(post(bundle({ variants })));
      await page.waitFor(hasNode('command:PlaceOrder'));
      assert.deepEqual(await page.evaluate(variantMessages), []);

      await page.evaluate(chooseVariant('OrderCancelled'));
      await page.waitFor(`${selectedVariant} === 'OrderCancelled'`);
      assert.equal(await page.evaluate(hasNode('command:PlaceOrder')), true, 'the full diagram stays until the host answers');
      assert.equal(await page.evaluate(hasNode('command:CancelOrder')), false);
      assert.deepEqual(await page.evaluate(variantMessages), [
        { type: 'variantChanged', payload: { variant: 'OrderCancelled' } },
      ]);

      await page.evaluate(chooseVariant('OrderCancelled'));
      assert.equal((await page.evaluate(variantMessages)).length, 1, 'choosing the current variant posts nothing');

      await page.evaluate(chooseVariant(''));
      await page.waitFor(`${selectedVariant} === ''`);
      assert.deepEqual(await page.evaluate(variantMessages), [
        { type: 'variantChanged', payload: { variant: 'OrderCancelled' } },
        { type: 'variantChanged', payload: { variant: null } },
      ]);
      assert.equal(await page.evaluate(hasNode('command:PlaceOrder')), true);

      await page.evaluate(post(bundle({ flowGraph: flowGraph(variantNodes), variants, variant: 'OrderCancelled' })));
      await page.waitFor(`${hasNode('command:CancelOrder')} && ${nodeTransform('command:CancelOrder')}.includes('640')`);
      assert.equal(await page.evaluate(hasNode('command:PlaceOrder')), false);
      assert.equal(await page.evaluate(selectedVariant), 'OrderCancelled');
      assert.equal((await page.evaluate(variantMessages)).length, 2, 'the host bundle is not reported back');
    } finally {
      await browser.closePage(page);
    }
  });

  test('toolbar page: a host renderBundle moves the dropdown and sends no variantChanged', async () => {
    const page = await openPage(toolbarServer);
    try {
      await page.evaluate(post(bundle({ variants })));
      await page.waitFor(`${selectedVariant} === ''`);

      await page.evaluate(post(bundle({ variants, variant: 'OrderCancelled' })));
      await page.waitFor(`${selectedVariant} === 'OrderCancelled'`);

      await page.evaluate(post(bundle({
        flowGraph: flowGraph([flowNode('event:Start', 'START', 48), flowNode('command:PlaceOrder', 'COMMAND', 320)]),
      })));
      await page.waitFor(`${nodeTransform('event:Start')}.includes('48')`);
      assert.equal(await page.evaluate(selectedVariant), 'OrderCancelled', 'omitting variant leaves the selection');

      await page.evaluate(post(bundle({ variants, variant: null })));
      await page.waitFor(`${selectedVariant} === ''`);

      await page.evaluate(post(bundle({
        variants,
        variant: '',
        flowGraph: flowGraph([flowNode('event:Start', 'START', 56), flowNode('command:PlaceOrder', 'COMMAND', 320)]),
      })));
      await page.waitFor(`${nodeTransform('event:Start')}.includes('56')`);
      assert.equal(await page.evaluate(selectedVariant), '');

      await page.evaluate(post(bundle({
        variants,
        variant: 'not-a-variant',
        flowGraph: flowGraph([flowNode('event:Start', 'START', 64), flowNode('command:PlaceOrder', 'COMMAND', 320)]),
      })));
      await page.waitFor(`${nodeTransform('event:Start')}.includes('64')`);
      assert.equal(await page.evaluate(selectedVariant), '');

      assert.deepEqual(await page.evaluate(variantMessages), []);
      assert.deepEqual(await page.evaluate('window.__vscodeMessages'), [expectedReady]);
    } finally {
      await browser.closePage(page);
    }
  });

  test('toolbar page: a node moved in a variant is not reported, and the full diagram returns as the host sent it', async () => {
    const page = await openPage(toolbarServer);
    try {
      await page.evaluate(post(bundle({ flowGraph: flowGraph(variantNodes), variants, variant: 'OrderCancelled' })));
      await page.waitFor(`${hasNode('event:Start')} && ${nodeTransform('event:Start')}.includes('40')`);
      const beforeMessages = await page.evaluate('window.__vscodeMessages');
      const before = await dragNode(page, 'event:Start', 140, 30);
      const dragged = await page.evaluate(nodeTransform('event:Start'));
      const beforeX = translateX(before);
      const draggedX = translateX(dragged);
      assert.ok(beforeX != null && draggedX != null, `transforms ${before} -> ${dragged}`);
      assert.ok(Math.abs(draggedX - beforeX) > 20, `drag left the node at ${dragged}`);
      assert.deepEqual(await page.evaluate('window.__vscodeMessages'), beforeMessages);

      await page.evaluate(post(bundle({ variants, variant: null })));
      await page.waitFor(`${hasNode('command:PlaceOrder')} && !${hasNode('command:CancelOrder')}`);
      const restored = await page.evaluate(nodeTransform('event:Start'));
      const restoredX = translateX(restored);
      assert.ok(Math.abs(restoredX - beforeX) < 1, `full diagram kept the dragged x ${restoredX}, started at ${beforeX}`);
      assert.deepEqual(await page.evaluate(variantMessages), []);
      assert.deepEqual(page.exceptions, []);
    } finally {
      await browser.closePage(page);
    }
  });

  test('toolbar page: the same diagramId reframes when the variant changes, and an update of that variant does not', async () => {
    const page = await openPage(toolbarServer);
    try {
      const wide = [flowNode('event:Start', 'START', 0, 400), flowNode('command:Far', 'COMMAND', 40000, 400)];
      await page.evaluate(post(bundle({ flowGraph: flowGraph(wide), variants, variant: null })));
      await page.waitFor(hasNode('event:Start'));
      await moveViewport(page);

      const variantWide = [flowNode('event:Start', 'START', 20000, 400), flowNode('command:Far', 'COMMAND', 60000, 400)];
      await page.evaluate(post(bundle({ flowGraph: flowGraph(variantWide), variants, variant: 'OrderCancelled' })));
      await page.waitFor(`(() => {
        const pane = document.querySelector('.react-flow');
        const start = document.querySelector('.react-flow__node[data-id="event:Start"]');
        if (!pane || !start) return false;
        const paneBox = pane.getBoundingClientRect();
        const startBox = start.getBoundingClientRect();
        return paneBox.width > 200 && startBox.left >= paneBox.left && startBox.right <= paneBox.left + paneBox.width * 0.25;
      })()`);
      assert.equal(await page.evaluate(selectedVariant), 'OrderCancelled');
      assert.deepEqual(await page.evaluate(variantMessages), []);

      const panned = await moveViewport(page);
      const moved = [flowNode('event:Start', 'START', 20000, 400), flowNode('command:Far', 'COMMAND', 61000, 400)];
      await page.evaluate(post(bundle({ flowGraph: flowGraph(moved), variants, variant: 'OrderCancelled' })));
      await page.waitFor(`${nodeTransform('command:Far')}.includes('61000')`);
      assert.equal(await page.evaluate(viewportTransform), panned, 'the same variant keeps the user pan and zoom');
    } finally {
      await browser.closePage(page);
    }
  });

  test('minimal page: has no dropdown, posts no variantChanged, and shows the graph the host sent', async () => {
    const page = await openPage(minimalServer);
    try {
      const wide = [flowNode('event:Start', 'START', 0, 400), flowNode('command:Far', 'COMMAND', 40000, 400)];
      await page.evaluate(post(bundle({ flowGraph: flowGraph(wide), variants, variant: null })));
      await page.waitFor(hasNode('event:Start'));
      await moveViewport(page);

      const variantWide = [flowNode('event:Start', 'START', 20000, 400), flowNode('command:Only', 'COMMAND', 60000, 400)];
      await page.evaluate(post(bundle({ flowGraph: flowGraph(variantWide), variants, variant: 'OrderCancelled' })));
      await page.waitFor(`(() => {
        const pane = document.querySelector('.react-flow');
        const start = document.querySelector('.react-flow__node[data-id="event:Start"]');
        const only = document.querySelector('.react-flow__node[data-id="command:Only"]');
        if (!pane || !start || !only) return false;
        const paneBox = pane.getBoundingClientRect();
        const startBox = start.getBoundingClientRect();
        return paneBox.width > 200 && startBox.left >= paneBox.left && startBox.right <= paneBox.left + paneBox.width * 0.25;
      })()`);
      assert.equal(await page.evaluate(`document.querySelector('.variant-selector, .view-selector, select') === null`), true);
      assert.equal(await page.evaluate(hasNode('command:Far')), false);
      assert.deepEqual(await page.evaluate('window.__vscodeMessages'), [expectedReady]);
    } finally {
      await browser.closePage(page);
    }
  });
});
