import type { ViewMode } from '@zenwave360/vistas-eventflow-page';

const OPTIONS: ReadonlyArray<{ value: ViewMode; label: string }> = [
  { value: 'flow', label: 'Flow' },
  { value: 'services', label: 'Systems' },
];

/**
 * Flow / Systems selector. Native radio inputs give arrow-key navigation and a current-view indication to keyboards
 * and assistive technology. onUserChange runs only for the user's own choice, never for a view the host set.
 */
export function ViewSelector({ viewMode, onUserChange }: { viewMode: ViewMode; onUserChange: (viewMode: ViewMode) => void }) {
  return (
    <div className="view-selector" role="radiogroup" aria-label="Diagram view">
      {OPTIONS.map((option) => (
        <label key={option.value} className="view-selector__option">
          <input
            type="radio"
            name="eventflow-view"
            value={option.value}
            checked={viewMode === option.value}
            onChange={() => onUserChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
