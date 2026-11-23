// React Flow node type key for a FlowNodeType value. A type this viewer does not know
// renders as a plain event node instead of failing (EF-R2).

export function getNodeTypeKey(nodeType: string | undefined): string {
  switch (nodeType) {
    case 'START':
      return 'startNode';
    case 'COMMAND':
      return 'commandNode';
    case 'EVENT':
      return 'eventNode';
    case 'POLICY':
      return 'policyNode';
    case 'END':
      return 'endNode';
    case 'READ_MODEL':
      return 'readModelNode';
    default:
      return 'eventNode';
  }
}
