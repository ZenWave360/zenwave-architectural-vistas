// The editing seam (ZVE-R11). The page knows only this interface. The harness implements it with the lsp-js Web
// Worker; VS Code will implement it over the language client (ES-P4). Keep it small.
import type { FlowViewModel } from '@zenwave360/vistas-eventflow/react';

export interface TextEdit { start: number; end: number; replacement: string }
export interface IdentityMapping { flowName: string; kind: string; oldName: string; newName: string }

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  /** 1-based. */
  line: number;
  column: number;
}

/** What the engine knows about one revision of the text (ZVE-R11). */
export interface Projection {
  revision: number;
  /** Null when the engine returned no flow graph (empty document, or text it could not read). */
  flowGraph: FlowViewModel | null;
  diagnostics: Diagnostic[];
  /** True when the text has errors: the page keeps the last valid diagram and draws it stale. */
  invalid: boolean;
}

/** Semantic intents, named by identity, never by offset (ZVE-R2, R14). */
export type Intent =
  | { op: 'renameCommand'; flowName: string; oldName: string; newName: string }
  | { op: 'addEmission'; flowName: string; occurrenceKey: string; eventName: string }
  | { op: 'changePolicyTrigger'; flowName: string; policyKey: string; events: string[] };

export type IntentOp = Intent['op'];

/** ZVE-R16: one of these comes back for every intent. */
export type EditOutcome =
  | { status: 'applied'; edits: TextEdit[]; identityMappings: IdentityMapping[] }
  | { status: 'invalid'; messages: string[] }
  | { status: 'unsupported'; reason: string }
  | { status: 'needs-origin'; reason: string }
  | { status: 'stale'; reason: string };

export interface ZflEditingAdapter {
  /** Operations the engine can prepare. The page enables only these (ZVE-R12). */
  capabilities(): readonly IntentOp[];
  /** Replaces the text. Resolves with the projection of that revision. */
  setText(text: string, revision: number): Promise<Projection>;
  /** Prepares one edit against `revision`. Never applies it: the host applies it, as one undo step. */
  prepareEdit(intent: Intent, revision: number): Promise<EditOutcome>;
  dispose(): void;
}
