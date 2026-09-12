import { NodeProps } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

export interface SystemGroupNodeData {
  label: string;
}

export function SystemGroupNode({ data, selected }: NodeProps<SystemGroupNodeData>) {
  return (
    <div className="eventflow-system-group">
      <NodeResizer
        color="#ff0071"
        isVisible={selected}
        minWidth={100}
        minHeight={50}
      />
      <div className="system-label">{data.label}</div>
    </div>
  );
}

