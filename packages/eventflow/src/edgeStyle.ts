// Edge stroke and dashes by edge type, kept free of React so a test can load it.
// Edge types are the FlowEdgeType string values.

export function getEdgeStroke(edgeType: string | undefined): string {
  if (edgeType === 'ERROR') return '#dc2626';
  if (edgeType === 'CALL') return '#2563eb';
  if (edgeType === 'OUTCOME_HANDLER') return '#ea580c';
  if (edgeType === 'TRIGGER') return '#7c3aed';
  if (edgeType === 'CONDITIONAL') return '#0f766e';
  return '#64748b';
}

// A CALL edge is solid (EF-R15); the other edge types keep their dashes.
export function getEdgeDasharray(edgeType: string | undefined): string | undefined {
  if (edgeType === 'OUTCOME_HANDLER') return '3 6';
  if (edgeType === 'TRIGGER') return '6 4';
  if (edgeType === 'CONDITIONAL') return '10 6';
  if (edgeType === 'ERROR') return '3 3';
  return undefined;
}
