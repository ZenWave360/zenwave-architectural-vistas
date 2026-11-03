// Exercise diagram identity through the published host messages and real pan/zoom controls.
import assert from 'node:assert/strict';
import process from 'node:process';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findBrowser, launchBrowser } from './support/browser.mjs';
import { startServer } from './support/server.mjs';

const executable = findBrowser();
if (!executable && (process.env.CI || process.env.ZENWAVE_REQUIRE_BROWSER === 'true')) {
  throw new Error('Set ZENWAVE_TEST_BROWSER to run the webview browser tests.');
}
const skip = executable ? false : 'no Chromium-based browser found; set ZENWAVE_TEST_BROWSER';

function node(id, type, x, file = '/flows/checkout.zfl') {
  return {
    id, type, label: id, system: null, service: null,
    sourceRef: { file, line: 1, column: 1 },
    position: { x, y: 400 }, dimensions: { width: 180, height: 112 },
  };
}

function graph(nodes) {
  return { schema: 'zfl.eventflow.view@1', nodes, edges: [], layout: null, bounds: null, systemGroups: null };
}

const transform = `document.querySelector('.react-flow__viewport').style.transform`;
const frames = `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))`;

describe('opening viewport diagram identity', { skip }, () => {
  let server;
  let browser;
  before(async () => {
    server = await startServer(fileURLToPath(new URL('../webview-toolbar/', import.meta.url)));
    browser = await launchBrowser(executable);
  });
  after(async () => {
    await browser?.close();
    await server?.close();
  });

  async function render(page, nodes, diagramId) {
    const payload = { flowGraph: graph(nodes), serviceGraph: null, viewMode: 'flow' };
    if (diagramId !== undefined) payload.diagramId = diagramId;
    await page.evaluate(`window.postMessage(${JSON.stringify({ type: 'renderBundle', payload })}, '*')`);
    await page.waitFor(`${JSON.stringify(nodes.map(n => ({ id: n.id, x: n.position.x })))}.every(({id, x}) => {
      const element = document.querySelector('.react-flow__node[data-id="' + CSS.escape(id) + '"]');
      return element && element.style.transform.includes('translate(' + x + 'px,');
    })`);
    await page.evaluate(frames);
  }

  async function openFlow(diagramId) {
    const page = await browser.newPage();
    await page.goto(`${server.origin}/webview/index.html`);
    await page.waitFor(`typeof window.renderBundle === 'function'`);
    await render(page, [node('event:Start', 'START', 0), node('command:Far', 'COMMAND', 40000)], diagramId);
    return page;
  }

  async function assertAdditionKeepsViewport(diagramId) {
    const page = await openFlow(diagramId);
    try {
      const userViewport = await moveViewport(page);
      // A refresh that only moves existing nodes already preserves the viewport.
      await render(page, [node('event:Start', 'START', 0), node('command:Far', 'COMMAND', 41000)], diagramId);
      assert.equal(await page.evaluate(transform), userViewport, 'same nodes with new positions preserve the viewport');
      await render(page, [
        node('event:Start', 'START', 0), node('command:Far', 'COMMAND', 41000),
        node('command:Added', 'COMMAND', 42000),
      ], diagramId);
      assert.equal(await page.evaluate(transform), userViewport, 'adding one node to the same flow must preserve the viewport');
    } finally {
      await browser.closePage(page);
    }
  }

  async function moveViewport(page) {
    const initial = await page.evaluate(transform);
    await page.evaluate(`document.querySelector('.react-flow__controls-zoomin').click()`);
    await page.waitFor(`${transform} !== ${JSON.stringify(initial)}`);
    // Drag empty canvas, away from nodes, controls and the minimap.
    const point = await page.evaluate(`(() => {
      const box = document.querySelector('.react-flow__pane').getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + 60 };
    })()`);
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x + 90, y: point.y + 50, button: 'left', buttons: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x + 90, y: point.y + 50, button: 'left', buttons: 0, clickCount: 1 });
    await page.evaluate(frames);
    return page.evaluate(transform);
  }

  test('adding a node during a refresh preserves the user pan and zoom', async () => {
    await assertAdditionKeepsViewport(undefined);
  });

  test('the same diagramId with changed nodes keeps the user pan and zoom', async () => {
    await assertAdditionKeepsViewport('file:///flows/checkout.zfl#Checkout');
  });

  test('a different source flow with its own diagramId receives its opening viewport', async () => {
    const page = await openFlow('file:///flows/checkout.zfl#Checkout');
    try {
      await moveViewport(page);
      await render(page, [
        node('event:Start', 'START', 20000, '/flows/other.zfl'),
        node('command:Far', 'COMMAND', 60000, '/flows/other.zfl'),
      ], 'file:///flows/other.zfl#Checkout');
      await page.waitFor(`(() => {
        const pane = document.querySelector('.react-flow');
        const start = document.querySelector('.react-flow__node[data-id="event:Start"]');
        if (!pane || !start) return false;
        const paneBox = pane.getBoundingClientRect();
        const startBox = start.getBoundingClientRect();
        const left = startBox.left - paneBox.left;
        const right = startBox.right - paneBox.left;
        return paneBox.width > 200 && left >= 0 && right <= paneBox.width * 0.25;
      })()`);
      const placement = await page.evaluate(`(() => {
        const pane = document.querySelector('.react-flow').getBoundingClientRect();
        const start = document.querySelector('.react-flow__node[data-id="event:Start"]').getBoundingClientRect();
        return { left: start.left - pane.left, right: start.right - pane.left, width: pane.width };
      })()`);
      assert.ok(placement.left >= 0 && placement.right <= placement.width * 0.25,
        `new flow's start should open near the left edge: ${JSON.stringify(placement)}`);
      assert.deepEqual(page.exceptions, []);
    } finally {
      await browser.closePage(page);
    }
  });

  test('review: changing diagramId from a string to undefined receives an opening viewport', async () => {
    const page = await openFlow('file:///flows/checkout.zfl#Checkout');
    try {
      await moveViewport(page);
      await render(page, [node('event:Start', 'START', 20000), node('command:Far', 'COMMAND', 60000)], undefined);
      const left = await page.evaluate(`(() => {
        const pane = document.querySelector('.react-flow').getBoundingClientRect();
        const start = document.querySelector('.react-flow__node[data-id="event:Start"]').getBoundingClientRect();
        return { x: start.left - pane.left, width: pane.width };
      })()`);
      assert.ok(left.x >= 0 && left.x < left.width / 4, JSON.stringify(left));
    } finally {
      await browser.closePage(page);
    }
  });

  test('review: a flow mounted in a zero-size pane frames when the pane grows', async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${server.origin}/webview/index.html`);
      await page.waitFor(`typeof window.renderBundle === 'function'`);
      await page.evaluate(`document.getElementById('root').style.cssText = 'display:none'`);
      await render(page, [node('event:Start', 'START', 20000), node('command:Far', 'COMMAND', 60000)], 'hidden');
      await page.evaluate(`document.getElementById('root').style.cssText = ''`);
      await page.waitFor(`(() => {
        const pane = document.querySelector('.react-flow').getBoundingClientRect();
        const start = document.querySelector('.react-flow__node[data-id="event:Start"]').getBoundingClientRect();
        const x = start.left - pane.left;
        return pane.width > 500 && Math.abs(x - pane.width / 22) < 2;
      })()`);
    } finally {
      await browser.closePage(page);
    }
  });

});
