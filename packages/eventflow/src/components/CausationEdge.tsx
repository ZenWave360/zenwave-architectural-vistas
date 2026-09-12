import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from 'reactflow';
import { FlowEdgeType } from '../types/FlowViewModel';

interface EventFlowEdgeData {
  edgeType?: FlowEdgeType;
}

function getEdgeStroke(edgeType: FlowEdgeType | undefined): string {
  if (edgeType === FlowEdgeType.ERROR) return '#dc2626';
  if (edgeType === FlowEdgeType.CALL) return '#2563eb';
  if (edgeType === FlowEdgeType.OUTCOME_HANDLER) return '#ea580c';
  if (edgeType === FlowEdgeType.TRIGGER) return '#7c3aed';
  if (edgeType === FlowEdgeType.CONDITIONAL) return '#0f766e';
  return '#64748b';
}

function getEdgeDasharray(edgeType: FlowEdgeType | undefined): string | undefined {
  if (edgeType === FlowEdgeType.CALL) return '14 8';
  if (edgeType === FlowEdgeType.OUTCOME_HANDLER) return '3 6';
  if (edgeType === FlowEdgeType.TRIGGER) return '6 4';
  if (edgeType === FlowEdgeType.CONDITIONAL) return '10 6';
  if (edgeType === FlowEdgeType.ERROR) return '3 3';
  return undefined;
}

export function CausationEdge(props: EdgeProps<EventFlowEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath(props);
  const edgeType = props.data?.edgeType;
  const stroke = getEdgeStroke(edgeType);
  const dasharray = getEdgeDasharray(edgeType);

  return (
    <>
      <BaseEdge
        id={props.id}
        path={edgePath}
        markerEnd={props.markerEnd}
        style={{
          stroke,
          strokeWidth: 2.5,
          strokeDasharray: dasharray,
        }}
      />
      {props.label && (
        <EdgeLabelRenderer>
          <div
            className="eventflow-edge-label"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {props.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
