// Dev only (mermaid.html is not an input of the build): renders the diagrams of the *.mermaid.json files that
// dsl-kotlin's DevViewsExport writes. Re-renders when the dev server reports a change.
import mermaid from 'mermaid';

interface Entry {
  file: string;
  name: string;
  kind: 'eventflow' | 'mermaid' | 'error';
  mtime: number;
}
interface Diagram {
  id: string;
  title?: string;
  mermaid: string;
  group?: string;
}
interface MermaidFile {
  name?: string;
  source?: string;
  generatedAt?: string;
  diagrams?: Diagram[];
}
type Theme = 'light' | 'dark';

const STORAGE_KEY = 'zenwave.devViews.mermaid';
let stored: { file?: string; follow?: boolean; theme?: Theme } = {};
try {
  stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
} catch {
  stored = {};
}
const state = {
  entries: [] as Entry[],
  file: stored.file ?? '',
  follow: stored.follow ?? true,
  theme: (stored.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) as Theme,
};
const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ file: state.file, follow: state.follow, theme: state.theme }));
  } catch {
    // storage unavailable
  }
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const nameOf = (file: string) => file.replace(/\.mermaid\.json$/, '');

const style = document.createElement('style');
style.textContent = `
  :root { --bg:#fff; --fg:#1f2328; --muted:#656d76; --card:#f6f8fa; --line:#d0d7de; }
  :root[data-theme=dark] { --bg:#0d1117; --fg:#e6edf3; --muted:#8b949e; --card:#161b22; --line:#30363d; }
  body { margin:0; background:var(--bg); color:var(--fg); font:14px system-ui,sans-serif; }
  header { position:sticky; top:0; z-index:5; display:flex; flex-wrap:wrap; gap:12px; align-items:center; padding:8px 16px; background:var(--card); border-bottom:1px solid var(--line); }
  main { padding:16px; display:grid; gap:16px; }
  section { border:1px solid var(--line); border-radius:6px; background:var(--card); padding:12px; }
  h2 { margin:0 0 8px; font-size:15px; }
  .group { color:var(--muted); font-weight:normal; }
  .out { overflow:auto; background:var(--bg); padding:8px; border-radius:4px; }
  .err { color:#f85149; white-space:pre-wrap; font:12px ui-monospace,monospace; margin:8px 0; }
  .generator-error { background:#5a1d1d; color:#fdd; padding:8px; white-space:pre-wrap; margin:0; }
  pre.src { margin:0; padding:8px 0; overflow:auto; font:12px ui-monospace,monospace; }
  pre.src span { display:block; padding:0 8px; }
  pre.src span::before { content:attr(data-n); display:inline-block; width:3ch; margin-right:1ch; color:var(--muted); text-align:right; }
  .muted { color:var(--muted); }
`;
document.head.appendChild(style);
const app = document.getElementById('app')!;
let counter = 0;

async function fetchText(file: string): Promise<string | null> {
  const response = await fetch(`/__dev/views/${encodeURIComponent(file)}`, { cache: 'no-store' });
  return response.ok ? response.text() : null;
}

async function refreshList() {
  const response = await fetch('/__dev/views', { cache: 'no-store' });
  state.entries = response.ok ? ((await response.json()) as Entry[]) : [];
  const files = state.entries.filter((e) => e.kind === 'mermaid');
  if (!files.some((f) => f.file === state.file)) state.file = [...files].sort((a, b) => b.mtime - a.mtime)[0]?.file ?? '';
}

async function render() {
  document.documentElement.setAttribute('data-theme', state.theme);
  mermaid.initialize({ startOnLoad: false, theme: state.theme === 'dark' ? 'dark' : 'default', securityLevel: 'loose' });
  const files = state.entries.filter((e) => e.kind === 'mermaid');
  const jsonEntry = state.entries.find((e) => e.file === state.file);
  const errorEntry = state.entries.find((e) => e.kind === 'error' && e.name === nameOf(state.file));
  let error = '';
  if (errorEntry && (!jsonEntry || errorEntry.mtime >= jsonEntry.mtime)) error = (await fetchText(errorEntry.file)) ?? '';
  let data: MermaidFile | null = null;
  if (jsonEntry) {
    try {
      data = JSON.parse((await fetchText(state.file)) ?? 'null') as MermaidFile | null;
    } catch (e) {
      error = `${error}\nCould not parse ${state.file}: ${(e as Error).message}`.trim();
    }
  }
  const diagrams = data?.diagrams ?? [];
  const options = files.map((f) => `<option value="${esc(f.file)}" ${f.file === state.file ? 'selected' : ''}>${esc(f.file)}</option>`).join('');
  const sections = diagrams
    .map((d, i) => {
      const lines = d.mermaid
        .split('\n')
        .map((l, n) => `<span data-n="${n + 1}">${esc(l) || ' '}</span>`)
        .join('');
      return `<section>
        <h2>${d.group ? `<span class="group">${esc(d.group)} / </span>` : ''}${esc(d.title ?? d.id)} <span class="muted">(${esc(d.id)})</span></h2>
        <div class="out" id="out-${i}"></div>
        <details><summary class="muted">source</summary><pre class="src">${lines}</pre></details>
      </section>`;
    })
    .join('');

  app.innerHTML = `
    <header>
      <strong>Mermaid dev views</strong>
      <a href="/" style="color:#58a6ff">eventflow</a>
      <select data-act="file">${files.length === 0 ? '<option value="">(no *.mermaid.json files)</option>' : options}</select>
      <label><input type="checkbox" data-act="follow" ${state.follow ? 'checked' : ''}> follow latest</label>
      <button data-act="theme">${state.theme === 'dark' ? 'Light' : 'Dark'} theme</button>
      ${data ? `<span class="muted">generated ${esc(data.generatedAt ?? '?')} from ${esc(data.source ?? '?')}</span>` : ''}
    </header>
    <main>
      ${error ? `<pre class="generator-error">${esc(error)}</pre>` : ''}
      ${sections}
    </main>`;

  for (const [i, d] of diagrams.entries()) {
    const out = document.getElementById(`out-${i}`)!;
    const id = `dev-mermaid-${counter++}`;
    try {
      const { svg } = await mermaid.render(id, d.mermaid);
      out.innerHTML = svg;
    } catch (e) {
      out.innerHTML = `<div class="err">${esc(e instanceof Error ? e.message : String(e))}</div>`;
      document.getElementById(id)?.remove();
      document.getElementById(`d${id}`)?.remove();
    }
  }
}

app.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement;
  const act = target.getAttribute('data-act');
  if (act === 'file') {
    state.file = target.value;
    save();
    void render();
  } else if (act === 'follow') {
    state.follow = target.checked;
    save();
  }
});
app.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).getAttribute('data-act') === 'theme') {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    save();
    void render();
  }
});

import.meta.hot?.on('zenwave:dev-views', async (data: { file: string; kind: string }) => {
  await refreshList();
  if (data.kind === 'mermaid' && state.follow && state.entries.some((e) => e.file === data.file)) {
    state.file = data.file;
    save();
    await render();
  } else if (data.file === state.file || data.file === `${nameOf(state.file)}.error.txt`) {
    await render();
  }
});

void refreshList().then(render);
