// Humanize labels toggle (EF-R22) and policy drawing (EF-R21) on the toolbar page.
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


function flowNode(id, type, x, extra = {}) {
  return {
    id,
    type,
    label: id,
    system: null,
    service: null,
    sourceRef: { file: '<zfl>', line: 1, column: 1 },
    position: { x, y: 80 },
    dimensions: { width: 180, height: 112 },
    ...extra,
  };
}
const graph = (nodes) => ({ schema: 'zfl.eventflow.view@1', nodes, edges: [], layout: null, bounds: null, systemGroups: null });
const post = (message) => `window.postMessage(${JSON.stringify(message)}, '*')`;
const bundle = (nodes, displaySettings) => ({
  type: 'renderBundle',
  payload: { flowGraph: graph(nodes), serviceGraph: null, viewMode: 'flow', diagramId, displaySettings },
});
const nodeText = (id) => `(document.querySelector('.react-flow__node[data-id=${JSON.stringify(id)}]') || {}).innerText || null`;
const labelMessages = `window.__vscodeMessages.filter((message) => message.type === 'labelsChanged')`;
const toggle = `document.querySelector('.eventflow-toolbar .humanize-toggle input')`;
const laneSelect = `document.querySelector('.lanes-control select')`;
const lanesMessages = `window.__vscodeMessages.filter((message) => message.type === 'lanesChanged')`;
const statusText = `document.querySelector('.eventflow-page__status')?.textContent`;
const automaticStatus = 'Lanes use automatic layout; saved positions are not applied';
const changeLanes = (value) => `(() => { const select = ${laneSelect}; select.value = ${JSON.stringify(value)}; select.dispatchEvent(new Event('change', { bubbles: true })); })()`;
const laneGraph = (mode) => ({
  ...graph([flowNode('a', 'COMMAND', 220, { lane: 'one' }), flowNode('b', 'EVENT', 520, { lane: 'one' })]),
  edges: [{ id: 'a-b', source: 'a', target: 'b', type: 'CAUSATION', label: null, outcome: null, sourceRef: null }],
  systemGroups: [{ systemName: 'Store', bounds: { x: 0, y: 0, width: 900, height: 440 } }],
  // Order is supplied by the server, not inferred from array order or labels.
  lanes: [
    { id: 'two', kind: mode === 'systems' ? 'system' : 'service', label: 'Unassigned', system: null, x: 0, y: 220, width: 900, height: 220, order: 1 },
    { id: 'one', kind: mode === 'systems' ? 'system' : 'service', label: 'Store API', system: mode === 'systems' ? null : 'Store', x: 0, y: 0, width: 900, height: 220, order: 0 },
  ],
});

async function dragFirstNode(page) {
  await page.waitFor(`document.querySelector('.react-flow__node')?.style.visibility === 'visible'`);
  // Let the opening frame finish before calculating screen coordinates.
  await new Promise((resolve) => setTimeout(resolve, 200));
  const before = await page.evaluate(`(() => {
    const node = document.querySelector('.react-flow__node');
    const box = node.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, transform: node.style.transform };
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: before.x, y: before.y, button: 'left', buttons: 1, clickCount: 1 });
  for (let step = 1; step <= 4; step++) {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: before.x + step * 15, y: before.y + step * 5, button: 'left', buttons: 1 });
  }
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: before.x + 60, y: before.y + 20, button: 'left', buttons: 0, clickCount: 1 });
  await page.evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
  return before.transform;
}

const savePositionsMessages = `window.__vscodeMessages.filter((message) => message.type === 'savePositions')`;
const firstNodeInsideItsLane = `(() => {
  const node = document.querySelector('.react-flow__node').getBoundingClientRect();
  const lane = document.querySelector('.eventflow-lane[data-lane-id="one"]').getBoundingClientRect();
  const slack = 1;
  return node.left >= lane.left - slack && node.right <= lane.right + slack && node.top >= lane.top - slack && node.bottom <= lane.bottom + slack;
})()`;

describe('EventFlow humanize toggle and policy drawing', { skip }, () => {
  let server;
  let minimalServer;
  let browser;

  before(async () => {
    server = await startServer(path.join(packageDirectory, 'webview-toolbar'));
    minimalServer = await startServer(path.join(packageDirectory, 'webview'));
    browser = await launchBrowser(executable);
  });

  after(async () => {
    await browser?.close();
    await server?.close();
    await minimalServer?.close();
  });

  async function openPage(host = server) {
    const page = await browser.newPage();
    await page.addInitScript(FAKE_VSCODE_API);
    await page.goto(`${host.origin}/webview/index.html`);
    await page.waitFor(`typeof window.renderBundle === 'function'`);
    return page;
  }

  test('the minimal page draws server bands without controls or outbound choices', async () => {
    const page = await openPage(minimalServer);
    try {
      await page.evaluate(post({ type: 'renderBundle', payload: { flowGraph: laneGraph('services'), viewMode: 'flow', displaySettings: { lanes: 'services' } } }));
      await page.waitFor(`document.querySelectorAll('.eventflow-lane').length === 2`);
      // EF-R24: the canvas is editable with lanes, on screen only.
      assert.equal(await page.evaluate(`document.querySelectorAll('.react-flow__node.nopan').length`), 2);
      assert.equal(await page.evaluate(`document.querySelector('.lanes-control, .save-positions, .eventflow-page__status')`), null);
      assert.deepEqual(await page.evaluate(lanesMessages), []);
      const beforeDrag = await dragFirstNode(page);
      assert.notEqual(await page.evaluate(`document.querySelector('.react-flow__node').style.transform`), beforeDrag);
      assert.equal(await page.evaluate(firstNodeInsideItsLane), true, 'the node stays inside its lane');
      assert.deepEqual(await page.evaluate(`window.__vscodeMessages.map((message) => message.type)`), ['webviewReady'], 'dragging posts no choice and saves nothing');
      assert.deepEqual(page.exceptions, []);
    } finally { await browser.closePage(page); }
  });

  for (const mode of ['systems', 'services']) {
    test(`host ${mode} bands draw below edges/nodes, disable saving/dragging and preserve variants`, async () => {
      const page = await openPage();
      try {
        const payload = { lanesSupported: true, flowGraph: laneGraph(mode), viewMode: 'flow', diagramId,
          displaySettings: { lanes: mode }, variants: [{ id: 'v', title: 'From A to B' }], variant: null,
          savedPositions: { exists: true, applied: true } };
        await page.evaluate(post({ type: 'renderBundle', payload }));
        await page.waitFor(`document.querySelectorAll('.eventflow-lane').length === 2`);
        assert.equal(await page.evaluate(`${laneSelect}.value`), mode);
        assert.deepEqual(await page.evaluate(lanesMessages), []);
        assert.deepEqual(await page.evaluate(`Array.from(document.querySelectorAll('.eventflow-lane')).map(el => [el.dataset.laneId, el.textContent.trim(), el.style.top, el.style.width, el.style.height])`), [
          ['one', 'Store API', '0px', '900px', '220px'], ['two', 'Unassigned', '220px', '900px', '220px'],
        ]);
        assert.equal(await page.evaluate(`document.querySelectorAll('.react-flow__node').length`), 2, 'bands are not interactive nodes or group boxes');
        assert.equal(await page.evaluate(`Number(getComputedStyle(document.querySelector('.eventflow-lanes')).zIndex) < Number(getComputedStyle(document.querySelector('.react-flow__renderer')).zIndex)`), true);
        assert.equal(await page.evaluate(`document.querySelector('.react-flow__renderer').contains(document.querySelector('.react-flow__edges'))`), true);
        assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('.eventflow-lanes')).pointerEvents`), 'none');
        // EF-R24: nodes can be dragged inside their own lane, on screen only.
        assert.equal(await page.evaluate(`document.querySelectorAll('.react-flow__node.nopan').length`), 2);
        assert.equal(await page.evaluate(`document.querySelectorAll('[data-lane-handle]').length`), 2, 'each lane has a handle on its title');
        const beforeDrag = await dragFirstNode(page);
        assert.notEqual(await page.evaluate(`document.querySelector('.react-flow__node').style.transform`), beforeDrag);
        assert.equal(await page.evaluate(firstNodeInsideItsLane), true, 'the node stays inside its lane');
        assert.deepEqual(await page.evaluate(savePositionsMessages), [], 'dragging with lanes saves nothing');
        assert.equal(await page.evaluate(`document.querySelector('.save-positions').disabled`), true);
        assert.match(await page.evaluate(`document.querySelector('.save-positions').title`), /Lanes use automatic layout/);
        assert.equal(await page.evaluate(statusText), automaticStatus);
        await page.evaluate(`document.querySelector('.save-positions').click()`);
        assert.equal(await page.evaluate(`window.__vscodeMessages.filter(m => m.type === 'savePositions').length`), 0);
        await page.evaluate(`window.savePositionsFailed('old failure')`);
        await page.waitFor(`${statusText} === ${JSON.stringify(automaticStatus)}`);

        await page.evaluate(`(() => { const el = document.querySelector('.variant-selector select'); el.value = 'v'; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        await page.waitFor(`window.__vscodeMessages.some(m => m.type === 'variantChanged')`);
        assert.deepEqual(await page.evaluate(`window.__vscodeMessages.filter(m => m.type === 'variantChanged')`), [{ type: 'variantChanged', payload: { variant: 'v' } }]);
        const variantGraph = laneGraph(mode);
        variantGraph.lanes = [{ ...variantGraph.lanes[1], label: 'Variant Store', width: 720 }];
        await page.evaluate(post({ type: 'renderBundle', payload: { ...payload, flowGraph: variantGraph, variant: 'v' } }));
        await page.waitFor(`document.querySelectorAll('.eventflow-lane').length === 1`);
        assert.equal(await page.evaluate(`document.querySelector('.eventflow-lane__label').textContent`), 'Variant Store');
        assert.equal(await page.evaluate(`document.querySelector('.variant-selector select').value`), 'v');
        assert.equal(await page.evaluate(statusText), automaticStatus);
        assert.deepEqual(page.exceptions, []);
      } finally { await browser.closePage(page); }
    });
  }

  test('Lanes posts only user choices, waits for server bands, and restores null-lanes behavior', async () => {
    const page = await openPage();
    try {
      const plain = { ...graph([flowNode('a', 'COMMAND', 220)]), lanes: null };
      await page.evaluate(post({ type: 'renderBundle', payload: { lanesSupported: true, flowGraph: plain, viewMode: 'flow', diagramId, savedPositions: { exists: true, applied: true } } }));
      await page.waitFor(`document.querySelector('.react-flow__node') !== null`);
      assert.equal(await page.evaluate(`${laneSelect}.value`), 'none');
      assert.equal(await page.evaluate(`document.querySelectorAll('.react-flow__node.nopan').length`), 1);
      assert.equal(await page.evaluate(`document.querySelector('.save-positions')`), null);
      assert.equal(await page.evaluate(statusText), 'Saved layout');
      await page.evaluate(changeLanes('systems'));
      await page.waitFor(`document.querySelector('.save-positions')?.disabled === true`);
      assert.deepEqual(await page.evaluate(lanesMessages), [{ type: 'lanesChanged', payload: { lanes: 'systems' } }]);
      assert.equal(await page.evaluate(`document.querySelector('.eventflow-lanes')`), null, 'no client layout before server response');
      await page.evaluate(post({ type: 'renderBundle', payload: { lanesSupported: true, flowGraph: laneGraph('systems'), diagramId, displaySettings: { lanes: 'systems' } } }));
      await page.waitFor(`document.querySelectorAll('.eventflow-lane').length === 2`);
      await page.evaluate(changeLanes('services'));
      await page.waitFor(`${laneSelect}.value === 'services'`);
      await page.evaluate(post({ type: 'renderBundle', payload: { lanesSupported: true, flowGraph: laneGraph('services'), diagramId, displaySettings: { lanes: 'services' } } }));
      await page.evaluate(`window.setDisplaySettings({ lanes: 'invalid', humanizeLabels: false })`);
      await page.waitFor(`${toggle}.checked === false`);
      assert.equal(await page.evaluate(`${laneSelect}.value`), 'services', 'invalid host values are ignored');
      await page.evaluate(changeLanes('none'));
      await page.waitFor(`${laneSelect}.value === 'none'`);
      assert.equal(await page.evaluate(`document.querySelector('.save-positions').disabled`), true, 'old bands remain automatic until response');
      assert.equal(await page.evaluate(statusText), automaticStatus);
      await page.evaluate(post({ type: 'renderBundle', payload: { lanesSupported: true, flowGraph: plain, diagramId, displaySettings: { lanes: 'none' }, savedPositions: { exists: true, applied: true } } }));
      await page.waitFor(`document.querySelector('.eventflow-lanes') === null`);
      assert.equal(await page.evaluate(`document.querySelectorAll('.react-flow__node.nopan').length`), 1);
      assert.equal(await page.evaluate(`document.querySelector('.save-positions')`), null);
      assert.equal(await page.evaluate(statusText), 'Saved layout');
      assert.deepEqual((await page.evaluate(lanesMessages)).map(m => m.payload.lanes), ['systems', 'services', 'none']);
      const beforeDrag = await dragFirstNode(page);
      assert.notEqual(await page.evaluate(`document.querySelector('.react-flow__node').style.transform`), beforeDrag);
      await page.waitFor(`document.querySelector('.save-positions')?.disabled === false`);
      assert.deepEqual(page.exceptions, []);
    } finally { await browser.closePage(page); }
  });

  test('lanesSupported false shows the Lanes control only for true; false and absent hide it', async () => {
    const page = await openPage();
    try {
      const send = (extra) => page.evaluate(post({ type: 'renderBundle', payload: { flowGraph: laneGraph('systems'), viewMode: 'flow', diagramId, displaySettings: { lanes: 'systems' }, ...extra } }));
      await send({});
      await page.waitFor(`document.querySelector('.react-flow__node') !== null`);
      assert.equal(await page.evaluate(`document.querySelector('.lanes-control')`), null, 'absent hides it');
      await send({ lanesSupported: true });
      await page.waitFor(`${laneSelect} !== null`);
      await send({ lanesSupported: false });
      await page.waitFor(`document.querySelector('.lanes-control') === null`);
      assert.equal(await page.evaluate(`document.querySelector('.eventflow-page__status')?.textContent ?? ''`).then((t) => t.includes('Lanes use automatic layout')), false);
      await send({ lanesSupported: true });
      await page.waitFor(`${laneSelect} !== null`);
      assert.equal(await page.evaluate(`${laneSelect}.value`), 'systems');
      await page.evaluate(post({ type: 'renderBundle', payload: { lanesSupported: true, flowGraph: { ...graph([flowNode('a', 'COMMAND', 220)]), lanes: [] }, viewMode: 'flow', diagramId, displaySettings: { lanes: 'none' } } }));
      await page.waitFor(`${laneSelect}?.value === 'none'`);
      assert.equal(await page.evaluate(`document.querySelector('.save-positions, .eventflow-page__status')`), null, 'empty lanes count as no lanes');
      assert.deepEqual(await page.evaluate(lanesMessages), []);
      assert.deepEqual(page.exceptions, []);
    } finally { await browser.closePage(page); }
  });

  test('the toggle starts from the host, re-renders labels at once and posts labelsChanged only for the user', async () => {
    const page = await openPage();
    try {
      await page.evaluate(post(bundle([flowNode('command:PlaceOrder', 'COMMAND', 40, { label: 'placeOrder' })])));
      await page.waitFor(`${nodeText('command:PlaceOrder')} !== null`);
      assert.equal(await page.evaluate(`${toggle}.checked`), true);
      assert.match(await page.evaluate(nodeText('command:PlaceOrder')), /Place Order/i);

      await page.evaluate(`${toggle}.click()`);
      await page.waitFor(`/placeOrder/.test(${nodeText('command:PlaceOrder')})`);
      assert.deepEqual(await page.evaluate(labelMessages), [{ type: 'labelsChanged', payload: { humanize: false } }]);
      assert.equal(await page.evaluate(`document.querySelector('.eventflow-page__status')`), null);

      await page.evaluate(`${toggle}.click()`);
      await page.waitFor(`/Place Order/i.test(${nodeText('command:PlaceOrder')})`);
      assert.deepEqual((await page.evaluate(labelMessages)).map((m) => m.payload.humanize), [false, true]);

      await page.evaluate(`window.setDisplaySettings({ humanizeLabels: false })`);
      await page.waitFor(`${toggle}.checked === false`);
      assert.equal((await page.evaluate(labelMessages)).length, 2, 'a host setting is not reported back');
      assert.deepEqual(page.exceptions, []);
    } finally {
      await browser.closePage(page);
    }
  });

  test('a policy draws its title, an actor with its name, a timer with its text; without fields it draws as before', async () => {
    const page = await openPage();
    try {
      await page.evaluate(post(bundle([
        flowNode('policy:Plain', 'POLICY', 40, { label: 'Plain' }),
        flowNode('policy:Titled', 'POLICY', 280, { label: 'Hidden label', title: 'Notify customer' }),
        flowNode('policy:Actor', 'POLICY', 520, { label: 'A', policyKind: 'actor', actor: 'Customer' }),
        flowNode('policy:Timer', 'POLICY', 760, { label: 'T', policyKind: 'timer', timer: 'every day' }),
      ])));
      await page.waitFor(`${nodeText('policy:Timer')} !== null`);
      assert.equal(await page.evaluate(`document.querySelectorAll('.eventflow-policy-trigger').length`), 2);
      assert.equal(await page.evaluate(`document.querySelectorAll('.react-flow__node[data-id="policy:Plain"] svg').length`), 0);
      assert.match(await page.evaluate(nodeText('policy:Titled')), /Notify customer/);
      assert.doesNotMatch(await page.evaluate(nodeText('policy:Titled')), /Hidden/);
      assert.match(await page.evaluate(nodeText('policy:Actor')), /Customer/);
      assert.match(await page.evaluate(nodeText('policy:Timer')), /every day/);
      assert.equal(await page.evaluate(`document.querySelectorAll('.eventflow-policy-trigger svg').length`), 2);
      assert.deepEqual(page.exceptions, []);
    } finally {
      await browser.closePage(page);
    }
  });
});
