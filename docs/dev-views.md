# Dev views

A dev loop for debugging EventFlow rendering and Mermaid diagrams. Nothing here ships: the plugin applies to `vite serve` only, `src/devHost.ts` sits behind `import.meta.env.DEV`, and `mermaid.html` is not a build input.

## Start

```
pnpm dev:views
```

Opens http://localhost:3000/, the real toolbar page (`apps/eventflow-toolbar-webview`), with a small dev panel at the top right: file select, follow latest, Lanes (none/systems/services), what is shown, and the generator error if there is one. http://localhost:3000/mermaid.html renders every diagram of a `*.mermaid.json` file with its source and any parse error. Edits to `packages/eventflow` and `packages/eventflow-page` hot reload.

## Where the files come from

dsl-kotlin writes them, atomically, into `dsl-kotlin/build/dev-views` (next to this repo):

```
./gradlew.bat :dsl-views:jvmTest --tests io.zenwave.language.dev.DevViewsExport -PdevViewsInput=<file or dir>
```

or run the same test from IntelliJ. Files: `<name>.eventflow.json`, `<name>.mermaid.json`, and `<name>.error.txt` when the generator failed. Set `ZENWAVE_DEV_VIEWS_DIR` to use another directory (printed on startup, created if missing).

## POST endpoint

```
curl -X POST --data-binary @flow.json http://localhost:3000/__dev/views/foo.eventflow.json
```

`GET /__dev/views` lists the files; `GET /__dev/views/<file>` reads one. A body that is a bare FlowViewModel (`"schema": "zfl.eventflow.view@1"`) is wrapped as `{flowGraph: body}`. `.mermaid.json` and `.positions.json` (written by the page's Save positions) are accepted too. Every change is pushed to open pages over the Vite websocket (`zenwave:dev-views`).
