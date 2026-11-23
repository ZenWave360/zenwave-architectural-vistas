// EF-R16: READ_MODEL gets its own node component; an unknown type still renders as a plain node.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getNodeTypeKey } from '../src/nodeTypeKey.ts';

test('READ_MODEL maps to readModelNode, never the orange event node', () => {
  assert.equal(getNodeTypeKey('READ_MODEL'), 'readModelNode');
  assert.notEqual(getNodeTypeKey('READ_MODEL'), getNodeTypeKey('EVENT'));
});

test('known types keep their node keys', () => {
  assert.equal(getNodeTypeKey('START'), 'startNode');
  assert.equal(getNodeTypeKey('COMMAND'), 'commandNode');
  assert.equal(getNodeTypeKey('EVENT'), 'eventNode');
  assert.equal(getNodeTypeKey('POLICY'), 'policyNode');
  assert.equal(getNodeTypeKey('END'), 'endNode');
});

test('an unknown node type falls back to the plain event node', () => {
  assert.equal(getNodeTypeKey('SOMETHING_NEW'), 'eventNode');
  assert.equal(getNodeTypeKey(undefined), 'eventNode');
});

test('ReadModelNode is registered in the visualizer and exported', () => {
  const visualizer = readFileSync(new URL('../src/EventFlowVisualizer.tsx', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(visualizer, /readModelNode:\s*ReadModelNode/);
  assert.match(index, /export \{ ReadModelNode \}/);
});
