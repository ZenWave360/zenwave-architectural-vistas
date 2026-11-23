/** Humanize labels. onUserChange runs only for the user's own flip, never for a setting the host sent. */
export function HumanizeToggle({ humanize, onUserChange }: { humanize: boolean; onUserChange: (humanize: boolean) => void }) {
  return (
    <label className="humanize-toggle">
      <input type="checkbox" checked={humanize} onChange={(event) => onUserChange(event.target.checked)} />
      <span>Humanize labels</span>
    </label>
  );
}
