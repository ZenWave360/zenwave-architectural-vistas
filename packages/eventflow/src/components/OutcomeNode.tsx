import { Handle, NodeProps, Position } from 'reactflow';

export interface OutcomeNodeData {
  label: string;
  synthetic: true;
}

export function OutcomeNode({ data }: NodeProps<OutcomeNodeData>) {
  return (
    <div className="eventflow-outcome-node">
      <Handle type="target" position={Position.Left} />
      <div className="node-header">{data.label}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
