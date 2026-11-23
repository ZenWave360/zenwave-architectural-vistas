// What a POLICY node draws from the server's optional fields (EF-R21). Free of React so a test can load it.
// This is the only place that names the server fields: rename them here.

export type PolicyKind = 'actor' | 'timer';

export interface PolicyDrawing {
  /** Drawn in place of the policy's label. */
  title?: string;
  kind?: PolicyKind;
  /** The actor name or the timer text. Only set together with kind. */
  detail?: string;
}

interface PolicyServerFields {
  title?: string | null;
  policyKind?: string | null;
  actor?: string | null;
  timer?: string | null;
}

function text(value: string | null | undefined): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
}

/** An absent or unknown field draws as before: no title, no icon. */
export function readPolicyDrawing(node: PolicyServerFields): PolicyDrawing {
  const drawing: PolicyDrawing = {};
  const title = text(node.title);
  if (title) drawing.title = title;
  if (node.policyKind === 'actor' || node.policyKind === 'timer') {
    const detail = text(node.policyKind === 'actor' ? node.actor : node.timer);
    if (detail) {
      drawing.kind = node.policyKind;
      drawing.detail = detail;
    }
  }
  return drawing;
}
