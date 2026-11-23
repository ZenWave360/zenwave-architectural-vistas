// EF-R15: a CALL edge is drawn solid; the other edge types keep their dashes.
import assert from 'node:assert/strict';
import test from 'node:test';
import { getEdgeDasharray, getEdgeStroke } from '../src/edgeStyle.ts';

test('CALL edge has no dasharray and keeps its colour', () => {
  assert.equal(getEdgeDasharray('CALL'), undefined);
  assert.equal(getEdgeStroke('CALL'), '#2563eb');
});

test('other edge types keep their dashes', () => {
  assert.equal(getEdgeDasharray('OUTCOME_HANDLER'), '3 6');
  assert.equal(getEdgeDasharray('TRIGGER'), '6 4');
  assert.equal(getEdgeDasharray('CONDITIONAL'), '10 6');
  assert.equal(getEdgeDasharray('ERROR'), '3 3');
  assert.equal(getEdgeDasharray('CAUSATION'), undefined);
});
