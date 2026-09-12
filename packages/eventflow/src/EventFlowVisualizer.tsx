/**
 * EventFlow Visualizer - React Flow visualizer for FlowViewModel
 *
 * The component renders pre-computed flow positions and supports interactive
 * drag-based layout editing without performing automatic layout locally.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  applyNodeChanges,
  Background,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './styles/eventflow.css';

import { CommandNode } from './components/CommandNode';
import { EventNode } from './components/EventNode';
import { PolicyNode } from './components/PolicyNode';
import { StartNode } from './components/StartNode';
import { EndNode } from './components/EndNode';
import { OutcomeNode } from './components/OutcomeNode';
import { CausationEdge } from './components/CausationEdge';
import { DiagramDisplaySettings, humanizeLabel } from './labelFormatting';

import {
  Dimensions,
  FlowBounds,
  FlowEdgeType,
  FlowNode,
  FlowNodeType,
  FlowViewModel,
  Point,
  SourceRef,
} from './types/FlowViewModel';

export interface EventFlowVisualizerProps {
  flowViewModel: FlowViewModel;
  theme?: 'light' | 'dark';
  editable?: boolean;
  displaySettings?: EventFlowDisplaySettings;
  highlightedNodeIds?: string[];
  onNodeClick?: (nodeId: string, sourceRef?: SourceRef) => void;
  onSelectionChange?: (selectedNodes: string[], selectedEdges: string[]) => void;
  onFlowViewModelChange?: (updatedFlowViewModel: FlowViewModel) => void;
}

export interface EventFlowDisplaySettings extends DiagramDisplaySettings {}

interface EventFlowNodeData {
  label: string;
  endOutcomeLabels?: string[];
  sourceRef?: SourceRef;
  title?: string;
  synthetic?: boolean;
  policyLabelParts?: {
    when: string;
    condition: string;
    do: string;
    action: string;
  };
}

interface LegacyFlowNodeEndOutcome {
  endOutcomeLabels?: string[] | null;
}

const MIN_NODE_WIDTH = 180;
const MIN_NODE_HEIGHT = 112;
const OUTCOME_NODE_HEIGHT = 32;
const OUTCOME_NODE_MIN_WIDTH = 72;
const OUTCOME_NODE_MAX_WIDTH = 180;
const OUTCOME_NODE_MARGIN = 24;

type EventFlowReactNode = Node<EventFlowNodeData>;

interface SyntheticOutcomeRouting {
  nodes: EventFlowReactNode[];
  edges: Edge[];
  groupedEdgeIds: Set<string>;
}

function getRenderedDimensions(node: FlowNode): Dimensions {
  const baseWidth = node.dimensions?.width ?? MIN_NODE_WIDTH;
  const baseHeight = node.dimensions?.height ?? MIN_NODE_HEIGHT;

  return {
    width: Math.max(baseWidth, MIN_NODE_WIDTH),
    height: Math.max(baseHeight, MIN_NODE_HEIGHT),
  };
}

function getRenderedPosition(node: FlowNode, renderedDimensions: Dimensions): Point {
  const position = node.position ?? { x: 0, y: 0 };
  const originalDimensions = node.dimensions;

  if (!originalDimensions) {
    return position;
  }

  return {
    x: position.x - ((renderedDimensions.width - originalDimensions.width) / 2),
    y: position.y - ((renderedDimensions.height - originalDimensions.height) / 2),
  };
}

function getNodeType(nodeType: FlowNodeType): string {
  switch (nodeType) {
    case FlowNodeType.START:
      return 'startNode';
    case FlowNodeType.COMMAND:
      return 'commandNode';
    case FlowNodeType.EVENT:
      return 'eventNode';
    case FlowNodeType.POLICY:
      return 'policyNode';
    case FlowNodeType.END:
      return 'endNode';
    default:
      return 'eventNode';
  }
}

function getNodeColor(nodeType?: string): string {
  if (nodeType === 'startNode') return '#22c55e';
  if (nodeType === 'commandNode') return '#3b82f6';
  if (nodeType === 'eventNode') return '#f97316';
  if (nodeType === 'policyNode') return '#a855f7';
  if (nodeType === 'endNode') return '#ef4444';
  if (nodeType === 'outcomeNode') return '#e2e8f0';
  return '#cbd5e1';
}

function getEdgeMarkerColor(edgeType: FlowEdgeType): string {
  if (edgeType === FlowEdgeType.CALL) return '#2563eb';
  if (edgeType === FlowEdgeType.OUTCOME_HANDLER) return '#ea580c';
  if (edgeType === FlowEdgeType.ERROR) return '#dc2626';
  return '#64748b';
}

function getNodeTitle(system: string | null, service: string | null): string | undefined {
  const metadata = [system, service].filter(Boolean).join(' / ');
  return metadata || undefined;
}

function getPolicyLabelParts(label: string): EventFlowNodeData['policyLabelParts'] | undefined {
  const match = label.match(/^\s*(when)\s+(.+?)\s+(do)\s+(.+)\s*$/i);

  if (!match) {
    return undefined;
  }

  return {
    when: match[1].toLowerCase(),
    condition: match[2],
    do: match[3].toLowerCase(),
    action: match[4],
  };
}

function getNodeEndOutcome(node: FlowNode): string[] | null | undefined {
  return node.endOutcome ?? (node as FlowNode & LegacyFlowNodeEndOutcome).endOutcomeLabels;
}

function toEditableReactFlowNodes(
  flowViewModel: FlowViewModel,
  displaySettings?: EventFlowDisplaySettings,
  highlightedNodeIds?: Set<string>
): {
  nodes: EventFlowReactNode[];
  missingLayoutNodeIds: string[];
} {
  const missingLayoutNodeIds: string[] = [];
  const shouldHumanizeLabels = displaySettings?.humanizeLabels ?? true;

  const nodes = flowViewModel.nodes.flatMap((node) => {
    if (!node.position || !node.dimensions) {
      missingLayoutNodeIds.push(node.id);
      return [];
    }

    const renderedDimensions = getRenderedDimensions(node);

    const label = shouldHumanizeLabels ? humanizeLabel(node.label) : node.label;
    const endOutcomeLabels = getNodeEndOutcome(node)
      ?.filter((outcomeLabel) => outcomeLabel != null && outcomeLabel.trim().length > 0)
      .map((outcomeLabel) => shouldHumanizeLabels ? humanizeLabel(outcomeLabel) : outcomeLabel);

    return [{
      id: node.id,
      type: getNodeType(node.type),
      position: getRenderedPosition(node, renderedDimensions),
      className: highlightedNodeIds?.has(node.id) ? 'eventflow-node-highlighted' : undefined,
      data: {
        label,
        endOutcomeLabels,
        sourceRef: node.sourceRef,
        title: getNodeTitle(node.system, node.service),
        policyLabelParts: node.type === FlowNodeType.POLICY ? getPolicyLabelParts(label) : undefined,
      },
      style: {
        width: renderedDimensions.width,
        height: renderedDimensions.height,
      },
    }];
  });

  return { nodes, missingLayoutNodeIds };
}

function getNodeDimensions(node: Node<EventFlowNodeData>, fallback?: Dimensions | null): Dimensions | null {
  const style = node.style as { width?: number | string; height?: number | string } | undefined;
  const width = typeof style?.width === 'number' ? style.width : fallback?.width ?? null;
  const height = typeof style?.height === 'number' ? style.height : fallback?.height ?? null;

  if (width === null || height === null) {
    return null;
  }

  return { width, height };
}

function getNodeCenter(node: EventFlowReactNode, fallback?: Dimensions | null): Point | null {
  const dimensions = getNodeDimensions(node, fallback);

  if (!dimensions) {
    return null;
  }

  return {
    x: node.position.x + (dimensions.width / 2),
    y: node.position.y + (dimensions.height / 2),
  };
}

function getOutcomeNodeWidth(label: string): number {
  return Math.min(Math.max((label.length * 7) + 24, OUTCOME_NODE_MIN_WIDTH), OUTCOME_NODE_MAX_WIDTH);
}

function buildEdge(
  id: string,
  source: string,
  target: string,
  edgeType: FlowEdgeType,
  label?: string,
  sourceRef?: SourceRef | null
): Edge {
  return {
    id,
    source,
    target,
    type: 'causationEdge',
    label: label || undefined,
    data: {
      edgeType,
      sourceRef: sourceRef ?? undefined,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: getEdgeMarkerColor(edgeType),
    },
  };
}

function buildSyntheticOutcomeRouting(
  flowViewModel: FlowViewModel,
  realNodes: EventFlowReactNode[],
  displaySettings?: EventFlowDisplaySettings
): SyntheticOutcomeRouting {
  const realNodeById = new Map(realNodes.map((node) => [node.id, node]));
  const flowNodeById = new Map(flowViewModel.nodes.map((node) => [node.id, node]));
  const shouldHumanizeLabels = displaySettings?.humanizeLabels ?? true;
  const groupedEdges = new Map<string, typeof flowViewModel.edges>();

  flowViewModel.edges.forEach((edge) => {
    const outcome = edge.outcome?.trim();

    if (!outcome) {
      return;
    }

    if (!realNodeById.has(edge.source) || !realNodeById.has(edge.target)) {
      return;
    }

    if (flowNodeById.get(edge.source)?.type !== FlowNodeType.COMMAND) {
      return;
    }

    const groupKey = `${edge.source}::${outcome}`;
    const existingEdges = groupedEdges.get(groupKey);

    if (existingEdges) {
      existingEdges.push(edge);
      return;
    }

    groupedEdges.set(groupKey, [edge]);
  });

  const syntheticNodes: EventFlowReactNode[] = [];
  const syntheticEdges: Edge[] = [];
  const groupedEdgeIds = new Set<string>();

  groupedEdges.forEach((edges, groupKey) => {
    if (edges.length < 2) {
      return;
    }

    const sourceNode = realNodeById.get(edges[0].source);

    if (!sourceNode) {
      return;
    }

    const sourceCenter = getNodeCenter(sourceNode, null);

    if (!sourceCenter) {
      return;
    }

    const targetNodes = edges
      .map((edge) => realNodeById.get(edge.target))
      .filter((node): node is EventFlowReactNode => Boolean(node));

    if (targetNodes.length < 2) {
      return;
    }

    const targetCenters = targetNodes
      .map((node) => getNodeCenter(node, null))
      .filter((point): point is Point => Boolean(point));

    if (targetCenters.length < 2) {
      return;
    }

    const outcome = edges[0].outcome!.trim();
    const label = shouldHumanizeLabels ? humanizeLabel(outcome) : outcome;
    const width = getOutcomeNodeWidth(label);
    const averageTargetCenterX = targetCenters.reduce((sum, point) => sum + point.x, 0) / targetCenters.length;
    const averageTargetCenterY = targetCenters.reduce((sum, point) => sum + point.y, 0) / targetCenters.length;
    const sourceDimensions = getNodeDimensions(sourceNode, null);
    const minTargetLeft = Math.min(...targetNodes.map((node) => node.position.x));
    const minX = sourceDimensions
      ? sourceNode.position.x + sourceDimensions.width + OUTCOME_NODE_MARGIN
      : sourceNode.position.x + OUTCOME_NODE_MARGIN;
    const maxX = minTargetLeft - width - OUTCOME_NODE_MARGIN;
    let x = ((sourceCenter.x + averageTargetCenterX) / 2) - (width / 2);

    if (maxX >= minX) {
      x = Math.min(Math.max(x, minX), maxX);
    }

    const syntheticNodeId = `synthetic:outcome:${groupKey}`;
    const syntheticNode: EventFlowReactNode = {
      id: syntheticNodeId,
      type: 'outcomeNode',
      position: {
        x,
        y: averageTargetCenterY - (OUTCOME_NODE_HEIGHT / 2),
      },
      draggable: false,
      selectable: false,
      connectable: false,
      data: {
        label,
        synthetic: true,
      },
      style: {
        width,
        height: OUTCOME_NODE_HEIGHT,
      },
    };

    syntheticNodes.push(syntheticNode);
    syntheticEdges.push(
      buildEdge(
        `${syntheticNodeId}:in`,
        edges[0].source,
        syntheticNodeId,
        edges[0].type,
        undefined,
        edges[0].sourceRef
      )
    );

    edges.forEach((edge) => {
      groupedEdgeIds.add(edge.id);
      syntheticEdges.push(
        buildEdge(
          `${syntheticNodeId}:${edge.id}`,
          syntheticNodeId,
          edge.target,
          edge.type,
          undefined,
          edge.sourceRef
        )
      );
    });
  });

  return {
    nodes: syntheticNodes,
    edges: syntheticEdges,
    groupedEdgeIds,
  };
}

function getFlowBounds(nodes: FlowNode[], fallback: FlowBounds | null): FlowBounds | null {
  const positionedNodes = nodes.filter((node) => node.position && node.dimensions);

  if (positionedNodes.length === 0) {
    return fallback;
  }

  const minX = Math.min(...positionedNodes.map((node) => node.position!.x));
  const minY = Math.min(...positionedNodes.map((node) => node.position!.y));
  const maxX = Math.max(...positionedNodes.map((node) => node.position!.x + node.dimensions!.width));
  const maxY = Math.max(...positionedNodes.map((node) => node.position!.y + node.dimensions!.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function mergeEditableNodesIntoFlowViewModel(
  flowViewModel: FlowViewModel,
  reactFlowNodes: Node<EventFlowNodeData>[]
): FlowViewModel {
  const editableNodesById = new Map(reactFlowNodes.map((node) => [node.id, node]));

  const nodes = flowViewModel.nodes.map<FlowNode>((node) => {
    const editableNode = editableNodesById.get(node.id);

    if (!editableNode) {
      return node;
    }

    return {
      ...node,
      position: {
        x: editableNode.position.x,
        y: editableNode.position.y,
      } satisfies Point,
      dimensions: getNodeDimensions(editableNode, node.dimensions),
    };
  });

  return {
    ...flowViewModel,
    nodes,
    bounds: getFlowBounds(nodes, flowViewModel.bounds),
  };
}

export function EventFlowVisualizer({
  flowViewModel,
  theme = 'light',
  editable = true,
  displaySettings,
  highlightedNodeIds,
  onNodeClick,
  onSelectionChange,
  onFlowViewModelChange,
}: EventFlowVisualizerProps) {
  const nodeTypes = useMemo(() => ({
    startNode: StartNode,
    commandNode: CommandNode,
    eventNode: EventNode,
    policyNode: PolicyNode,
    endNode: EndNode,
    outcomeNode: OutcomeNode,
  }), []);

  const edgeTypes = useMemo(() => ({
    causationEdge: CausationEdge,
  }), []);

  const highlightedNodeIdSet = useMemo(
    () => new Set(highlightedNodeIds ?? []),
    [highlightedNodeIds]
  );

  const initialNodeState = useMemo(
    () => toEditableReactFlowNodes(flowViewModel, displaySettings, highlightedNodeIdSet),
    [displaySettings, flowViewModel, highlightedNodeIdSet]
  );
  const [nodes, setNodes] = useState<EventFlowReactNode[]>(initialNodeState.nodes);
  const latestFlowViewModelRef = useRef(flowViewModel);

  useEffect(() => {
    latestFlowViewModelRef.current = flowViewModel;
    setNodes(initialNodeState.nodes);

    if (initialNodeState.missingLayoutNodeIds.length > 0 && import.meta.env.DEV) {
      console.warn(
        '[EventFlowVisualizer] Skipping nodes without layout information:',
        initialNodeState.missingLayoutNodeIds
      );
    }
  }, [flowViewModel, initialNodeState]);

  const syntheticOutcomeRouting = useMemo(
    () => buildSyntheticOutcomeRouting(flowViewModel, nodes, displaySettings),
    [displaySettings, flowViewModel, nodes]
  );

  const renderNodes = useMemo(
    () => [...nodes, ...syntheticOutcomeRouting.nodes],
    [nodes, syntheticOutcomeRouting.nodes]
  );

  const edges = useMemo<Edge[]>(() => {
    const visibleNodeIds = new Set(renderNodes.map((node) => node.id));
    const danglingEdgeIds: string[] = [];

    const visibleEdges = flowViewModel.edges.flatMap((edge) => {
      if (syntheticOutcomeRouting.groupedEdgeIds.has(edge.id)) {
        return [];
      }

      if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
        danglingEdgeIds.push(edge.id);
        return [];
      }

      const outcomeLabel = edge.outcome?.trim();

      return [buildEdge(
        edge.id,
        edge.source,
        edge.target,
        edge.type,
        outcomeLabel || edge.label || undefined,
        edge.sourceRef
      )];
    });

    if (danglingEdgeIds.length > 0 && import.meta.env.DEV) {
      console.warn(
        '[EventFlowVisualizer] Skipping dangling edges whose source or target node is missing:',
        danglingEdgeIds
      );
    }

    return [...visibleEdges, ...syntheticOutcomeRouting.edges];
  }, [flowViewModel.edges, renderNodes, syntheticOutcomeRouting.edges, syntheticOutcomeRouting.groupedEdgeIds]);

  const emitUpdatedFlowViewModel = useCallback((nextNodes: Node<EventFlowNodeData>[]) => {
    if (!onFlowViewModelChange) {
      return;
    }

    onFlowViewModelChange(
      mergeEditableNodesIntoFlowViewModel(latestFlowViewModelRef.current, nextNodes)
    );
  }, [onFlowViewModelChange]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((currentNodes) => {
      const nextNodes = applyNodeChanges(changes, currentNodes);
      return nextNodes;
    });
  }, []);

  const handleNodeDragStop = useCallback((
    _event: React.MouseEvent,
    _node: EventFlowReactNode,
    nextNodes: EventFlowReactNode[]
  ) => {
    emitUpdatedFlowViewModel(nextNodes);
  }, [emitUpdatedFlowViewModel]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: EventFlowReactNode) => {
    if (onNodeClick && !node.data.synthetic && node.data.sourceRef) {
      onNodeClick(node.id, node.data.sourceRef);
    }
  }, [onNodeClick]);

  const handleSelectionChange = useCallback(({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
    if (onSelectionChange) {
      onSelectionChange(
        nodes.map((node) => node.id),
        edges.map((edge) => edge.id)
      );
    }
  }, [onSelectionChange]);

  return (
    <div className={`eventflow-visualizer theme-${theme}`} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={renderNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={{ hideAttribution: true }}
        onNodesChange={handleNodesChange}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        onSelectionChange={handleSelectionChange}
        fitView
        nodesDraggable={editable}
        nodesConnectable={false}
        elementsSelectable
      >
        <Background gap={24} color={theme === 'dark' ? '#334155' : '#e2e8f0'} />
        <Controls />
        <MiniMap nodeColor={(node) => getNodeColor(node.type)} />
      </ReactFlow>
    </div>
  );
}

export default EventFlowVisualizer;
