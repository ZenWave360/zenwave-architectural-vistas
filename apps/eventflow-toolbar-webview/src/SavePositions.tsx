import type { SavedPositions } from '@zenwave360/vistas-eventflow-page';

/** The button appears once a node was moved in the full diagram. Its parent decides when that is. */
export function SavePositionsButton({ onSave, disabled = false }: { onSave: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="save-positions" onClick={onSave} disabled={disabled} title={disabled ? 'Lanes use automatic layout' : undefined}>Save positions</button>
  );
}

/**
 * What the host did with the flow's saved positions, for the status bar. Nothing is shown when none exist or the host
 * did not say. A layout that did not match is noted with the count of nodes it lacked, when known; the full list is the tooltip.
 * A failed save (EF-R22) replaces the note until the next save click or renderBundle.
 */
export function SavedPositionsStatus({ saved, failure }: { saved: SavedPositions | undefined; failure?: string }) {
  if (failure !== undefined) {
    return <span className="status-message status-message--failed" role="alert" title={failure}>Positions not saved: {failure}</span>;
  }
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
