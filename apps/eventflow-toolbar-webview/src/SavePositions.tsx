import type { SavedPositions } from '@zenwave360/vistas-eventflow-page';

/** The button appears once a node was moved in the full diagram. Its parent decides when that is. */
export function SavePositionsButton({ onSave }: { onSave: () => void }) {
  return (
    <button type="button" className="save-positions" onClick={onSave}>Save positions</button>
  );
}

/**
 * What the host did with the flow's saved positions. Nothing is shown when none exist or the host did not say.
 * A layout that did not match is noted with the count of nodes it lacked, when known.
 */
export function SavedPositionsNote({ saved }: { saved: SavedPositions | undefined }) {
  if (!saved?.exists) return null;
  if (saved.applied) {
    return <span className="saved-positions-note saved-positions-note--applied">Saved layout</span>;
  }
  const missing = saved.missing !== undefined && saved.missing > 0 ? ` (${saved.missing} missing)` : '';
  return (
    <span className="saved-positions-note" role="status">
      Saved positions do not match this flow; automatic layout{missing}
    </span>
  );
}
