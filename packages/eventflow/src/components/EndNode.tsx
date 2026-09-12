import { Handle, NodeProps, Position } from 'reactflow';
import { SourceRef } from '../types/FlowViewModel';

export interface EndNodeData {
  label: string;
  endOutcomeLabels?: string[];
  sourceRef?: SourceRef;
  title?: string;
}

export function EndNode({ data }: NodeProps<EndNodeData>) {
  return (
    <div className="eventflow-end-node" title={data.title}>
      {data.endOutcomeLabels && data.endOutcomeLabels.length > 0 ? (
        <div className="node-role-badge node-role-badge-end-outcome">
          {data.endOutcomeLabels.join(', ')}
        </div>
      ) : null}
      <Handle type="target" position={Position.Left} />
      <div className="node-header">
        <strong>{data.label}</strong>
      </div>
    </div>
  );
}
