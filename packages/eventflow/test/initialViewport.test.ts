// Opening viewport, without a browser. The anchor is the first node with start: true, which is the
// first start in view-model order once the visualizer has listed drawn nodes that way.
import assert from 'node:assert/strict';
import test from 'node:test';
import { computeInitialViewport, type ViewportNode } from '../src/initialViewport.ts';

const PANE = { viewportWidth: 1100, viewportHeight: 880, minZoom: 0.5, maxZoom: 2 };

function close(actual: number, expected: number, message: string) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} is not ${expected}`);
}

function screenLeft(node: ViewportNode, zoom: number, x: number) {
  return node.x * zoom + x;
}

function screenCenterY(node: ViewportNode, zoom: number, y: number) {
  return (node.y + node.height / 2) * zoom + y;
}

test('a diagram that fits opens at the fit zoom, anchored to the left, with the start vertically centred', () => {
  const start: ViewportNode = { x: 0, y: 100, width: 100, height: 100, start: true };
  const viewport = computeInitialViewport({
    ...PANE,
    nodes: [start, { x: 100, y: 100, width: 100, height: 100 }],
  });

  assert.ok(viewport);
  assert.equal(viewport.zoom, 2);
  // Left inset of a 1100px pane at React Flow's 0.1 padding, not the centred fit (x = 350).
  close(screenLeft(start, viewport.zoom, viewport.x), 50, 'start left');
  close(screenCenterY(start, viewport.zoom, viewport.y), 440, 'start vertical centre');
  assert.ok(Math.abs(viewport.x - 350) > 50);
});

test('a diagram that is too wide opens at the minimum zoom with its start near the left edge', () => {
  const start: ViewportNode = { x: 0, y: 300, width: 100, height: 80, start: true };
  const viewport = computeInitialViewport({
    ...PANE,
    nodes: [start, { x: 4000, y: 300, width: 100, height: 80 }],
  });

  assert.ok(viewport);
  assert.equal(viewport.zoom, PANE.minZoom);
  close(screenLeft(start, viewport.zoom, viewport.x), 50, 'start left');
  close(screenCenterY(start, viewport.zoom, viewport.y), 440, 'start vertical centre');
});

test('a diagram with no start node is centred, including at the minimum zoom', () => {
  const fitting = computeInitialViewport({
    nodes: [{ x: 10, y: 20, width: 200, height: 100 }],
    viewportWidth: 1100,
    viewportHeight: 880,
    // The limits ServiceMapVisualizer sets. Systems has no start and keeps this centred fit.
    minZoom: 0.15,
    maxZoom: 1.5,
  });

  assert.ok(fitting);
  assert.equal(fitting.zoom, 1.5);
  assert.equal(fitting.x, 385);
  assert.equal(fitting.y, 335);

  const tooWide = computeInitialViewport({
    ...PANE,
    nodes: [{ x: 0, y: 0, width: 5000, height: 100 }],
  });

  assert.ok(tooWide);
  assert.equal(tooWide.zoom, PANE.minZoom);
  close(tooWide.x, 1100 / 2 - 2500 * PANE.minZoom, 'centred horizontally at the minimum zoom');
  close(tooWide.y, 880 / 2 - 50 * PANE.minZoom, 'centred vertically at the minimum zoom');
});

test('several start nodes anchor on the first in the list, not the leftmost', () => {
  const first: ViewportNode = { x: 3000, y: 200, width: 100, height: 100, start: true };
  const leftmost: ViewportNode = { x: 0, y: 800, width: 100, height: 100, start: true };
  const viewport = computeInitialViewport({
    ...PANE,
    nodes: [first, leftmost],
  });

  assert.ok(viewport);
  assert.equal(viewport.zoom, PANE.minZoom);
  close(screenLeft(first, viewport.zoom, viewport.x), 50, 'first start left');
  close(screenCenterY(first, viewport.zoom, viewport.y), 440, 'first start vertical centre');
  assert.ok(screenLeft(leftmost, viewport.zoom, viewport.x) < 0, 'the later start is not the anchor');
});

test('when the diagram fits, a start that is not leftmost stays on screen with the whole diagram', () => {
  const first: ViewportNode = { x: 200, y: 0, width: 100, height: 100, start: true };
  const left: ViewportNode = { x: 0, y: 100, width: 100, height: 100 };
  const viewport = computeInitialViewport({
    ...PANE,
    nodes: [first, left],
  });

  assert.ok(viewport);
  assert.equal(viewport.zoom, 2);
  close(screenLeft(left, viewport.zoom, viewport.x), 50, 'diagram left');
  const firstLeft = screenLeft(first, viewport.zoom, viewport.x);
  const firstRight = firstLeft + first.width * viewport.zoom;
  assert.ok(firstLeft >= 0 && firstRight <= PANE.viewportWidth, 'the first start stays on screen');
  close(screenCenterY(first, viewport.zoom, viewport.y), 440, 'start vertical centre');
});

test('a start on the edge of a diagram that fills the pane stays inside the fit', () => {
  const start: ViewportNode = { x: 0, y: 0, width: 100, height: 40, start: true };
  const viewport = computeInitialViewport({
    ...PANE,
    nodes: [start, { x: 0, y: 360, width: 100, height: 40 }],
  });

  assert.ok(viewport);
  close(viewport.zoom, 2, 'zoom');
  const top = 0 * viewport.zoom + viewport.y;
  const bottom = 400 * viewport.zoom + viewport.y;
  assert.ok(top >= 40 - 1e-6 && bottom <= 840 + 1e-6, `diagram top ${top} bottom ${bottom} leaves the pane`);
});

test('there is no viewport for an empty diagram or an empty pane', () => {
  assert.equal(computeInitialViewport({ ...PANE, nodes: [] }), null);
  assert.equal(computeInitialViewport({ ...PANE, nodes: [{ x: 0, y: 0, width: 0, height: 10, start: true }] }), null);
  assert.equal(computeInitialViewport({ ...PANE, viewportWidth: 0, nodes: [{ x: 0, y: 0, width: 10, height: 10 }] }), null);
});

test('review: a diagram too tall to fit still anchors the first start at the left edge', () => {
  const start: ViewportNode = { x: 200, y: 1000, width: 100, height: 100, start: true };
  const viewport = computeInitialViewport({
    ...PANE,
    nodes: [start, { x: 0, y: 0, width: 100, height: 3000 }],
  });
  assert.ok(viewport);
  assert.equal(viewport.zoom, PANE.minZoom);
  close(screenLeft(start, viewport.zoom, viewport.x), 50, 'first start left when the whole diagram does not fit');
});

test('a whole diagram that fits the pane at the minimum zoom stays visible when the padding cannot', () => {
  const nodes = [
    { x: 200, y: 0, width: 100, height: 100, start: true },
    { x: 0, y: 1600, width: 100, height: 100 },
  ];
  const viewport = computeInitialViewport({
    nodes,
    viewportWidth: 1100,
    viewportHeight: 880,
    minZoom: 0.5,
    maxZoom: 2,
  });
  assert.ok(viewport);
  assert.equal(viewport.zoom, 0.5);
  assert.ok(1700 * viewport.zoom <= 880, 'the whole diagram fits in the pane');
  const top = viewport.y;
  const bottom = 1700 * viewport.zoom + viewport.y;
  assert.ok(top >= 0 && bottom <= 880, `diagram top ${top}, bottom ${bottom} must stay within 0..880`);
});

