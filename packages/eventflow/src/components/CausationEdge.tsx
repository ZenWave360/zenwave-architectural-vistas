import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from 'reactflow';
import { FlowEdgeType } from '../types/FlowViewModel';
import { getEdgeDasharray, getEdgeStroke } from '../edgeStyle';

interface EventFlowEdgeData {
  edgeType?: FlowEdgeType;
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
