# Dev editor (ZFL visual editor harness)

A browser page to iterate on the standalone visual ZFL editor outside VS Code ([ZVE-R24](https://github.com/ZenWave360/zenwave-specs/blob/main/flows/zfl-visual-editing.md)). Nothing here ships. For the read-only EventFlow pages see [dev-views.md](./dev-views.md).

Three columns: palette, canvas (the `packages/eventflow` visualizer), details panel. Below: the ZFL text (editable) and the diagnostics. Typing re-renders the canvas after 300 ms. Invalid text keeps the last valid diagram, drawn stale and not editable.

## Prerequisites

- Node `^20.19.0 || >=22.12.0` (Vite 7 requires it) and pnpm 10 (`corepack enable` gives you the pinned pnpm).
- Internet on the first install: the engine is the published npm package `@zenwave360/lsp-js` (the Kotlin engine compiled to JS, running in a Web Worker).
- A Chromium based browser, Edge, Chrome or Brave.

Nothing has to be built in dsl-kotlin or zenwave-lsp. No Gradle, no JDK.

## Start

In Git Bash, in this repo:

```
pnpm install
pnpm dev:editor
```

Open http://localhost:3001/ (the command tries to open it itself). Port 3001 is fixed so it can run beside `pnpm dev:views` (3000). Stop with Ctrl+C.

## Load a sample ZFL

- Pick one in the **Sample** select (top bar). The samples are `apps/zfl-editor-harness/samples/*.zfl`, copied from dsl-kotlin's test resources. Add a file there and reload to list it.
- Or **Load .zfl** and choose any file from disk.
- Or type in the text area.

Click a node to see it in the details panel. A command shows **Rename** and **Emits event**, a policy shows **Trigger events**. Values commit on Enter or on leaving the field, Escape cancels (ZVE-R17).

## What works and what does not

| Works | Stubbed |
| --- | --- |
| Text to diagram and diagnostics through lsp-js (`zenwave/eventFlowViews`, `publishDiagnostics`) | Edits: the three KMP operations (`renameCommand`, `addEmissionToOccurrence`, `changePolicyTrigger`) are disabled, with the reason shown, because the engine does not advertise them: lsp-js has no edit request yet. Tick **Mock edit engine** in the top bar to exercise the UI flows with an in-memory regex sketch that is not ZflEditor |
| Stale diagram on invalid text, empty state without a flow | Palette items for operations KMP does not have yet (add command/event/policy, connect, delete) and Arrange are disabled |
| Selection, details panel, FIFO intent queue (one in flight; after a rejection the later ones are cancelled and listed; Discard), stale handling by document revision, commit on Enter or blur with Escape to cancel | Pending drawing on the canvas, impact list, session placement, drag and drop from the palette (not built yet) |

The adapter seam is `apps/zfl-editor-harness/src/adapter.ts`. `lspWorkerAdapter.ts` implements it; VS Code will implement the same interface later. When an edit request exists in lsp-js, only `prepareEdit` in `lspWorkerAdapter.ts` changes: an `applied` outcome carries edits that the page already applies to the text.

## Troubleshooting

- **`pnpm: command not found`**: run `corepack enable`, then reopen Git Bash.
- **Port 3001 is in use**: another harness is running. Stop it, or find it with `netstat -ano | grep :3001`.
- **Status stays at "starting engine…"**: the worker did not load. Open the browser console. Check that `node_modules/@zenwave360/lsp-js` exists (rerun `pnpm install`).
- **The canvas is empty and the text has no `flow`**: expected; start one in the text, for example `flow Booking { }`.
- **The canvas is greyed with "stale"**: the text has an error; see the diagnostics list.
- **React Flow warnings about `target handle id: "undefined"` for TRIGGER edges** in the console: known, from the engine's projection, harmless here.
- **The first load is slow**: the worker is 7 MB.
- **`pnpm test` fails in `packages/eventflow-webview`**: run `pnpm build` first, as that package's tests expect.
