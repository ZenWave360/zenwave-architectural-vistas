import type { SavedPositions } from '@zenwave360/vistas-eventflow-page';

/** The button appears once a node was moved in the full diagram. Its parent decides when that is. */
export function SavePositionsButton({ onSave }: { onSave: () => void }) {
  return (
    <button type="button" className="save-positions" onClick={onSave}>Save positions</button>
  );
}

/**
 * What the host did with the flow's saved positions, for the status bar. Nothing is shown when none exist or the host
 * did not say. A layout that did not match is noted with the count of nodes it lacked, when known; the full list is the tooltip.
 */
export function SavedPositionsStatus({ saved }: { saved: SavedPositions | undefined }) {
  if (!saved?.exists) return null;
  if (saved.applied) {
    return <span className="status-message status-message--applied">Saved layout</span>;
  }
  const missing = saved.missing !== undefined && saved.missing.length > 0 ? saved.missing : undefined;
  return (
    <span className="status-message" role="status" title={missing?.join(', ')}>
      Saved positions do not match this flow; automatic layout{missing ? ` (${missing.length} missing)` : ''}
    </span>
  );
}
