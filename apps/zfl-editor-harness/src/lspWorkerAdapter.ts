// Harness adapter: the published @zenwave360/lsp-js Web Worker (the Kotlin engine compiled to JS), spoken to over
// JSON-RPC by postMessage. No Gradle and no sibling checkout. Projection and diagnostics come from the server's
// zenwave/eventFlowViews and publishDiagnostics. The server has no edit request yet (ZflEditor is not exported to JS),
// so prepareEdit answers `unsupported` until ES-P4 adds one.
import workerUrl from '@zenwave360/lsp-js/worker?url';
import type { FlowViewModel } from '@zenwave360/vistas-eventflow/react';
import type { Diagnostic, EditOutcome, Intent, IntentOp, Projection, ZflEditingAdapter } from './adapter.ts';

const URI = 'file:///harness/sample.zfl';
const SEVERITIES = ['error', 'error', 'warning', 'info', 'hint'] as const;

interface LspDiagnostic { severity?: number; message: string; range: { start: { line: number; character: number } } }
type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

export function createLspWorkerAdapter(): ZflEditingAdapter {
  const worker = new Worker(workerUrl);
  const pending = new Map<number, Pending>();
  let nextId = 1;
  let version = 0;
  let opened = false;
  let diagnostics: Diagnostic[] = [];
  let diagnosticsWaiters: Array<() => void> = [];

  worker.onmessage = (event: MessageEvent) => {
    const message = event.data as { id?: number; method?: string; params?: any; result?: unknown; error?: { message: string } };
    if (message.method === 'textDocument/publishDiagnostics' && message.params?.uri === URI) {
      diagnostics = (message.params.diagnostics as LspDiagnostic[]).map((d) => ({
        severity: SEVERITIES[d.severity ?? 1] ?? 'error',
        message: d.message,
        line: d.range.start.line + 1,
        column: d.range.start.character + 1,
      }));
      const waiters = diagnosticsWaiters;
      diagnosticsWaiters = [];
      waiters.forEach((wake) => wake());
    } else if (message.id !== undefined && message.method === undefined) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) entry?.reject(new Error(message.error.message));
      else entry?.resolve(message.result);
    }
  };

  const request = (method: string, params: unknown) => new Promise<any>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ jsonrpc: '2.0', id, method, params });
  });
  const notify = (method: string, params: unknown) => worker.postMessage({ jsonrpc: '2.0', method, params });

  const ready = request('initialize', { processId: null, rootUri: null, capabilities: {} })
    .then(() => notify('initialized', {}));

  // The server publishes diagnostics after a change, with no reply to wait on: wait for the next publish, or give up.
  const nextDiagnostics = () => new Promise<void>((resolve) => {
    diagnosticsWaiters.push(resolve);
    setTimeout(resolve, 1500);
  });

  return {
    capabilities: (): readonly IntentOp[] => [],

    async setText(text, revision): Promise<Projection> {
      await ready;
      version += 1;
      const published = nextDiagnostics();
      if (!opened) {
        notify('textDocument/didOpen', { textDocument: { uri: URI, languageId: 'zfl', version, text } });
        opened = true;
      } else {
        notify('textDocument/didChange', { textDocument: { uri: URI, version }, contentChanges: [{ text }] });
      }
      let flowGraph: FlowViewModel | null = null;
      try {
        const views = await request('zenwave/eventFlowViews', { textDocument: { uri: URI } });
        flowGraph = (views?.flowGraph as FlowViewModel | undefined) ?? null;
      } catch {
        flowGraph = null;
      }
      await published;
      const invalid = diagnostics.some((d) => d.severity === 'error');
      return { revision, flowGraph, diagnostics, invalid };
    },

    async prepareEdit(intent: Intent): Promise<EditOutcome> {
      return {
        status: 'unsupported',
        reason: `${intent.op} exists in dsl-kotlin's ZflEditor, but @zenwave360/lsp-js has no request for it yet (ES-P4).`,
      };
    },

    dispose() {
      worker.terminate();
    },
  };
}
