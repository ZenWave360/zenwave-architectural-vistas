# @zenwave360/vistas-eventflow-webview

The EventFlow and Service Map visualizer as a static web page, for IDE hosts: VS Code webviews, IntelliJ JCEF, or any
page that embeds it in an iframe. The page is built from `apps/eventflow-webview` and has no runtime dependencies.

For a React application, use `@zenwave360/vistas-eventflow` instead.

## Contents

```text
webview/
  index.html        page entry; references ./assets/* only, with relative URLs
  assets/index-*.js the page script, including the host bridge
  assets/index-*.css all styles; system fonts only, no @font-face, no url() except data:
  protocol.json     {"protocol":"zenwave.eventflow.webview","protocolVersion":1}
index.js            protocol constants (no Node API)
```

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

A host that receives no `webviewReady` is looking at a page that is still loading or failed to load.
`payload` was added in protocol version 1; a page without it predates versioning.

### Host to page

Hosts send messages with `window.postMessage` semantics: VS Code `webview.postMessage(message)`, JCEF
`executeJavaScript("window.postMessage(message, '*')")`, or `iframe.contentWindow.postMessage(message, '*')`.

| `type` | `payload` | Effect |
| --- | --- | --- |
| `renderBundle` | `{ flowGraph?, serviceGraph?, viewMode?: "flow" \| "services", displaySettings?: { humanizeLabels?: boolean } }` | Shows the given view models. Pass the server's `flowGraph` and `serviceGraph` unchanged. A missing or `null` graph shows a waiting state for that view. `displaySettings` is merged into the current settings. |
| `setViewMode` | `{ viewMode: "flow" \| "services" }` | Switches the view without resending the model. |
| `setDisplaySettings` | `{ displaySettings: { humanizeLabels?: boolean } }` | Merged into the current settings; fields not sent keep their values. |
| `highlightNode` | `{ nodeId: string \| null }` | Highlights the flow node with that id (for example a hierarchy node's `viewNodeIds` entry); `null` clears it. |
| `renderGraph` | `{ graph }` | Legacy flow-only form. Use `renderBundle`. |

Messages that arrive before the renderer has started are queued and applied when it starts. Messages with an unknown
`type`, or without a string `type`, are ignored.

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
