export interface SourceRef {
  file: string;
  line: number;
  column: number;
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

export enum ServiceNodeType {
  COMMAND = 'COMMAND',
  EVENT = 'EVENT',
}

export enum Direction {
  LR = 'LR',
  TB = 'TB',
}

export interface LayoutMetadata {
  engine: string;
  direction: Direction;
  rankSpacing: number;
  nodeSpacing: number;
}

export interface ServiceGroupView {
  id: string;
  label: string;
  path: string;
  position: Point | null;
  dimensions: Dimensions | null;
}

export interface ServiceNodeView {
  id: string;
  type: ServiceNodeType;
  label: string;
  groupId: string;
  system: string | null;
  service: string | null;
  servicePath: string | null;
  sourceRef: SourceRef;
  position: Point | null;
  dimensions: Dimensions | null;
}

export interface ServiceViewModel {
  schema: string;
  groups: ServiceGroupView[];
  nodes: ServiceNodeView[];
  layout: LayoutMetadata | null;
  bounds: FlowBounds | null;
}

export function createServiceViewModel(
  partial: Partial<ServiceViewModel> & {
    groups: ServiceGroupView[];
    nodes: ServiceNodeView[];
  }
): ServiceViewModel {
  return {
    schema: 'zfl.services.view@1',
    layout: null,
    bounds: null,
    ...partial,
  };
}
