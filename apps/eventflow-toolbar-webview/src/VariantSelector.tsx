import type { FlowVariant } from '@zenwave360/vistas-eventflow-page';

/**
 * Full diagram and each variant, in the order the host sent them. A native select, as the preview's Diagram
 * selector is. onUserChange runs only for the user's own choice. The graph stays until the host sends the next bundle.
 */
export function VariantSelector({
  variants,
  variantId,
  onUserChange,
}: {
  variants: readonly FlowVariant[];
  variantId: string | null;
  onUserChange: (variantId: string | null) => void;
}) {
  if (variants.length === 0) return null;

  return (
    <label className="variant-selector">
      <span>Variant</span>
      <select
        value={variantId ?? ''}
        onChange={(event) => onUserChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">Full diagram</option>
        {variants.map((variant) => (
          <option key={variant.id} value={variant.id}>{variant.title}</option>
        ))}
      </select>
    </label>
  );
}
