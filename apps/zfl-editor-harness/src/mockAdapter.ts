// Dev only: an in-memory engine that prepares the three operations as text edits, so the UI flows (pending, rejected
// input kept, Discard, stale) can be exercised before lsp-js has an edit request. It is a regex sketch, not the KMP
// engine: it is not authoritative and must not be mistaken for ZflEditor's behaviour.
import type { EditOutcome, Intent, IntentOp, TextEdit, ZflEditingAdapter } from './adapter.ts';

const ID = /^[A-Za-z_][A-Za-z0-9_]*$/;
const OPS: readonly IntentOp[] = ['renameCommand', 'addEmission', 'changePolicyTrigger'];

const word = (name: string, flags = '') => new RegExp(String.raw`\b${name}\b`, flags);

export function prepareMockEdit(text: string, intent: Intent): EditOutcome {
  const invalid = (message: string): EditOutcome => ({ status: 'invalid', messages: [message] });
  switch (intent.op) {
    case 'renameCommand': {
      if (!ID.test(intent.newName)) return invalid(`'${intent.newName}' is not an identifier`);
      if (!word(intent.oldName).test(text)) return invalid(`Command '${intent.oldName}' is not in the text`);
      if (word(intent.newName).test(text)) return invalid(`'${intent.newName}' already exists`);
      const edits: TextEdit[] = [...text.matchAll(word(intent.oldName, 'g'))]
        .map((m) => ({ start: m.index!, end: m.index! + m[0].length, replacement: intent.newName }));
      return { status: 'applied', edits, identityMappings: [{ flowName: intent.flowName, kind: 'command', oldName: intent.oldName, newName: intent.newName }] };
    }
    case 'addEmission': {
      if (!ID.test(intent.eventName)) return invalid(`'${intent.eventName}' is not an identifier`);
      const command = intent.occurrenceKey.split('@')[0];
      const open = new RegExp(String.raw`\bdo\s+${command}\s*\{`).exec(text);
      if (!open) return invalid(`Occurrence '${intent.occurrenceKey}' has no body`);
      const at = open.index + open[0].length;
      return { status: 'applied', edits: [{ start: at, end: at, replacement: `\n        emits ${intent.eventName}` }], identityMappings: [] };
    }
    case 'changePolicyTrigger': {
      if (intent.events.length === 0 || !intent.events.every((e) => ID.test(e))) return invalid('Trigger events must be identifiers');
      for (const m of text.matchAll(/\bwhen\s+([A-Za-z0-9_,\s]+?)\s+do\b/g)) {
        if (!m[1].split(/[,\s]+/).includes(intent.policyKey) && m[1].replace(/\s+/g, '') !== intent.policyKey) continue;
        const start = m.index! + m[0].indexOf(m[1]);
        return { status: 'applied', edits: [{ start, end: start + m[1].length, replacement: intent.events.join(', ') }], identityMappings: [] };
      }
      return invalid(`Policy '${intent.policyKey}' was not found`);
    }
  }
}

export function createMockEditingAdapter(base: ZflEditingAdapter): ZflEditingAdapter {
  let text = '';
  let revision = -1;
  return {
    capabilities: () => OPS,
    async setText(next, rev) {
      text = next;
      revision = rev;
      return base.setText(next, rev);
    },
    async prepareEdit(intent, rev): Promise<EditOutcome> {
      if (rev !== revision) return { status: 'stale', reason: `prepared for revision ${rev}, the document is at ${revision}` };
      return prepareMockEdit(text, intent);
    },
    dispose() {},
  };
}
