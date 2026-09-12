import type { NodeProps } from 'reactflow';

export interface ServiceMapNodeData {
  label: string;
  title?: string;
}

export function ServiceCommandNode({ data }: NodeProps<ServiceMapNodeData>) {
  return (
    <div className="service-map-note service-map-note-command" title={data.title}>
      <strong>{data.label}</strong>
    </div>
  );
}

export function ServiceEventNode({ data }: NodeProps<ServiceMapNodeData>) {
  return (
    <div className="service-map-note service-map-note-event" title={data.title}>
      <strong>{data.label}</strong>
    </div>
  );
}
