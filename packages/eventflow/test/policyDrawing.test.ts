// EF-R21: a policy draws its title, and an actor or timer with its icon; absent fields draw as before.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readPolicyDrawing } from '../src/policyDrawing.ts';

test('title, actor and timer are read from the node', () => {
  assert.deepEqual(readPolicyDrawing({ title: 'Notify customer' }), { title: 'Notify customer' });
  assert.deepEqual(readPolicyDrawing({ policyKind: 'actor', actor: 'Customer' }), { kind: 'actor', detail: 'Customer' });
  assert.deepEqual(readPolicyDrawing({ policyKind: 'timer', timer: 'every day' }), { kind: 'timer', detail: 'every day' });
});

test('the detail follows the kind', () => {
  assert.deepEqual(readPolicyDrawing({ policyKind: 'timer', actor: 'Customer' }), {});
});

test('absent, blank or unknown fields draw as today', () => {
  assert.deepEqual(readPolicyDrawing({}), {});
  assert.deepEqual(readPolicyDrawing({ title: '  ', policyKind: 'actor', actor: ' ' }), {});
  assert.deepEqual(readPolicyDrawing({ policyKind: 'robot', actor: 'x' }), {});
});

test('PolicyNode uses inline SVG only', () => {
  const source = readFileSync(new URL('../src/components/PolicyNode.tsx', import.meta.url), 'utf8');
  assert.match(source, /<svg/);
  assert.doesNotMatch(source, /https?:\/\/|<img/);
});
