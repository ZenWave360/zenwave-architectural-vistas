// Three columns (ZVE-R24): palette, canvas, details. Below: the ZFL text and the diagnostics.
// The text is the only source of truth: every projection is computed from it by the adapter (ZVE-R11).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EventFlowVisualizer, type FlowViewModel, type FlowNode } from '@zenwave360/vistas-eventflow/react';
import type { EditOutcome, Intent, IntentOp, Projection } from './adapter.ts';
import { createLspWorkerAdapter } from './lspWorkerAdapter.ts';
import { createMockEditingAdapter } from './mockAdapter.ts';
import { createCommitField } from './commitField.ts';
import { createIntentQueue, type IntentQueue, type QueueItem } from './intentQueue.ts';
import { applyEdits } from './applyEdits.ts';
import { PALETTE, firstFlowName } from './operations.ts';

const samples = import.meta.glob('../samples/*.zfl', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const SAMPLES = Object.entries(samples).map(([path, text]) => ({ name: path.split('/').pop()!, text }));
const DEBOUNCE_MS = 300;
const NOT_ADVERTISED = 'In KMP, but this engine does not advertise it (no edit request in lsp-js yet). Tick "Mock edit engine" to try the flows.';

export function App() {
  const [base] = useState(() => createLspWorkerAdapter());
  const [mock, setMock] = useState(false);
  const engine = useMemo(() => (mock ? createMockEditingAdapter(base) : base), [mock, base]);
  const [sampleName, setSampleName] = useState(SAMPLES[0]?.name ?? '');
  const [text, setText] = useState(SAMPLES[0]?.text ?? '');
  const [projection, setProjection] = useState<Projection | null>(null);
  // The last valid diagram stays on screen, stale and not editable, while the text is invalid.
  const [lastValid, setLastValid] = useState<FlowViewModel | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [items, setItems] = useState<readonly QueueItem[]>([]);
  // One revision counter for the document, bumped on every change of the text. Anything computed for an older
  // revision (a projection, diagnostics, a prepared edit) is dropped (ZVE-R15).
  const revisionRef = useRef(0);
  const textRef = useRef(text);
  const engineRef = useRef(engine);
  engineRef.current = engine;

  useEffect(() => () => base.dispose(), [base]);

  const edit = useCallback((next: string) => {
    textRef.current = next;
    revisionRef.current += 1;
    setText(next);
  }, []);

  /** Sends the current text to the engine and shows its projection, unless the text moved on meanwhile. */
  const sync = useCallback(async () => {
    const revision = revisionRef.current;
    const result = await engineRef.current.setText(textRef.current, revision);
    if (result.revision !== revisionRef.current) return;
    setProjection(result);
    if (!result.invalid && result.flowGraph) setLastValid(result.flowGraph);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void sync(); }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, engine, sync]);

  const run = useCallback(async (intent: Intent): Promise<EditOutcome> => {
    // ZVE-R15: prepared again once if the document moved while the engine worked, else stale. Edits computed for one
    // revision are never applied to another.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const revision = revisionRef.current;
      await sync();
      if (revision !== revisionRef.current) continue;
      const result = await engineRef.current.prepareEdit(intent, revision);
      if (revision !== revisionRef.current) continue;
      if (result.status === 'applied') edit(applyEdits(textRef.current, result.edits));
      return result;
    }
    return { status: 'stale', reason: 'The text changed while the edit was being prepared.' };
  }, [edit, sync]);

  const runRef = useRef(run);
  runRef.current = run;
  const queue = useRef<IntentQueue | null>(null);
  if (!queue.current) queue.current = createIntentQueue((intent) => runRef.current(intent), setItems);

  const stale = projection?.invalid ?? false;
  const graph = stale ? lastValid : projection?.flowGraph ?? lastValid;
  const node = useMemo(() => graph?.nodes.find((n) => n.id === selected) ?? null, [graph, selected]);
  const flowName = firstFlowName(text);
  const caps = engine.capabilities();
  const send = useCallback((intent: Intent) => { queue.current!.enqueue(intent); }, []);

  return (
    <div className="editor">
      <header className="bar">
        <strong>ZFL visual editor (harness)</strong>
        <label>Sample{' '}
          <select value={sampleName} onChange={(e) => {
            const sample = SAMPLES.find((s) => s.name === e.target.value);
            if (!sample) return;
            setSampleName(sample.name);
            setSelected(null);
            edit(sample.text);
          }}>
            {SAMPLES.map((s) => <option key={s.name}>{s.name}</option>)}
          </select>
        </label>
        <label className="file">Load .zfl{' '}
          <input type="file" accept=".zfl,text/plain" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setSampleName(file.name);
            setSelected(null);
            edit(await file.text());
          }} />
        </label>
        <label title="Dev only: an in-memory engine that applies the three operations as text edits">
          <input type="checkbox" checked={mock} onChange={(e) => setMock(e.target.checked)} /> Mock edit engine
        </label>
        <span className="status">{projection === null ? 'starting engine…' : stale ? 'invalid text: diagram is stale' : `revision ${projection.revision}`}</span>
      </header>

      <div className="columns">
        <aside className="palette" aria-label="Palette">
          <h2>Palette</h2>
          <ul>
            {PALETTE.map((entry) => {
              const advertised = entry.op !== undefined && caps.includes(entry.op);
              const hint = entry.op === undefined || advertised ? entry.hint : NOT_ADVERTISED;
              return (
                <li key={entry.id}>
                  <button disabled={!advertised} title={hint}>{entry.label}</button>
                  <small>{hint}</small>
                </li>
              );
            })}
          </ul>
          <small>Drag and drop from the palette is not built yet.</small>
        </aside>

        <main className={`canvas${stale ? ' stale' : ''}`} aria-label="Canvas">
          {graph ? (
            <EventFlowVisualizer
              flowViewModel={graph}
              diagramId={`harness:${sampleName}`}
              editable={!stale}
              onNodeClick={(id) => setSelected(id)}
            />
          ) : (
            <p className="empty">
              {projection && !projection.invalid
                ? 'No flow in this document. Start one in the text, for example `flow Booking { }`.'
                : 'Nothing to draw yet.'}
            </p>
          )}
        </main>

        <aside className="details" aria-label="Details">
          <h2>Details</h2>
          <Details node={node} flowName={flowName} disabled={stale} caps={caps} onIntent={send} />
          <QueueList items={items} onDiscard={(id) => queue.current!.discard(id)} />
        </aside>
      </div>

      <div className="bottom">
        <section className="source">
          <h2>ZFL text</h2>
          <textarea spellCheck={false} value={text} onChange={(e) => edit(e.target.value)} />
        </section>
        <section className="diagnostics">
          <h2>Diagnostics ({projection?.diagnostics.length ?? 0})</h2>
          <ul>
            {projection?.diagnostics.map((d, i) => (
              <li key={i} className={d.severity}>{d.severity} {d.line}:{d.column} {d.message}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function QueueList(props: { items: readonly QueueItem[]; onDiscard: (id: number) => void }) {
  if (props.items.length === 0) return null;
  return (
    <ul className="queue" aria-label="Intent queue">
      {props.items.map((item) => (
        <li key={item.id} className={`outcome ${item.state}`}>
          <strong>{item.state}</strong> {item.intent.op}
          {item.reason && <div>{item.reason}</div>}
          {item.state !== 'inflight' && <button onClick={() => props.onDiscard(item.id)}>Discard</button>}
        </li>
      ))}
    </ul>
  );
}

function Details(props: {
  node: FlowNode | null;
  flowName: string | null;
  disabled: boolean;
  caps: readonly IntentOp[];
  onIntent: (intent: Intent) => void;
}) {
  const { node, flowName, disabled, caps, onIntent } = props;
  if (!node) return <p className="hint">Click a node.</p>;
  const name = node.label;
  const off = (op: IntentOp) => disabled || !caps.includes(op);
  const anyOff = (['renameCommand', 'addEmission', 'changePolicyTrigger'] as const).some((op) => !caps.includes(op));
  return (
    <div>
      <dl>
        <dt>Id</dt><dd>{node.id}</dd>
        <dt>Type</dt><dd>{node.type}</dd>
        {node.system && (<><dt>System</dt><dd>{node.system}</dd></>)}
        {node.service && (<><dt>Service</dt><dd>{node.service}</dd></>)}
        <dt>Source</dt><dd>{node.sourceRef.line}:{node.sourceRef.column}</dd>
      </dl>
      {anyOff && <p className="hint">{NOT_ADVERTISED}</p>}
      {flowName && node.type === 'COMMAND' && (
        <>
          <CommitField key={`rename-${node.id}`} label="Rename" initial={name} disabled={off('renameCommand')}
            onCommit={(value) => value && onIntent({ op: 'renameCommand', flowName, oldName: name, newName: value })} />
          <CommitField key={`emit-${node.id}`} label="Emits event" initial="" disabled={off('addEmission')}
            onCommit={(value) => value && onIntent({ op: 'addEmission', flowName, occurrenceKey: `${name}@definition`, eventName: value })} />
        </>
      )}
      {flowName && node.type === 'POLICY' && (
        <CommitField key={`trigger-${node.id}`} label="Trigger events (comma separated)" initial="" disabled={off('changePolicyTrigger')}
          onCommit={(value) => value && onIntent({
            op: 'changePolicyTrigger', flowName, policyKey: name, events: value.split(',').map((e) => e.trim()).filter(Boolean),
          })} />
      )}
    </div>
  );
}

/** ZVE-R17 through createCommitField: Enter or leaving commits, Escape cancels, never per keystroke. */
function CommitField(props: { label: string; initial: string; disabled: boolean; onCommit: (value: string) => void }) {
  const onCommit = useRef(props.onCommit);
  onCommit.current = props.onCommit;
  const [field] = useState(() => createCommitField(props.initial, (value) => onCommit.current(value)));
  const [value, setValue] = useState(props.initial);
  return (
    <label className="field">{props.label}
      <input value={value} disabled={props.disabled}
        onChange={(e) => { field.change(e.target.value); setValue(e.target.value); }}
        onBlur={() => field.blur()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') field.enter();
          if (e.key === 'Escape') { field.escape(); setValue(field.value); e.currentTarget.blur(); }
        }} />
    </label>
  );
}
