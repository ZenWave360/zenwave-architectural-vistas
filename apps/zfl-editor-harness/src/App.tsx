// Three columns (ZVE-R24): palette, canvas, details. Below: the ZFL text and the diagnostics.
// The text is the only source of truth: every projection is computed from it by the adapter (ZVE-R11).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EventFlowVisualizer, type FlowViewModel, type FlowNode } from '@zenwave360/vistas-eventflow/react';
import type { EditOutcome, Intent, Projection, ZflEditingAdapter } from './adapter.ts';
import { createLspWorkerAdapter } from './lspWorkerAdapter.ts';
import { applyEdits } from './applyEdits.ts';
import { PALETTE, firstFlowName } from './operations.ts';

const samples = import.meta.glob('../samples/*.zfl', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const SAMPLES = Object.entries(samples).map(([path, text]) => ({ name: path.split('/').pop()!, text }));
const DEBOUNCE_MS = 300;

export function App() {
  const adapter = useRef<ZflEditingAdapter | null>(null);
  const [sampleName, setSampleName] = useState(SAMPLES[0]?.name ?? '');
  const [text, setText] = useState(SAMPLES[0]?.text ?? '');
  const [revision, setRevision] = useState(0);
  const [projection, setProjection] = useState<Projection | null>(null);
  // The last valid diagram stays on screen, stale and not editable, while the text is invalid.
  const [lastValid, setLastValid] = useState<FlowViewModel | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ intent: Intent; outcome: EditOutcome } | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    adapter.current = createLspWorkerAdapter();
    return () => adapter.current?.dispose();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!adapter.current) return;
      latest.current = revision;
      const result = await adapter.current.setText(text, revision);
      if (result.revision !== latest.current) return;
      setProjection(result);
      if (!result.invalid && result.flowGraph) setLastValid(result.flowGraph);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, revision]);

  const edit = useCallback((next: string) => {
    setText(next);
    setRevision((r) => r + 1);
  }, []);

  const stale = projection?.invalid ?? false;
  const graph = stale ? lastValid : projection?.flowGraph ?? lastValid;
  const node = useMemo(() => graph?.nodes.find((n) => n.id === selected) ?? null, [graph, selected]);
  const flowName = firstFlowName(text);

  const send = useCallback(async (intent: Intent) => {
    if (!adapter.current) return;
    const result = await adapter.current.prepareEdit(intent, revision);
    setOutcome({ intent, outcome: result });
    if (result.status === 'applied') edit(applyEdits(text, result.edits));
  }, [edit, revision, text]);

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
            setOutcome(null);
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
        <span className="status">{projection === null ? 'starting engine…' : stale ? 'invalid text: diagram is stale' : `revision ${projection.revision}`}</span>
      </header>

      <div className="columns">
        <aside className="palette" aria-label="Palette">
          <h2>Palette</h2>
          <ul>
            {PALETTE.map((entry) => {
              const enabled = entry.op !== undefined;
              const transport = entry.op !== undefined && !(adapter.current?.capabilities().includes(entry.op) ?? false);
              return (
                <li key={entry.id}>
                  <button disabled={!enabled} title={entry.hint}>{entry.label}</button>
                  <small>{enabled ? (transport ? 'In KMP; no transport yet' : entry.hint) : entry.hint}</small>
                </li>
              );
            })}
          </ul>
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
          <Details node={node} flowName={flowName} disabled={stale} onIntent={send} outcome={outcome} onDiscard={() => setOutcome(null)} />
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

function Details(props: {
  node: FlowNode | null;
  flowName: string | null;
  disabled: boolean;
  onIntent: (intent: Intent) => void;
  outcome: { intent: Intent; outcome: EditOutcome } | null;
  onDiscard: () => void;
}) {
  const { node, flowName, disabled, onIntent, outcome, onDiscard } = props;
  if (!node) return <p className="hint">Click a node.</p>;
  const name = node.label;
  return (
    <div>
      <dl>
        <dt>Id</dt><dd>{node.id}</dd>
        <dt>Type</dt><dd>{node.type}</dd>
        {node.system && (<><dt>System</dt><dd>{node.system}</dd></>)}
        {node.service && (<><dt>Service</dt><dd>{node.service}</dd></>)}
        <dt>Source</dt><dd>{node.sourceRef.line}:{node.sourceRef.column}</dd>
      </dl>
      {flowName && node.type === 'COMMAND' && (
        <>
          <CommitField key={`rename-${node.id}`} label="Rename" initial={name} disabled={disabled}
            onCommit={(value) => value !== name && onIntent({ op: 'renameCommand', flowName, oldName: name, newName: value })} />
          <CommitField key={`emit-${node.id}`} label="Emits event" initial="" disabled={disabled}
            onCommit={(value) => value && onIntent({ op: 'addEmission', flowName, occurrenceKey: `${name}@definition`, eventName: value })} />
        </>
      )}
      {flowName && node.type === 'POLICY' && (
        <CommitField key={`trigger-${node.id}`} label="Trigger events (comma separated)" initial="" disabled={disabled}
          onCommit={(value) => value && onIntent({
            op: 'changePolicyTrigger', flowName, policyKey: name, events: value.split(',').map((e) => e.trim()).filter(Boolean),
          })} />
      )}
      {outcome && (
        <div className={`outcome ${outcome.outcome.status}`} role="status">
          <strong>{outcome.outcome.status}</strong> {outcome.intent.op}
          <div>{describe(outcome.outcome)}</div>
          <button onClick={onDiscard}>Discard</button>
        </div>
      )}
    </div>
  );
}

function describe(outcome: EditOutcome): string {
  switch (outcome.status) {
    case 'applied': return `${outcome.edits.length} edit(s) applied`;
    case 'invalid': return outcome.messages.join('; ');
    default: return outcome.reason;
  }
}

/** ZVE-R17: committed on Enter or on leaving the field; Escape cancels. Never per keystroke. */
function CommitField(props: { label: string; initial: string; disabled: boolean; onCommit: (value: string) => void }) {
  const [value, setValue] = useState(props.initial);
  const [done, setDone] = useState(false);
  const commit = () => {
    if (done) return;
    setDone(true);
    props.onCommit(value.trim());
    setDone(false);
  };
  return (
    <label className="field">{props.label}
      <input value={value} disabled={props.disabled}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.currentTarget.blur(); }
          if (e.key === 'Escape') { setValue(props.initial); setDone(true); e.currentTarget.blur(); setDone(false); }
        }} />
    </label>
  );
}
