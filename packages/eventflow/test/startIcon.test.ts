// EF-R17: the START icon follows startKind; a missing or unknown kind draws no icon.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getStartIconKind } from '../src/startIcon.ts';

test('startKind picks the icon', () => {
  assert.equal(getStartIconKind('actor'), 'actor');
  assert.equal(getStartIconKind('timer'), 'timer');
  assert.equal(getStartIconKind('system'), 'system');
});

test('a missing or unknown startKind draws no icon', () => {
  assert.equal(getStartIconKind(undefined), null);
  assert.equal(getStartIconKind(null), null);
  assert.equal(getStartIconKind('robot'), null);
});

test('StartNode uses inline SVG only', () => {
  const source = readFileSync(new URL('../src/components/StartNode.tsx', import.meta.url), 'utf8');
  assert.match(source, /<svg/);
  assert.doesNotMatch(source, /https?:\/\/|<img/);
});
