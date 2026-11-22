// EF-R25: the variant dropdown is a tree grouped by outcome, drawn with non-breaking spaces so a native select keeps it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { chosenVariantTitle, runLabel, variantOptionGroups } from '../src/variantTree.ts';

const leaf = (id: string, steps: string[], title: string) => ({ id, steps, title, count: 1, children: [] });
const tree = [
  {
    outcome: 'completed',
    nodes: [{
      id: 'branch:completed:0',
      steps: ['Start', 'reserved'],
      title: 'from Start → reserved to completed',
      count: 3,
      children: [
        {
          id: 'branch:completed:0.0',
          steps: ['authorized'],
          title: 'from Start → reserved → authorized to completed',
          count: 2,
          children: [
            leaf('sequence:completed:0', ['shipped'], 'from Start → reserved → authorized → shipped to completed'),
            leaf('sequence:completed:1', ['pickup'], 'from Start → reserved → authorized → pickup to completed'),
          ],
        },
        leaf('sequence:completed:2', ['retried'], 'from Start → reserved → retried to completed'),
      ],
    }],
  },
  { outcome: 'failed', nodes: [leaf('sequence:failed:3', ['Start', 'declined'], 'from Start → declined to failed')] },
];

const nbsp = (text: string) => text.replace(/ /g, '\u00a0');

test('one group per outcome in the host order, options in tree order', () => {
  const groups = variantOptionGroups(tree);
  assert.deepEqual(groups.map((group) => group.label), ['completed', 'failed']);
  assert.deepEqual(groups[0].options.map((option) => option.value), [
    'branch:completed:0', 'branch:completed:0.0', 'sequence:completed:0', 'sequence:completed:1', 'sequence:completed:2',
  ]);
});

test('lines show only the steps they add, indented with ├─ │ └─ and non-breaking spaces', () => {
  const labels = variantOptionGroups(tree)[0].options.map((option) => option.label);
  assert.deepEqual(labels, [
    nbsp('Start → reserved (3)'),
    nbsp('├─ authorized (2)'),
    nbsp('│  ├─ shipped'),
    nbsp('│  └─ pickup'),
    nbsp('└─ retried'),
  ].map((label) => label.replace('├─\u00a0', '├─\u00a0')));
  assert.ok(labels.every((label) => !label.includes(' ')), 'no breaking space survives');
});

test('the tooltip is the full title, with the number of variants for a line that has several', () => {
  const options = variantOptionGroups(tree)[0].options;
  assert.equal(options[0].title, 'from Start → reserved to completed (3 variants)');
  assert.equal(options[2].title, 'from Start → reserved → authorized → shipped to completed');
  assert.equal(chosenVariantTitle(tree, 'sequence:failed:3'), 'from Start → declined to failed');
  assert.equal(chosenVariantTitle(tree, 'branch:completed:0.0'), 'from Start → reserved → authorized to completed (2 variants)');
  assert.equal(chosenVariantTitle(tree, 'nope'), undefined);
});

test('a long run is shortened with an ellipsis, a short one is not', () => {
  assert.equal(runLabel(['a', 'b', 'c']), 'a → b → c');
  assert.equal(runLabel(['a', 'b', 'c', 'd', 'e']), 'a → … → e');
});

test('a variant that ends at a line with others under it is a leaf that adds no steps, and stays selectable', () => {
  const groups = variantOptionGroups([{
    outcome: 'x',
    nodes: [{
      id: 'branch:x:1', steps: ['A', 'x'], title: 'from A → x to x', count: 2,
      children: [leaf('v0', [], 'from A → x to x'), leaf('v1', ['y'], 'from A → x → y to x')],
    }],
  }]);
  assert.deepEqual(groups[0].options.map((option) => [option.value, option.label]), [
    ['branch:x:1', nbsp('A → x (2)')], ['v0', nbsp('├─ (ends here)')], ['v1', nbsp('└─ y')],
  ]);
});

test('a group with several roots draws no connector for the roots', () => {
  const groups = variantOptionGroups([{ outcome: 'x', nodes: [leaf('a', ['A', 'x'], 't'), leaf('b', ['B', 'y'], 't')] }]);
  assert.deepEqual(groups[0].options.map((option) => option.label), [nbsp('A → x'), nbsp('B → y')]);
});
