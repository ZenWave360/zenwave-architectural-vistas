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

describe('EventFlow humanize toggle and policy drawing', { skip }, () => {
  let server;
  let browser;

  before(async () => {
    server = await startServer(path.join(packageDirectory, 'webview-toolbar'));
    browser = await launchBrowser(executable);
  });

  after(async () => {
    await browser?.close();
    await server?.close();
  });

  async function openPage() {
    const page = await browser.newPage();
    await page.addInitScript(FAKE_VSCODE_API);
    await page.goto(`${server.origin}/webview/index.html`);
    await page.waitFor(`typeof window.renderBundle === 'function'`);
    return page;
  }

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
