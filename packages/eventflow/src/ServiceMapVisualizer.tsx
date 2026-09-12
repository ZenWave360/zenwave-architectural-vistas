import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  applyNodeChanges,
  Background,
  Controls,
  Node,
  NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './styles/eventflow.css';

import { ServiceGroupNode } from './components/ServiceGroupNode';
import { ServiceCommandNode, ServiceEventNode } from './components/ServiceMapNode';
import { DiagramDisplaySettings, humanizeLabel } from './labelFormatting';
import type {
  Dimensions,
  Point,
  ServiceGroupView,
  ServiceNodeView,
  ServiceViewModel,
} from './types/ServiceViewModel';
import { ServiceNodeType } from './types/ServiceViewModel';

export interface ServiceMapVisualizerProps {
  serviceViewModel: ServiceViewModel;
  theme?: 'light' | 'dark';
  editable?: boolean;
  displaySettings?: DiagramDisplaySettings;
  onServiceViewModelChange?: (updatedServiceViewModel: ServiceViewModel) => void;
}

interface ServiceMapNodeData {
  label: string;
  title?: string;
}

interface ServiceGroupNodeData {
  legendLabel: string;
  centerLabel: string;
  centerX?: number;
  centerWidth?: number;
  title?: string;
}

function getNodeTitle(system: string | null, servicePath: string | null): string | undefined {
  const metadata = [system, servicePath].filter(Boolean).join(' / ');
  return metadata || undefined;
}

function getGroupTitle(path: string): string {
  return humanizeLabel(path.replace(/\//g, ' / '));
}

function getGroupLabels(path: string, shouldHumanizeLabels: boolean): Pick<ServiceGroupNodeData, 'legendLabel' | 'centerLabel'> {
  const segments = path.split('/').filter(Boolean);
  const system = segments[0] ?? 'Unbounded';
  const service = segments[1] ?? system;

  return {
    legendLabel: shouldHumanizeLabels ? humanizeLabel(system) : system,
    centerLabel: shouldHumanizeLabels ? humanizeLabel(service) : service,
  };
}

function getCenterLabelLayout(
  group: ServiceGroupView,
  childNodes: ServiceNodeView[]
): Pick<ServiceGroupNodeData, 'centerX' | 'centerWidth'> {
  const groupWidth = group.dimensions?.width ?? 0;
  const nodesWithBox = childNodes.filter((node) => node.position && node.dimensions);

  if (groupWidth <= 0 || nodesWithBox.length === 0) {
    return { centerX: groupWidth / 2, centerWidth: undefined };
  }

  const commandNodes = nodesWithBox.filter((node) => node.type === ServiceNodeType.COMMAND);
  const eventNodes = nodesWithBox.filter((node) => node.type === ServiceNodeType.EVENT);
  const leftEdge = commandNodes.length > 0
    ? Math.max(...commandNodes.map((node) => (node.position!.x - (group.position?.x ?? 0)) + node.dimensions!.width))
    : 24;
  const rightEdge = eventNodes.length > 0
    ? Math.min(...eventNodes.map((node) => node.position!.x - (group.position?.x ?? 0)))
    : groupWidth - 24;
  const gapWidth = Math.max(rightEdge - leftEdge, 0);
  const usableWidth = gapWidth > 0 ? Math.max(gapWidth - 20, 120) : Math.min(groupWidth - 48, 196);
  const centerX = gapWidth > 0 ? leftEdge + (gapWidth / 2) : groupWidth / 2;

  return {
    centerX,
    centerWidth: Math.min(usableWidth, 220),
  };
}

function getNodeDimensions(node: Node, fallback?: Dimensions | null): Dimensions | null {
  const style = node.style as { width?: number | string; height?: number | string } | undefined;
  const width = typeof style?.width === 'number' ? style.width : fallback?.width ?? null;
  const height = typeof style?.height === 'number' ? style.height : fallback?.height ?? null;

  if (width === null || height === null) {
    return null;
  }

  return { width, height };
}

function toReactFlowNodes(
  serviceViewModel: ServiceViewModel,
  displaySettings?: DiagramDisplaySettings
): Node<ServiceMapNodeData | ServiceGroupNodeData>[] {
  const shouldHumanizeLabels = displaySettings?.humanizeLabels ?? true;
  const groupsById = new Map(serviceViewModel.groups.map((group) => [group.id, group]));
  const nodesByGroupId = new Map(serviceViewModel.groups.map((group) => [
    group.id,
    serviceViewModel.nodes.filter((node) => node.groupId === group.id),
  ]));

  const groupNodes: Node<ServiceGroupNodeData>[] = serviceViewModel.groups.flatMap((group) => {
    if (!group.position || !group.dimensions) {
      return [];
    }

    const labels = getGroupLabels(group.path, shouldHumanizeLabels);
    const centerLayout = getCenterLabelLayout(group, nodesByGroupId.get(group.id) ?? []);

    return [{
      id: group.id,
      type: 'serviceGroupNode',
      position: group.position,
      data: {
        legendLabel: labels.legendLabel,
        centerLabel: labels.centerLabel,
        centerX: centerLayout.centerX,
        centerWidth: centerLayout.centerWidth,
        title: shouldHumanizeLabels ? getGroupTitle(group.path) : group.path,
      },
      style: {
        width: group.dimensions.width,
        height: group.dimensions.height,
      },
    }];
  });

  const childNodes: Node<ServiceMapNodeData>[] = serviceViewModel.nodes.flatMap((node) => {
    if (!node.position || !node.dimensions) {
      return [];
    }

    const group = groupsById.get(node.groupId);
    if (!group?.position) {
      return [];
    }

    return [{
      id: node.id,
      type: node.type === ServiceNodeType.COMMAND ? 'serviceCommandNode' : 'serviceEventNode',
      parentNode: node.groupId,
      extent: 'parent',
      position: {
        x: node.position.x - group.position.x,
        y: node.position.y - group.position.y,
      },
      data: {
        label: shouldHumanizeLabels ? humanizeLabel(node.label) : node.label,
        title: getNodeTitle(node.system, node.servicePath),
      },
      style: {
        width: node.dimensions.width,
        height: node.dimensions.height,
      },
    }];
  });

  return [...groupNodes, ...childNodes];
}

function mergeNodesIntoServiceViewModel(
  serviceViewModel: ServiceViewModel,
  reactFlowNodes: Node<ServiceMapNodeData | ServiceGroupNodeData>[]
): ServiceViewModel {
  const groupsById = new Map<string, ServiceGroupView>();
  const childrenById = new Map<string, Node<ServiceMapNodeData | ServiceGroupNodeData>>();

  reactFlowNodes.forEach((node) => {
    if (node.id.startsWith('group:')) {
      const existing = serviceViewModel.groups.find((group) => group.id === node.id);
      if (!existing) {
        return;
      }

      groupsById.set(node.id, {
        ...existing,
        position: { x: node.position.x, y: node.position.y },
        dimensions: getNodeDimensions(node, existing.dimensions),
      });
      return;
    }

    childrenById.set(node.id, node);
  });

  const groups = serviceViewModel.groups.map((group) => groupsById.get(group.id) ?? group);
  const groupPositions = new Map(groups.map((group) => [group.id, group.position]));

  const nodes = serviceViewModel.nodes.map<ServiceNodeView>((node) => {
    const updated = childrenById.get(node.id);
    if (!updated) {
      return node;
    }

    const groupPosition = groupPositions.get(node.groupId);
    const absolutePosition: Point = {
      x: (groupPosition?.x ?? 0) + updated.position.x,
      y: (groupPosition?.y ?? 0) + updated.position.y,
    };

    return {
      ...node,
      position: absolutePosition,
      dimensions: getNodeDimensions(updated, node.dimensions),
    };
  });

  const positionedGroups = groups.filter((group) => group.position && group.dimensions);
  const bounds = positionedGroups.length === 0 ? serviceViewModel.bounds : {
    x: 0,
    y: 0,
    width: Math.max(...positionedGroups.map((group) => group.position!.x + group.dimensions!.width)),
    height: Math.max(...positionedGroups.map((group) => group.position!.y + group.dimensions!.height)),
  };

  return {
    ...serviceViewModel,
    groups,
    nodes,
    bounds,
  };
}

export function ServiceMapVisualizer({
  serviceViewModel,
  theme = 'light',
  editable = false,
  displaySettings,
  onServiceViewModelChange,
}: ServiceMapVisualizerProps) {
  const reactFlowNodes = useMemo(
    () => toReactFlowNodes(serviceViewModel, displaySettings),
    [displaySettings, serviceViewModel]
  );
  const [nodes, setNodes] = useState<Node<ServiceMapNodeData | ServiceGroupNodeData>[]>(reactFlowNodes);
  const latestServiceViewModelRef = useRef(serviceViewModel);

  useEffect(() => {
    latestServiceViewModelRef.current = serviceViewModel;
    setNodes(reactFlowNodes);
  }, [reactFlowNodes, serviceViewModel]);

  const emitUpdatedServiceViewModel = useCallback((nextNodes: Node<ServiceMapNodeData | ServiceGroupNodeData>[]) => {
    if (!onServiceViewModelChange) {
      return;
    }

    onServiceViewModelChange(
      mergeNodesIntoServiceViewModel(latestServiceViewModelRef.current, nextNodes)
    );
  }, [onServiceViewModelChange]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((currentNodes) => {
      const nextNodes = applyNodeChanges(changes, currentNodes);
      emitUpdatedServiceViewModel(nextNodes);
      return nextNodes;
    });
  }, [emitUpdatedServiceViewModel]);

  return (
    <div className={`eventflow-visualizer service-map-visualizer ${theme === 'dark' ? 'theme-dark' : ''}`}>
      <ReactFlow
        fitView
        nodes={nodes}
        edges={[]}
        onNodesChange={editable ? onNodesChange : undefined}
        nodeTypes={{
          serviceGroupNode: ServiceGroupNode,
          serviceCommandNode: ServiceCommandNode,
          serviceEventNode: ServiceEventNode,
        }}
        nodesDraggable={editable}
        nodesConnectable={false}
        elementsSelectable={true}
        minZoom={0.15}
        maxZoom={1.5}
      >
        <Background gap={24} size={1} color={theme === 'dark' ? '#334155' : '#d6d3d1'} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default ServiceMapVisualizer;
