import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { isLanesMode } from '../src/labelFormatting.ts';

// Node's native TS runner does not parse TSX; compile just this component and isolate the viewport hook.
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/components/LaneBands.tsx', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
});
const exports = {} as { LaneBands: (props: { lanes: unknown[] }) => ReturnType<typeof createElement> };
new Function('require', 'exports', outputText)((name: string) => name === 'reactflow'
  ? { useViewport: () => ({ x: 12, y: 34, zoom: 0.5 }) } : require(name), exports);

const bands = [
  { id: 'last', kind: 'service', label: 'Unassigned', system: null, x: -20, y: 240, width: 980, height: 200, order: 1 },
  { id: 'first', kind: 'service', label: 'Checkout <API>', system: 'Store', x: -20, y: 40, width: 980, height: 200, order: 0 },
];

test('bands render once each in server order, with exact rectangles and safe labels', () => {
  const html = renderToStaticMarkup(createElement(exports.LaneBands, { lanes: bands }));
  assert.equal((html.match(/data-lane-id=/g) ?? []).length, 2);
  assert.ok(html.indexOf('data-lane-id="first"') < html.indexOf('data-lane-id="last"'));
  assert.match(html, /Checkout &lt;API&gt;/);
  assert.match(html, /Unassigned/);
  assert.match(html, /left:-20px;top:40px;width:980px;height:200px/);
  assert.match(html, /translate\(12px, 34px\) scale\(0.5\)/);
  assert.match(html, /eventflow-lane--alternate/);
  assert.equal(bands[0].id, 'last', 'rendering does not reorder the server model');
  assert.doesNotMatch(html, /tabindex|draggable|react-flow__node/);
});

test('an empty lanes array has no bands', () => {
  const html = renderToStaticMarkup(createElement(exports.LaneBands, { lanes: [] }));
  assert.doesNotMatch(html, /data-lane-id/);
});

test('only the three protocol lane modes are accepted', () => {
  for (const value of ['none', 'systems', 'services']) assert.equal(isLanesMode(value), true);
  for (const value of [null, undefined, '', 'system', 'flow', true, {}, 1]) assert.equal(isLanesMode(value), false);
});
