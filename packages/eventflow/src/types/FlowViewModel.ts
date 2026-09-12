/**
 * TypeScript interfaces mirroring the JSON serialization of
 * io.zenwave360.language.eventflow.view.FlowViewModel.
 *
 * The viewer consumes positioned flow data when layout is available, but the
 * model also allows pre-layout values where position and dimensions are null.
 */

/**
 * Represents a precise location in a source file.
 * Lines and columns are 1-based.
 */
export interface SourceRef {
  file: string;
  line: number;
  column: number;
}

/**
 * Semantic types of nodes in an event flow.
 */
export enum FlowNodeType {
  START = "START",
  COMMAND = "COMMAND",
  EVENT = "EVENT",
  POLICY = "POLICY",
  END = "END"
}

/**
 * Semantic meaning of a relationship between nodes.
 */
export enum FlowEdgeType {
  CAUSATION = "CAUSATION",
  CALL = "CALL",
  OUTCOME_HANDLER = "OUTCOME_HANDLER",
  TRIGGER = "TRIGGER",
  CONDITIONAL = "CONDITIONAL",
  ERROR = "ERROR"
}

/**
 * Layout direction produced by the source layout engine.
 */
export enum Direction {
  LR = "LR",
  TB = "TB"
}

export interface Point {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface FlowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A node in an event-driven flow.
 *
 * Layout properties are null until the layout engine has been applied.
 */
export interface FlowNode {
  id: string;
  type: FlowNodeType;
  label: string;
  endOutcome?: string[] | null;
  system: string | null;
  service: string | null;
  sourceRef: SourceRef;
  position: Point | null;
  dimensions: Dimensions | null;
}

/**
 * Directed relationship between two flow nodes.
 */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type: FlowEdgeType;
  outcome: string | null;
  label: string | null;
  sourceRef: SourceRef | null;
}

export interface FlowSystemGroupView {
  systemName: string;
  bounds: FlowBounds;
}

export interface LayoutMetadata {
  engine: string;
  direction: Direction;
  rankSpacing: number;
  nodeSpacing: number;
}

export interface FlowIR {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/**
 * Unified view model for an event-driven flow diagram.
 */
export interface FlowViewModel {
  schema: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  layout: LayoutMetadata | null;
  bounds: FlowBounds | null;
  systemGroups: FlowSystemGroupView[] | null;
}

/**
 * Backward-compatible aliases used by the demo and external consumers.
 */
export type FlowNodeView = FlowNode;
export type FlowEdgeView = FlowEdge;

/**
 * Factory function to create a FlowViewModel with default values.
 */
export function createFlowViewModel(
  partial: Partial<FlowViewModel> & {
    nodes: FlowNode[];
    edges: FlowEdge[];
  }
): FlowViewModel {
  return {
    schema: "zfl.eventflow.view@1",
    layout: null,
    bounds: null,
    systemGroups: null,
    ...partial
  };
}
