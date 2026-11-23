import { isLanesMode } from '@zenwave360/vistas-eventflow/react';
import type { LanesMode } from '@zenwave360/vistas-eventflow-page';

export function LanesControl({ lanes, onUserChange }: { lanes: LanesMode; onUserChange: (lanes: LanesMode) => void }) {
  return (
    <label className="lanes-control">
      <span>Lanes</span>
      <select value={lanes} onChange={(event) => {
        if (isLanesMode(event.target.value)) onUserChange(event.target.value);
      }}>
        <option value="none">No lanes</option>
        <option value="systems">Systems</option>
        <option value="services">Services</option>
      </select>
    </label>
  );
}
