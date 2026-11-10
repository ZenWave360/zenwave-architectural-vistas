import type { PointerEvent } from 'react';
import { useViewport } from 'reactflow';
import type { FlowLane } from '../types/FlowViewModel';

export interface LaneBandsProps {
  lanes: readonly FlowLane[];
  /** With it, each lane title has a handle that moves the lane vertically; `deltaY` is in flow units. */
  onMoveLane?: (laneId: string, deltaY: number) => void;
}

/** A canvas background, outside React Flow's interactive nodes and below its renderer. */
export function LaneBands({ lanes, onMoveLane }: LaneBandsProps) {
  const { x, y, zoom } = useViewport();
  const ordered = [...lanes].sort((a, b) => a.order - b.order);
  const transform = `translate(${x}px, ${y}px) scale(${zoom})`;

  const startMove = (laneId: string) => (event: PointerEvent<HTMLElement>) => {
    if (!onMoveLane || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    let lastY = event.clientY;
    const move = (moveEvent: globalThis.PointerEvent) => {
      const delta = (moveEvent.clientY - lastY) / zoom;
      lastY = moveEvent.clientY;
      if (delta !== 0) onMoveLane(laneId, delta);
    };
    const stop = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', stop);
      target.removeEventListener('pointercancel', stop);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', stop);
    target.addEventListener('pointercancel', stop);
  };

  return (
    <>
      <div className="eventflow-lanes" style={{ transform }}>
        {ordered.map((lane) => (
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
      {onMoveLane ? (
        // above React Flow's renderer, so the handles can take the pointer; the layer itself lets everything through
        <div className="eventflow-lanes eventflow-lanes--handles" style={{ transform }}>
          {ordered.map((lane) => (
            <div
              key={lane.id}
              className="eventflow-lane__handle"
              data-lane-handle={lane.id}
              title="Drag to move the lane up or down"
              style={{ left: lane.x, top: lane.y }}
              onPointerDown={startMove(lane.id)}
            >
              <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" aria-hidden="true">
                <circle cx="9" cy="6" r="1.8" />
                <circle cx="15" cy="6" r="1.8" />
                <circle cx="9" cy="12" r="1.8" />
                <circle cx="15" cy="12" r="1.8" />
                <circle cx="9" cy="18" r="1.8" />
                <circle cx="15" cy="18" r="1.8" />
              </svg>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
