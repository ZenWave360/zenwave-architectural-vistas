import { chosenVariantTitle, variantOptionGroups, type FlowVariant, type FlowVariantGroup } from '@zenwave360/vistas-eventflow-page';

/**
 * Full diagram first, then the variants. With a tree from the host (EF-R25) they are grouped by outcome, a prefix tree
 * of steps in each group; without one, the flat list in the order the host sent. A native select, as the preview's Diagram
 * selector is. onUserChange runs only for the user's own choice. The graph stays until the host sends the next bundle.
 */
export function VariantSelector({
  variants,
  variantTree,
  variantId,
  onUserChange,
}: {
  variants: readonly FlowVariant[];
  variantTree: readonly FlowVariantGroup[];
  variantId: string | null;
  onUserChange: (variantId: string | null) => void;
}) {
  if (variants.length === 0) return null;

  const groups = variantOptionGroups(variantTree);
  const chosen = variantId === null ? undefined : variantTree.length > 0
    ? chosenVariantTitle(variantTree, variantId)
    : variants.find((variant) => variant.id === variantId)?.title;

  return (
    <label className="variant-selector">
      <span>Variant</span>
      <select
        value={variantId ?? ''}
        title={chosen}
        onChange={(event) => onUserChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">Full diagram</option>
        {groups.length > 0
          ? groups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value} title={option.title}>{option.label}</option>
                ))}
              </optgroup>
            ))
          : variants.map((variant) => (
              <option key={variant.id} value={variant.id}>{variant.title}</option>
            ))}
      </select>
      {chosen !== undefined && <span className="variant-title" title={chosen}>{chosen}</span>}
    </label>
  );
}
