/**
 * EventFlow Visualizer - Main exports
 */

// Main component
export { EventFlowVisualizer } from './EventFlowVisualizer';
export type { EventFlowDisplaySettings, EventFlowVisualizerProps } from './EventFlowVisualizer';
export { default } from './EventFlowVisualizer';
export { ServiceMapVisualizer } from './ServiceMapVisualizer';
export type { ServiceMapVisualizerProps } from './ServiceMapVisualizer';
export type { DiagramDisplaySettings } from './labelFormatting';
export { humanizeLabel, humanizeMultilineLabel } from './labelFormatting';

// Types - FlowIR (Canonical IR)
export type {
  FlowNode,
  FlowEdge,
  FlowIR,
} from './types/FlowViewModel';

// Types - FlowViewModel (View/Layout)
export type {
  SourceRef,
  Point,
  Dimensions,
  FlowNodeView,
  FlowEdgeView,
  FlowBounds,
  FlowSystemGroupView,
  LayoutMetadata,
  FlowViewModel,
} from './types/FlowViewModel';

export {
  FlowNodeType,
  FlowEdgeType,
  Direction,
  createFlowViewModel,
} from './types/FlowViewModel';

export type {
  ServiceGroupView,
  ServiceNodeView,
  ServiceViewModel,
} from './types/ServiceViewModel';

export {
  ServiceNodeType,
  createServiceViewModel,
} from './types/ServiceViewModel';

// Node components (for customization)
export { StartNode } from './components/StartNode';
export type { StartNodeData } from './components/StartNode';
export { CommandNode } from './components/CommandNode';
export type { CommandNodeData } from './components/CommandNode';
export { EventNode } from './components/EventNode';
export type { EventNodeData } from './components/EventNode';
export { PolicyNode } from './components/PolicyNode';
export type { PolicyNodeData } from './components/PolicyNode';
export { EndNode } from './components/EndNode';
export type { EndNodeData } from './components/EndNode';
export { OutcomeNode } from './components/OutcomeNode';
export type { OutcomeNodeData } from './components/OutcomeNode';

// Edge components (for customization)
export { CausationEdge } from './components/CausationEdge';
