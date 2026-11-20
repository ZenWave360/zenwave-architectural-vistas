import type { IntentOp } from './adapter.ts';

export interface PaletteEntry {
  id: string;
  label: string;
  hint: string;
  /** The KMP operation behind it, when ZflEditor has one today. Others are listed disabled (ES-P2 still open). */
  op?: IntentOp;
}

export const PALETTE: readonly PaletteEntry[] = [
  { id: 'renameCommand', label: 'Rename command', hint: 'Select a command; flow-local', op: 'renameCommand' },
  { id: 'addEmission', label: 'Emit event from command', hint: 'Select a command; adds `emits Event`', op: 'addEmission' },
  { id: 'changePolicyTrigger', label: 'Change policy trigger', hint: 'Select a policy; replaces its `when` events', op: 'changePolicyTrigger' },
  { id: 'addCommand', label: 'Command', hint: 'Not in KMP yet (ES-P2, service selection ZVE-Q2)' },
  { id: 'addEvent', label: 'Event', hint: 'Not in KMP yet (ES-P2)' },
  { id: 'addPolicy', label: 'Policy', hint: 'Not in KMP yet (ES-P2)' },
  { id: 'connect', label: 'Connect', hint: 'Not in KMP yet: add/remove policy trigger, target command (ES-P2)' },
  { id: 'delete', label: 'Delete', hint: 'Not in KMP yet: impact analysis (ZVE-R7, ES-P2)' },
  { id: 'arrange', label: 'Arrange', hint: 'Needs the shared KMP layout request (ZVE-R10)' },
];

/** The flow the operations target: the first `flow Name` of the text. The engine is asked by name (ZVE-R3). */
export function firstFlowName(text: string): string | null {
  return /^\s*flow\s+([A-Za-z_][A-Za-z0-9_]*)/m.exec(text)?.[1] ?? null;
}
