import type { FlowVariantGroup, FlowVariantNode } from './bootstrap';

/** One option of the variant dropdown. label is the indented line; title is the tooltip and what the toolbar shows once chosen. */
export interface VariantOption {
  value: string;
  label: string;
  title: string;
}

/** The options of one outcome, shown as an <optgroup>. */
export interface VariantOptionGroup {
  label: string;
  options: VariantOption[];
}

const NBSP = '\u00a0';
/** A run of more steps than this is shortened to its first and last step. */
const MAX_STEPS = 3;

/** The steps a line adds, joined as a title is; a variant that ends at a line with others under it adds none; a long run keeps its first and last step around an ellipsis. */
export function runLabel(steps: readonly string[]): string {
  if (steps.length === 0) return '(ends here)';
  const shown = steps.length > MAX_STEPS ? [steps[0], '…', steps[steps.length - 1]] : steps;
  return shown.join(' → ');
}

function lineTitle(node: FlowVariantNode): string {
  return node.count > 1 ? `${node.title} (${node.count} variants)` : node.title;
}

/**
 * The tree as <optgroup>s, one per outcome in the host's order (EF-R25). A native select keeps no markup, so the
 * tree is drawn with ├─ │ └─ and non-breaking spaces, which the select does not collapse. A line with children says how many variants it stands for.
 */
export function variantOptionGroups(tree: readonly FlowVariantGroup[]): VariantOptionGroup[] {
  return tree.map((group) => {
    const options: VariantOption[] = [];
    const visit = (nodes: readonly FlowVariantNode[], guide: string, nested: boolean) => {
      nodes.forEach((node, index) => {
        const last = index === nodes.length - 1;
        const connector = nested ? (last ? '└─' : '├─') : '';
        const text = runLabel(node.steps) + (node.children.length > 0 ? ` (${node.count})` : '');
        options.push({
          value: node.id,
          label: `${guide}${connector}${connector ? NBSP : ''}${text}`.replace(/ /g, NBSP),
          title: lineTitle(node),
        });
        visit(node.children, nested ? guide + (last ? '   ' : '│  ') : guide, true);
      });
    };
    visit(group.nodes, '', false);
    return { label: group.outcome, options };
  });
}

/** The full title of the line [id], for the toolbar. Undefined when the tree has no such line. */
export function chosenVariantTitle(tree: readonly FlowVariantGroup[], id: string): string | undefined {
  const find = (nodes: readonly FlowVariantNode[]): FlowVariantNode | undefined => {
    for (const node of nodes) {
      const found = node.id === id ? node : find(node.children);
      if (found) return found;
    }
    return undefined;
  };
  for (const group of tree) {
    const node = find(group.nodes);
    if (node) return lineTitle(node);
  }
  return undefined;
}
