import { Handle, NodeProps, Position } from 'reactflow';
import { SourceRef } from '../types/FlowViewModel';
import { getStartIconKind, StartKind } from '../startIcon';

export interface StartNodeData {
  label: string;
  endOutcomeLabels?: string[];
  sourceRef?: SourceRef;
  title?: string;
  startKind?: string | null;
  actor?: string | null;
}

function StartIcon({ kind }: { kind: StartKind }) {
  return (
    <svg
      className={`eventflow-start-icon eventflow-start-icon-${kind}`}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'actor' ? (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
        </>
      ) : null}
      {kind === 'timer' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      ) : null}
      {kind === 'system' ? (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
        </>
      ) : null}
    </svg>
  );
}

export function StartNode({ data }: NodeProps<StartNodeData>) {
  const iconKind = getStartIconKind(data.startKind);
  const actor = data.actor?.trim();

  return (
    <div className="eventflow-start-node-shell" title={data.title}>
      <div className="node-role-badge node-role-badge-start">START</div>
      {data.endOutcomeLabels && data.endOutcomeLabels.length > 0 ? (
        <div className="node-role-badge node-role-badge-end-outcome">
          {data.endOutcomeLabels.join(', ')}
        </div>
      ) : null}
      <div className="eventflow-start-node">
        {iconKind || actor ? (
          <div className="eventflow-start-content">
            {actor ? <div className="eventflow-start-actor">{actor}</div> : null}
            <div className="eventflow-start-line">
              {iconKind ? <StartIcon kind={iconKind} /> : null}
              <div className="node-header">
                <strong>{data.label}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="node-header">
            <strong>{data.label}</strong>
          </div>
        )}
        <Handle type="source" position={Position.Right} />
      </div>
    </div>
  );
}
