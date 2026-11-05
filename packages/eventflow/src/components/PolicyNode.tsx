import { Handle, NodeProps, Position } from 'reactflow';
import { SourceRef } from '../types/FlowViewModel';
import type { PolicyKind } from '../policyDrawing';
import { StartIcon } from './StartNode';

export interface PolicyNodeData {
  label: string;
  endOutcomeLabels?: string[];
  sourceRef?: SourceRef;
  title?: string;
  policyLabelParts?: {
    when: string;
    condition: string;
    do: string;
    action: string;
  };
  /** Drawn in place of the label. */
  policyTitle?: string;
  policyKind?: PolicyKind;
  /** Actor name or timer text, drawn with the icon of policyKind. */
  policyDetail?: string;
}

function HourglassIcon() {
  return (
    <svg
      className="eventflow-start-icon eventflow-start-icon-hourglass"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 2h12M6 22h12M7 2c0 6 5 7 5 10s-5 4-5 10M17 2c0 6-5 7-5 10s5 4 5 10" />
    </svg>
  );
}

export function PolicyNode({ data }: NodeProps<PolicyNodeData>) {
  return (
    <div
      className={data.policyKind && data.policyDetail ? 'eventflow-policy-node eventflow-policy-node--with-trigger' : 'eventflow-policy-node'}
      title={data.title}
    >
      {data.endOutcomeLabels && data.endOutcomeLabels.length > 0 ? (
        <div className="node-role-badge node-role-badge-end-outcome">
          {data.endOutcomeLabels.join(', ')}
        </div>
      ) : null}
      <Handle type="target" position={Position.Left} />
      {data.policyKind && data.policyDetail ? (
        <div className="eventflow-policy-trigger" title={data.policyDetail}>
          {data.policyKind === 'actor' ? <StartIcon kind="actor" /> : <HourglassIcon />}
          <span>{data.policyDetail}</span>
        </div>
      ) : null}
      {data.policyTitle ? (
        <div className="node-header">
          <strong>{data.policyTitle}</strong>
        </div>
      ) : data.policyLabelParts ? (
        <div className="node-header eventflow-policy-label">
          <span className="eventflow-policy-keyword">{data.policyLabelParts.when}</span>
          <strong className="eventflow-policy-condition">{data.policyLabelParts.condition}</strong>
          <span className="eventflow-policy-keyword">{data.policyLabelParts.do}</span>
          <strong className="eventflow-policy-action">{data.policyLabelParts.action}</strong>
        </div>
      ) : (
        <div className="node-header">
          <strong>{data.label}</strong>
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
