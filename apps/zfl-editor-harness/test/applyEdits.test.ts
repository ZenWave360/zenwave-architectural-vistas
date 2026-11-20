import assert from 'node:assert/strict';
import test from 'node:test';
import { applyEdits } from '../src/applyEdits.ts';
import { firstFlowName } from '../src/operations.ts';

test('applies non-overlapping edits against the original offsets', () => {
  assert.equal(applyEdits('abcdef', [{ start: 4, end: 6, replacement: 'Z' }, { start: 0, end: 1, replacement: 'XY' }]), 'XYbcdZ');
});

test('rejects overlapping and out-of-range edits', () => {
  assert.throws(() => applyEdits('abc', [{ start: 0, end: 2, replacement: '' }, { start: 1, end: 2, replacement: '' }]));
  assert.throws(() => applyEdits('abc', [{ start: 2, end: 9, replacement: '' }]));
});

test('finds the first flow name', () => {
  assert.equal(firstFlowName('config { }\nflow BookSlotFlow {\n}'), 'BookSlotFlow');
  assert.equal(firstFlowName('config { }'), null);
});
