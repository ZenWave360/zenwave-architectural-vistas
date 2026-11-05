import { useViewport } from 'reactflow';
import type { FlowLane } from '../types/FlowViewModel';

/** A canvas background, outside React Flow's interactive nodes and below its renderer. */
export function LaneBands({ lanes }: { lanes: readonly FlowLane[] }) {
  const { x, y, zoom } = useViewport();
  return (
    <div className="eventflow-lanes" style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})` }}>
      {[...lanes].sort((a, b) => a.order - b.order).map((lane) => (
        <div
          key={lane.id}
          className={`eventflow-lane${lane.order % 2 ? ' eventflow-lane--alternate' : ''}`}
          data-lane-id={lane.id}
          style={{ left: lane.x, top: lane.y, width: lane.width, height: lane.height }}
        >
          <span className="eventflow-lane__label">{lane.label}</span>
        </div>
      ))}
    </div>
  );
}
