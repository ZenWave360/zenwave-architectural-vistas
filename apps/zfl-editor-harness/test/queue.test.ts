import assert from 'node:assert/strict';
import test from 'node:test';
import type { EditOutcome, Intent } from '../src/adapter.ts';
import { createCommitField } from '../src/commitField.ts';
import { createIntentQueue } from '../src/intentQueue.ts';
import { createMockEditingAdapter, prepareMockEdit } from '../src/mockAdapter.ts';
import { applyEdits } from '../src/applyEdits.ts';

const rename = (newName: string): Intent => ({ op: 'renameCommand', flowName: 'F', oldName: 'a', newName });
const applied: EditOutcome = { status: 'applied', edits: [], identityMappings: [] };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('queue sends one intent at a time, in order', async () => {
  const log: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const queue = createIntentQueue(async (intent) => {
    inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight);
    log.push((intent as { newName: string }).newName);
    await tick();
    inFlight -= 1;
    return applied;
  });
  queue.enqueue(rename('b')); queue.enqueue(rename('c')); queue.enqueue(rename('d'));
  assert.deepEqual(queue.items().map((i) => i.state), ['inflight', 'pending', 'pending']);
  while (queue.items().length) await tick();
  assert.deepEqual(log, ['b', 'c', 'd']);
  assert.equal(maxInFlight, 1);
});

test('a rejection cancels and lists the trailing intents; discard removes them', async () => {
  const sent: string[] = [];
  const queue = createIntentQueue(async (intent) => {
    sent.push((intent as { newName: string }).newName);
    return { status: 'invalid', messages: ['nope'] };
  });
  queue.enqueue(rename('b')); queue.enqueue(rename('c')); queue.enqueue(rename('d'));
  await tick(); await tick();
  assert.deepEqual(sent, ['b']);
  const items = queue.items();
  assert.deepEqual(items.map((i) => i.state), ['rejected', 'cancelled', 'cancelled']);
  assert.match(items[0].reason!, /invalid: nope/);
  assert.match(items[1].reason!, /cancelled/);
  assert.equal(queue.discard(items[0].id), true);
  assert.equal(queue.items().length, 2);
});

test('an in-flight intent cannot be discarded; a pending one can', async () => {
  const queue = createIntentQueue(async () => { await tick(); return applied; });
  const first = queue.enqueue(rename('b'));
  const second = queue.enqueue(rename('c'));
  assert.equal(queue.discard(first), false);
  assert.equal(queue.discard(second), true);
  while (queue.items().length) await tick();
});

test('commit field: Enter commits once, and the blur that follows does not commit again', () => {
  const commits: string[] = [];
  const field = createCommitField('a', (v) => commits.push(v));
  field.change('b'); field.change('bc');
  assert.deepEqual(commits, []);
  field.enter(); field.blur();
  assert.deepEqual(commits, ['bc']);
});

test('commit field: leaving the field commits', () => {
  const commits: string[] = [];
  const field = createCommitField('a', (v) => commits.push(v));
  field.change('x'); field.blur();
  assert.deepEqual(commits, ['x']);
});

test('commit field: Escape cancels, and the blur it causes does not commit', () => {
  const commits: string[] = [];
  const field = createCommitField('a', (v) => commits.push(v));
  field.change('zzz');
  field.escape();
  assert.equal(field.value, 'a');
  field.blur();
  assert.deepEqual(commits, []);
  field.change('q'); field.blur();
  assert.deepEqual(commits, ['q']);
});

test('applyEdits rejects negative and non-integer offsets', () => {
  assert.throws(() => applyEdits('abc', [{ start: -1, end: 1, replacement: '' }]));
  assert.throws(() => applyEdits('abc', [{ start: 0.5, end: 1, replacement: '' }]));
});

test('mock engine applies a rename, and answers stale for another revision', async () => {
  const text = 'flow F {\n  when X do a {\n    call a2\n  }\n}';
  const outcome = prepareMockEdit(text, rename('b'));
  assert.equal(outcome.status, 'applied');
  const base = { capabilities: () => [], setText: async (_t: string, revision: number) => ({ revision, flowGraph: null, diagnostics: [], invalid: false }), prepareEdit: async () => applied, dispose() {} };
  const mock = createMockEditingAdapter(base);
  await mock.setText(text, 3);
  assert.equal((await mock.prepareEdit(rename('b'), 2)).status, 'stale');
  assert.equal((await mock.prepareEdit(rename('b'), 3)).status, 'applied');
  assert.equal(prepareMockEdit(text, rename('1bad')).status, 'invalid');
});
