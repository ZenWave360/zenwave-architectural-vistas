import { Handle, NodeProps, Position } from 'reactflow';
import { SourceRef } from '../types/FlowViewModel';

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
}

export function PolicyNode({ data }: NodeProps<PolicyNodeData>) {
  return (
    <div className="eventflow-policy-node" title={data.title}>
      {data.endOutcomeLabels && data.endOutcomeLabels.length > 0 ? (
        <div className="node-role-badge node-role-badge-end-outcome">
          {data.endOutcomeLabels.join(', ')}
        </div>
      ) : null}
      <Handle type="target" position={Position.Left} />
      {data.policyLabelParts ? (
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
