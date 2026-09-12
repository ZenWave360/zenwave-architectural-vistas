import type { NodeProps } from 'reactflow';

export interface ServiceGroupNodeData {
  legendLabel: string;
  centerLabel: string;
  centerX?: number;
  centerWidth?: number;
  title?: string;
}

export function ServiceGroupNode({ data }: NodeProps<ServiceGroupNodeData>) {
  return (
    <div className="service-map-group-node">
      <div className="service-map-group-shell">
        <div className="service-map-group-legend" title={data.title}>{data.legendLabel}</div>
        <div
          className="service-map-group-label"
          title={data.title}
          style={{
            left: data.centerX,
            width: data.centerWidth,
          }}
        >
          {data.centerLabel}
        </div>
      </div>
    </div>
  );
}
