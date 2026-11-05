# @zenwave360/vistas-eventflow-webview

The EventFlow and Service Map visualizer as static web pages, for IDE hosts: VS Code webviews, IntelliJ JCEF, or any
page that embeds them in an iframe. The pages have no runtime dependencies. There are two, built from the same diagram
component (`packages/eventflow-page`):

| Directory | Built from | Use it when |
| --- | --- | --- |
| `webview/` | `apps/eventflow-webview` | The host has its own controls, such as the IntelliJ Swing toolbar. The page has no selector. |
| `webview-toolbar/` | `apps/eventflow-toolbar-webview` | The host has no toolbar inside the editor, such as VS Code. The page adds a Flow / Systems selector and, when the flow has variants, a variant dropdown. |

Both pages draw zoom and fit controls inside the diagram, speak the same protocol and have the same protocol version.

For a React application, use `@zenwave360/vistas-eventflow` instead.

## Contents

```text
webview/
  index.html        page entry; references ./assets/* only, with relative URLs
  assets/index-*.js the page script, including the host bridge
  assets/index-*.css all styles; system fonts only, no @font-face, no url() except data:
  protocol.json     {"protocol":"zenwave.eventflow.webview","protocolVersion":1}
webview-toolbar/    the page with a Flow / Systems selector; same files and shape as webview/
  index.html
  assets/index-*.js
  assets/index-*.css
  protocol.json
index.js            protocol constants (no Node API)
```

Everything below applies to both pages. Replace `webview/` with `webview-toolbar/` to load the page with a selector;
`@zenwave360/vistas-eventflow-webview/webview-toolbar/*` and `.../webview-toolbar/protocol.json` are exported.

Asset file names contain a content hash and change between versions. Read them from `index.html`; do not hard-code them.

## Loading the page

1. Serve the whole `webview/` directory from one location. In VS Code, add it to `localResourceRoots`.
2. Read `webview/index.html`. It contains no inline script, inline style or remote reference. Every `src` and `href`
   is relative (`./assets/…`). Either serve the page from the same directory, or rewrite those attributes to your
   host's resource URLs (in VS Code, `webview.asWebviewUri`).
3. Apply a content security policy. The page needs only scripts and styles from where you serve the assets, for
   example `default-src 'none'; script-src ${cspSource}; style-src ${cspSource}; img-src ${cspSource} data:;
   font-src ${cspSource}`. No `'unsafe-inline'` and no nonce are needed. If your host adds its own inline script,
   give that script a nonce.
4. The page script and stylesheet carry the `crossorigin` attribute. When assets come from another origin than the
   page, the asset responses must allow it (VS Code webview resources do).

The page is tested in a headless browser under that policy. The test fails on any CSP violation, any request to a
non-local origin, and any failed request. See `test/browser.test.mjs`.

## Messages

### Page to host: `webviewReady`

Sent once, when the page has loaded:

```json
{ "type": "webviewReady", "payload": { "protocol": "zenwave.eventflow.webview", "protocolVersion": 1 } }
```

The page picks the first channel that exists:

1. `window.__zenwaveHost.postMessage(message)`, when the host injected such an object before the page script ran.
2. The VS Code webview API. The page calls `acquireVsCodeApi()` once and stores the result on
   `window.__zenwaveVsCodeApi`. VS Code throws on a second call, so a host script in the same webview must not call
   `acquireVsCodeApi()` itself after the page did. If a host script needs the API **before** the page script runs,
   it calls `acquireVsCodeApi()` and stores the result on `window.__zenwaveVsCodeApi`; the page then uses that object.
3. `window.parent.postMessage(message, "*")`, only when the page is inside a frame (`parent !== window`).
4. Otherwise, no message is sent. This is the IntelliJ JCEF case: JCEF uses the browser load event instead.

### Page to host: `viewModeChanged`

Sent only by the page in `webview-toolbar/`, when the user changes the view in its selector:

```json
{ "type": "viewModeChanged", "payload": { "viewMode": "services" } }
```

It uses the same channel as `webviewReady`. The page does not send it when the host asked for the change with
`setViewMode` or `renderBundle`; the selector follows those messages silently. The page in `webview/` never sends it.
A host may ignore it, so adding it did not change `protocolVersion`.

### Page to host: `variantChanged`

Sent only by the page in `webview-toolbar/`, when the user chooses a variant or the full diagram:

```json
{ "type": "variantChanged", "payload": { "variant": "OrderCancelled" } }
```

`variant` is `null` for the full diagram:

```json
{ "type": "variantChanged", "payload": { "variant": null } }
```

The page does not change the graph. It waits for the host to send a `renderBundle` whose `flowGraph` is the laid-out
graph for that choice. It does not send `variantChanged` when that bundle, or any other host message, sets the
choice. The dropdown moves at the user's click, and a later host bundle replaces the selection without a message.
The page in `webview/` never sends it. A host may ignore it, so adding it did not change `protocolVersion`.

### Page to host: `savePositions`

Sent only by the page in `webview-toolbar/`, when the user clicks **Save positions** on the toolbar:

```json
{ "type": "savePositions", "payload": { "positions": { "event:Start": { "x": 40, "y": 80 }, "command:PlaceOrder": { "x": 320, "y": 80 } } } }
```

The button is on the right of the toolbar. It shows only in the Flow view of the full diagram, and only after the user
moved a node since the last `renderBundle` that carried a graph. It is hidden again after the click, when a new
graph arrives, in a variant, and in Systems. `positions` has every node of the full diagram as it is shown, by node
id, rounded to whole numbers. The host writes all of them or none; discarding saved positions is the host's. The page
in `webview/` has no button and never sends it. A host may ignore it, so `protocolVersion` stays 1.

### Page to host: `labelsChanged`

Sent only by the page in `webview-toolbar/`, when the user flips the **Humanize labels** toggle:

```json
{ "type": "labelsChanged", "payload": { "humanize": false } }
```

The toggle starts from `displaySettings.humanizeLabels` (true when the host never sent it). The page re-renders its
labels at once and then sends this message. It is not sent when the host sets `displaySettings`. A host may ignore it, so
`protocolVersion` stays 1.

| Direction | `type` | `payload` | Sent by |
| --- | --- | --- | --- |
| page to host | `webviewReady` | `{ protocol, protocolVersion }` | both pages, once, when loaded |
| page to host | `viewModeChanged` | `{ viewMode: "flow" \| "services" }` | `webview-toolbar/` only, for the user's own choice |
| page to host | `variantChanged` | `{ variant: string \| null }` | `webview-toolbar/` only, for the user's own choice. `null` is the full diagram |

| page to host | `savePositions` | `{ positions: { [nodeId]: { x, y } } }` | `webview-toolbar/` only, after the user clicks Save positions |
| page to host | `labelsChanged` | `{ humanize: boolean }` | `webview-toolbar/` only, when the user flips Humanize labels |

A host that receives no `webviewReady` is looking at a page that is still loading or failed to load.
`payload` was added in protocol version 1; a page without it predates versioning.

### Host to page

Hosts send messages with `window.postMessage` semantics: VS Code `webview.postMessage(message)`, JCEF
`executeJavaScript("window.postMessage(message, '*')")`, or `iframe.contentWindow.postMessage(message, '*')`.

| `type` | `payload` | Effect |
| --- | --- | --- |
| `renderBundle` | `{ flowGraph?, serviceGraph?, viewMode?: "flow" \| "services", displaySettings?: { humanizeLabels?: boolean }, diagramId?: string, variants?: [{ id, title }], variant?: string \| null }` | Shows the given view models. Pass the server's `flowGraph` and `serviceGraph` unchanged. A missing or `null` graph shows a waiting state for that view. `displaySettings` is merged into the current settings. A host should send something stable for one diagram, such as the document URI and the flow name, as `diagramId`. `diagramId` belongs to the diagrams in the same `renderBundle`; a bundle with a graph and no `diagramId` has no identity. A bundle that changes only `viewMode` or display settings leaves the identity alone. `variants` and `variant` are optional; see below. |
| `setViewMode` | `{ viewMode: "flow" \| "services" }` | Switches the view without resending the model. In `webview-toolbar/` the selector moves too, and the page sends no `viewModeChanged`. |
| `setDisplaySettings` | `{ displaySettings: { humanizeLabels?: boolean } }` | Merged into the current settings; fields not sent keep their values. |
| `highlightNode` | `{ nodeId: string \| null }` | Highlights the flow node with that id (for example a hierarchy node's `viewNodeIds` entry); `null` clears it. |
| `renderGraph` | `{ graph }` | Legacy flow-only form. Use `renderBundle`. |

Messages that arrive before the renderer has started are queued and applied when it starts. Messages with an unknown
`type`, or without a string `type`, are ignored.

### Variants on `renderBundle`

`variants` and `variant` ride on `renderBundle`. A host that sends neither gets the page it gets today: no dropdown,
and the flow frames on `diagramId` alone.

```json
{
  "type": "renderBundle",
  "payload": {
    "flowGraph": {},
    "serviceGraph": {},
    "viewMode": "flow",
    "diagramId": "file:///flows/checkout.zfl#Checkout",
    "variants": [
      { "id": "OrderCancelled", "title": "Order Cancelled" },
      { "id": "PaymentFailed", "title": "Payment Failed" }
    ],
    "variant": null
  }
}
```

| Field | When omitted | When sent |
| --- | --- | --- |
| `variants` | The current list stays. The first bundle has none, so the dropdown stays hidden. | Replaces the list. `[]` hides the dropdown. Entries without a non-empty string `id` are dropped, and a repeated `id` is dropped. A missing or empty `title` is shown as the `id`. Order is kept. |
| `variant` | The current selection stays. | A string `id` that is in the current list selects that variant. `null`, `""`, or an id that is not in the list selects the full diagram. |

Send the list in the same bundle as the selection, or in an earlier one. The page shows `flowGraph` as the host sent
it. It does not filter the full diagram down to a variant and it does not lay nodes out. The server's graph for that
variant is the graph to put in `flowGraph`.

The dropdown is part of `webview-toolbar/` only. It lists "Full diagram" and then each variant. It is not rendered
when `variants` is empty, and not rendered while Systems is showing. A host `renderBundle` moves it and sends no
`variantChanged`. The minimal page has no dropdown. Its host sends the same fields and the matching `flowGraph`.

### `diagramId` when a variant is showing

A variant bundle keeps the full diagram's `diagramId`. That id names the flow, for example the document URI and the
flow name, and a variant is the same flow.

The page frames the flow canvas on `diagramId` together with the variant whose graph is on screen. Choosing a
variant, or returning to the full diagram, changes that identity, so the opening zoom runs for the graph in that
bundle. A later bundle for the same `diagramId` and the same variant does not move the view, including a bundle that
only moves nodes. Systems keeps framing on `diagramId` alone. A host that sends a different `diagramId` still
reframes, as it does today.

The dropdown can show the user's choice before that bundle arrives. Framing follows the variant in the bundle, which
is the graph on screen, so the opening zoom runs when the variant's graph arrives and not before.

### Node positions

Dragging a node updates the canvas only. The page tells the host about positions only through `savePositions`, when
the user clicks Save positions in `webview-toolbar/`, and never for a variant. A variant never reads or writes saved
positions. The next `renderBundle` replaces the graph with what the host sends.

### `savedPositions`

`renderBundle` may carry `savedPositions: { exists, applied, missing? }` (`missing` is the array of node ids the saved positions do not cover), what the host did with the positions saved
for this flow. When `exists` is true and `applied` is false, `webview-toolbar/` shows a small note, "Saved positions do
not match this flow; automatic layout", with the number of `missing` ids when given. When `applied` is true it shows a subtle
"Saved layout". Without the field, or with `exists: false`, nothing is shown, and nothing is shown for a variant.
The minimal page shows nothing.

### IntelliJ

`pnpm sync:intellij` builds the minimal page and copies `apps/eventflow-webview/dist` into the plugin
(`src/main/resources/web/eventflow`). It does not copy `webview-toolbar/`. The script needs no change for variants:
the copied page accepts the new fields and still has no dropdown. A Swing control that offers variants reads
`variants` from `zenwave/eventFlowViews` and sends `renderBundle` with `variant`, the full diagram's `diagramId`,
and that variant's laid-out `flowGraph`. The minimal page does not send `variantChanged`.

## Versioning

The protocol version is available without running the page:

- `import { EVENTFLOW_WEBVIEW_PROTOCOL_VERSION } from '@zenwave360/vistas-eventflow-webview'`
- `@zenwave360/vistas-eventflow-webview/protocol.json`
- `<meta name="zenwave-webview-protocol-version" content="1">` in `index.html`

and at run time in the `webviewReady` payload.

`protocolVersion` changes only when a change is not backwards compatible for a host: a message is removed or renamed,
or a payload field changes meaning. New optional fields and new message types keep the version, because the page
ignores what it does not know.

A host should pin an exact package version in its lockfile, check `protocolVersion` at build time (or on
`webviewReady`), and show an error instead of a blank panel when the version is not one it supports.
