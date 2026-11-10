// Dev only: plays the IDE host for the page, fed by the files of dev/devViewsPlugin.ts. The whole body is behind
// import.meta.env.DEV so the production build drops it.
if (import.meta.env.DEV) {
  interface Entry {
    file: string;
    name: string;
    kind: 'eventflow' | 'mermaid' | 'error';
    mtime: number;
  }
  interface Variant {
    id: string;
    title: string;
  }
  interface EventFlowFile {
    name?: string;
    source?: string;
    generatedAt?: string;
    flowGraph?: unknown;
    serviceGraph?: unknown;
    variants?: Variant[];
    variantGraphs?: Record<string, unknown>;
    laneGraphs?: Record<string, unknown>;
  }
  type Lanes = 'none' | 'systems' | 'services';

  const STORAGE_KEY = 'zenwave.devViews.eventflow';
  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as { file?: string; follow?: boolean; lanes?: Lanes; collapsed?: boolean };
    } catch {
      return {} as { file?: string; follow?: boolean; lanes?: Lanes; collapsed?: boolean };
    }
  })();

  const state = {
    entries: [] as Entry[],
    file: stored.file ?? '',
    follow: stored.follow ?? true,
    lanes: (stored.lanes ?? 'none') as Lanes,
    collapsed: stored.collapsed ?? false,
    variant: null as string | null,
    ready: false,
    loaded: null as EventFlowFile | null,
    error: '',
  };

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ file: state.file, follow: state.follow, lanes: state.lanes, collapsed: state.collapsed }));
    } catch {
      // storage unavailable
    }
  };

  const nameOf = (file: string) => file.replace(/\.eventflow\.json$/, '');
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

  function send(type: string, payload: unknown) {
    window.postMessage({ type, payload }, '*');
  }

  async function fetchText(file: string): Promise<string | null> {
    const response = await fetch(`/__dev/views/${encodeURIComponent(file)}`, { cache: 'no-store' });
    return response.ok ? response.text() : null;
  }

  async function refreshList() {
    const response = await fetch('/__dev/views', { cache: 'no-store' });
    state.entries = response.ok ? ((await response.json()) as Entry[]) : [];
  }

  function sendBundle() {
    const data = state.loaded;
    if (!data || !state.ready) return;
    const variants = data.variants ?? [];
    if (state.variant !== null && !variants.some((v) => v.id === state.variant)) state.variant = null;
    let flowGraph = data.flowGraph ?? null;
    if (state.variant !== null) flowGraph = data.variantGraphs?.[state.variant] ?? flowGraph;
    else if (state.lanes !== 'none') flowGraph = data.laneGraphs?.[state.lanes] ?? flowGraph;
    send('renderBundle', {
      flowGraph,
      serviceGraph: data.serviceGraph ?? null,
      variants,
      variant: state.variant,
      diagramId: data.name ?? nameOf(state.file),
      // The page's own Lanes control and the dev panel's select stay in step.
      lanesSupported: Boolean(data.laneGraphs),
      displaySettings: { lanes: state.lanes },
    });
  }

  async function show() {
    const file = state.file;
    state.error = '';
    state.loaded = null;
    if (file) {
      const name = nameOf(file);
      const errorEntry = state.entries.find((e) => e.kind === 'error' && e.name === name);
      const jsonEntry = state.entries.find((e) => e.file === file);
      if (errorEntry && (!jsonEntry || errorEntry.mtime >= jsonEntry.mtime)) {
        state.error = (await fetchText(errorEntry.file)) ?? '';
      }
      if (jsonEntry) {
        const text = await fetchText(file);
        try {
          state.loaded = text ? (JSON.parse(text) as EventFlowFile) : null;
        } catch (e) {
          state.error = `${state.error}\nCould not parse ${file}: ${(e as Error).message}`.trim();
        }
      }
    }
    sendBundle();
    renderPanel();
  }

  async function init() {
    await refreshList();
    const files = state.entries.filter((e) => e.kind === 'eventflow');
    if (!files.some((f) => f.file === state.file)) {
      state.file = [...files].sort((a, b) => b.mtime - a.mtime)[0]?.file ?? '';
    }
    await show();
  }

  window.__zenwaveHost = {
    postMessage(message) {
      const msg = message as { type?: string; payload?: { variant?: string | null } };
      switch (msg.type) {
        case 'webviewReady':
          state.ready = true;
          void init();
          break;
        case 'variantChanged':
          state.variant = msg.payload?.variant ?? null;
          sendBundle();
          break;
        case 'savePositions':
          console.log('[dev host] savePositions', msg.payload);
          if (state.file) {
            void fetch(`/__dev/views/${encodeURIComponent(`${nameOf(state.file)}.positions.json`)}`, {
              method: 'POST',
              body: JSON.stringify(msg.payload),
            });
          }
          break;
        case 'lanesChanged': {
          const lanes = (msg.payload as { lanes?: Lanes } | undefined)?.lanes;
          if (lanes === 'none' || lanes === 'systems' || lanes === 'services') {
            state.lanes = lanes;
            sendBundle();
            renderPanel();
          }
          break;
        }
        case 'viewModeChanged':
        case 'labelsChanged':
          console.debug('[dev host]', msg.type, msg.payload);
          break;
        default:
          console.debug('[dev host] unhandled message', msg);
      }
    },
  };

  let panel: HTMLDivElement | null = null;
  function renderPanel() {
    if (!document.body) return;
    if (!panel) {
      panel = document.createElement('div');
      panel.style.cssText =
        'position:fixed;bottom:36px;right:8px;z-index:99999;font:12px system-ui,sans-serif;background:rgba(30,30,30,.92);color:#eee;border-radius:6px;padding:6px 8px;max-width:340px;box-shadow:0 2px 8px rgba(0,0,0,.4)';
      document.body.appendChild(panel);
    }
    const files = state.entries.filter((e) => e.kind === 'eventflow');
    const data = state.loaded;
    const options = files.map((f) => `<option value="${esc(f.file)}" ${f.file === state.file ? 'selected' : ''}>${esc(f.file)}</option>`).join('');
    const laneOptions = (['none', 'systems', 'services'] as Lanes[]).map((l) => `<option ${l === state.lanes ? 'selected' : ''}>${l}</option>`).join('');
    panel.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between">
        <strong>dev views</strong>
        <span><a href="/mermaid.html" style="color:#8cf">mermaid</a> <button data-act="toggle" style="cursor:pointer">${state.collapsed ? '+' : '&minus;'}</button></span>
      </div>
      <div ${state.collapsed ? 'hidden' : ''} style="margin-top:6px;display:grid;gap:4px">
        <select data-act="file">${files.length === 0 ? '<option value="">(no *.eventflow.json files)</option>' : options}</select>
        <label><input type="checkbox" data-act="follow" ${state.follow ? 'checked' : ''}> follow latest</label>
        <label>Lanes <select data-act="lanes">${laneOptions}</select></label>
        ${data ? `<div style="opacity:.7">generated ${esc(data.generatedAt ?? '?')}<br>source ${esc(data.source ?? '?')}</div>` : ''}
        ${state.error ? `<pre style="margin:0;padding:6px;background:#5a1d1d;color:#fdd;white-space:pre-wrap;max-height:240px;overflow:auto">${esc(state.error)}</pre>` : ''}
      </div>`;
  }

  document.addEventListener('change', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target || !panel?.contains(target)) return;
    const act = target.getAttribute('data-act');
    if (act === 'file') {
      state.file = (target as HTMLSelectElement).value;
      state.variant = null;
      save();
      void show();
    } else if (act === 'follow') {
      state.follow = (target as HTMLInputElement).checked;
      save();
    } else if (act === 'lanes') {
      state.lanes = (target as HTMLSelectElement).value as Lanes;
      save();
      sendBundle();
    }
  });
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.getAttribute('data-act') === 'toggle' && panel?.contains(target)) {
      state.collapsed = !state.collapsed;
      save();
      renderPanel();
    }
  });

  import.meta.hot?.on('zenwave:dev-views', async (data: { file: string; kind: string }) => {
    await refreshList();
    if (data.kind === 'eventflow' && state.follow && state.entries.some((e) => e.file === data.file)) {
      if (state.file !== data.file) state.variant = null;
      state.file = data.file;
      save();
      await show();
    } else if (data.file === state.file || data.file === `${nameOf(state.file)}.error.txt`) {
      await show();
    } else {
      renderPanel();
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderPanel);
  else renderPanel();
  void refreshList().then(renderPanel);
}

export {};
