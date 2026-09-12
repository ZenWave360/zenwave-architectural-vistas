import { Handle, NodeProps, Position } from 'reactflow';
import { SourceRef } from '../types/FlowViewModel';

export interface StartNodeData {
  label: string;
  endOutcomeLabels?: string[];
  sourceRef?: SourceRef;
  title?: string;
}

export function StartNode({ data }: NodeProps<StartNodeData>) {
  return (
    <div className="eventflow-start-node-shell" title={data.title}>
      <div className="node-role-badge node-role-badge-start">START</div>
      {data.endOutcomeLabels && data.endOutcomeLabels.length > 0 ? (
        <div className="node-role-badge node-role-badge-end-outcome">
          {data.endOutcomeLabels.join(', ')}
        </div>
      ) : null}
      <div className="eventflow-start-node">
        <div className="node-header">
          <strong>{data.label}</strong>
        </div>
        <Handle type="source" position={Position.Right} />
      </div>
    </div>
  );
}
