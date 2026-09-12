# ZFL Event Flow Renderer - Architecture and Contracts

## 1. Purpose

The ZFL Event Flow renderer is the visualization layer for event-flow diagrams in the ZFL ecosystem.

Its job is to take a pre-built `FlowViewModel` JSON document and render it as an interactive graph in a browser or embedded webview. It is intentionally downstream from parsing and semantic analysis.

In practical terms, the renderer exists to let a host such as the IntelliJ plugin:

- display event-flow topology
- let users inspect nodes and edges
- let users click graph elements and map them back to source locations
- optionally let users drag nodes and persist updated layout metadata

The renderer is not the source of truth for ZFL semantics. The source of truth remains the parser/language side that produces the graph model.

## 2. Scope of responsibility

### What the renderer owns

- Rendering a `FlowViewModel` into a node/edge graph
- Visual mapping of ZFL event-flow concepts to graph shapes and colors
- Local interaction inside the canvas
- Emitting UI-level interaction callbacks
- Returning updated node positions when drag-based editing is enabled
- Tolerating partially laid-out models by skipping nodes without layout coordinates

### What the renderer does not own

- Parsing `.zfl` source text
- Resolving imports, models, or semantic correctness
- Building the event-flow graph from source code
- Computing graph layout
- Source navigation policy
- Host-side message transport
- Persistence of layout or selection state

### Boundary with parser

The parser owns source-to-model transformation. It decides what nodes and edges exist, their semantic type, labels, IDs, and source references.

The renderer assumes that parsing is already complete and consumes JSON only.

### Boundary with language server

The language server owns project awareness, file resolution, diagnostics, symbol/source navigation, and any server-side generation of `FlowViewModel`.

The renderer does not call the language server directly. A host must fetch the model from the language server and pass it into the renderer.

### Boundary with IntelliJ plugin

The IntelliJ plugin owns embedding, message transport, model loading, host commands, selection synchronization with other IntelliJ UI, error presentation outside the canvas, and persistence.

The renderer owns only the in-webview graph UI.

## 3. Technology stack

### Core stack

- React 18
- TypeScript 5
- React Flow 11
- Vite 7 for dev/build

### Rendering model

The renderer is a React component named `EventFlowVisualizer`.

It receives a full `FlowViewModel` object as props and transforms it into React Flow nodes and edges. Rendering is declarative: whenever the host replaces `flowViewModel`, the graph is re-derived from that new model.

There is no internal automatic layout engine. The renderer expects absolute node positions and dimensions to already be present when the host wants a visible graph.

### Embedding assumptions

The current implementation is a React component library, not a standalone protocol-driven web app.

That means:

- the implemented public contract today is the component prop/callback API
- a host-facing message bridge must be supplied by the embedding layer
- the IntelliJ plugin should treat the renderer as a UI component wrapped by a small adapter

### Browser/webview assumptions

- Runs in a DOM environment
- Requires standard browser APIs used by React, React DOM, and React Flow
- Assumes pointer/mouse interaction is available
- Assumes the host gives the root container a real width and height
- Assumes modern JavaScript support roughly aligned with `ES2020`

For JCEF/IntelliJ, the host should provide a container that fills the available panel space and avoid mounting the renderer into a zero-height root.

## 4. Input contract

### Canonical top-level shape

The renderer consumes a `FlowViewModel` object with this shape:

```json
{
  "schema": "zfl.eventflow.view@1",
  "nodes": [],
  "edges": [],
  "layout": null,
  "bounds": null,
  "systemGroups": null
}
```

### Top-level fields

- `schema: string`
  Must currently be `zfl.eventflow.view@1`.
- `nodes: FlowNode[]`
  Required. May be empty.
- `edges: FlowEdge[]`
  Required. May be empty.
- `layout: LayoutMetadata | null`
  Optional in practice, but expected for a fully laid-out graph.
- `bounds: FlowBounds | null`
  Optional in practice. Used as metadata only.
- `systemGroups: FlowSystemGroupView[] | null`
  Present in the schema but ignored by the current renderer.

### Node fields

Each node has this shape:

```json
{
  "id": "command:renewSubscription",
  "type": "COMMAND",
  "label": "renewSubscription",
  "system": "Subscription",
  "service": "SubscriptionService",
  "sourceRef": {
    "file": "subscription-flow.zfl",
    "line": 3,
    "column": 1
  },
  "position": {
    "x": 220,
    "y": 160
  },
  "dimensions": {
    "width": 180,
    "height": 64
  }
}
```

Required node fields:

- `id: string`
  Unique in the graph. Edges reference this ID.
- `type: "START" | "COMMAND" | "EVENT" | "POLICY" | "END"`
- `label: string`
- `system: string | null`
- `service: string | null`
- `sourceRef: SourceRef`
- `position: { x: number, y: number } | null`
- `dimensions: { width: number, height: number } | null`

### Edge fields

Each edge has this shape:

```json
{
  "id": "e4",
  "source": "policy:SubscriptionRenewed:chargePayment",
  "target": "command:chargePayment",
  "type": "TRIGGER",
  "label": null,
  "sourceRef": null
}
```

Required edge fields:

- `id: string`
- `source: string`
  Must match a node ID.
- `target: string`
  Must match a node ID.
- `type: "CAUSATION" | "TRIGGER" | "CONDITIONAL" | "ERROR"`
- `label: string | null`
- `sourceRef: SourceRef | null`

### Node type/category expectations

The current visual mapping is fixed:

- `START`: start node styling
- `COMMAND`: command styling
- `EVENT`: event styling
- `POLICY`: policy styling
- `END`: end-state styling

Unknown node types are not part of the contract. Hosts should not send them.

### Styling/category expectations

The renderer derives styling from semantic types, not from ad hoc style fields in the JSON.

Current expectations:

- node shape and color come from `node.type`
- edge color and dash pattern come from `edge.type`
- `edge.label` is rendered if non-null
- `system` and `service` are used as tooltip/title metadata, not swimlanes
- policy labels may be visually split into `when ... do ...` segments if they match that text pattern
- labels may be humanized for display only; this does not change the underlying JSON

There is currently no contract for per-node custom colors, icons, CSS classes, or arbitrary metadata blobs.

### Required source metadata

`sourceRef` is required on every node and should be treated as required for integration.

Shape:

```json
{
  "file": "subscription-flow.zfl",
  "line": 7,
  "column": 1
}
```

Semantics:

- `file` is a host-resolvable path or file identifier
- `line` is 1-based
- `column` is 1-based

Edge `sourceRef` may be `null`.

### Optional layout metadata

Top-level `layout`:

```json
{
  "engine": "elk-layered",
  "direction": "LR",
  "rankSpacing": 180,
  "nodeSpacing": 80
}
```

Top-level `bounds`:

```json
{
  "x": 0,
  "y": 0,
  "width": 2200,
  "height": 420
}
```

Current behavior:

- if a node is missing `position` or `dimensions`, that node is skipped
- edges whose source or target node is skipped are also skipped
- `systemGroups` is ignored

### Example input JSON

```json
{
  "schema": "zfl.eventflow.view@1",
  "nodes": [
    {
      "id": "event:CustomerRequestsSubscriptionRenewal",
      "type": "START",
      "label": "CustomerRequestsSubscriptionRenewal",
      "system": null,
      "service": null,
      "sourceRef": {
        "file": "subscription-flow.zfl",
        "line": 1,
        "column": 1
      },
      "position": {
        "x": 40,
        "y": 140
      },
      "dimensions": {
        "width": 100,
        "height": 100
      }
    },
    {
      "id": "command:renewSubscription",
      "type": "COMMAND",
      "label": "renewSubscription",
      "system": "Subscription",
      "service": "SubscriptionService",
      "sourceRef": {
        "file": "subscription-flow.zfl",
        "line": 3,
        "column": 1
      },
      "position": {
        "x": 220,
        "y": 160
      },
      "dimensions": {
        "width": 180,
        "height": 64
      }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "event:CustomerRequestsSubscriptionRenewal",
      "target": "command:renewSubscription",
      "type": "TRIGGER",
      "label": null,
      "sourceRef": null
    }
  ],
  "layout": {
    "engine": "elk-layered",
    "direction": "LR",
    "rankSpacing": 180,
    "nodeSpacing": 80
  },
  "bounds": {
    "x": 0,
    "y": 0,
    "width": 1200,
    "height": 400
  },
  "systemGroups": null
}
```

## 5. Event/output contract

### Important distinction

Current implementation:

- implemented callbacks are `onNodeClick`, `onSelectionChange`, and `onFlowViewModelChange`
- there is no built-in `window.postMessage` bridge
- there is no implemented `webviewReady`, `viewportChanged`, `contextMenuRequested`, or `errorReported` event

Recommended host contract:

For IntelliJ integration, use a thin wrapper around `EventFlowVisualizer` and normalize its callbacks into explicit host events. The event definitions below are the recommended bridge contract for the embedding host even where the base renderer does not emit them yet.

### Event envelope

Renderer-to-host events should use a stable envelope:

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "nodeSelected",
  "requestId": null,
  "timestamp": "2026-03-14T12:00:00.000Z",
  "payload": {}
}
```

Required envelope fields:

- `channel: "zfl.eventflow"`
- `version: 1`
- `type: string`
- `payload: object`

Optional envelope fields:

- `requestId: string | null`
- `timestamp: string`

### `webviewReady`

Status: recommended bridge event, not implemented by the base component.

Trigger:

- emitted once after the wrapper has mounted and is ready to receive host messages

Payload required fields:

- `rendererVersion: string`
- `supportedIncomingMessages: string[]`
- `supportedOutgoingEvents: string[]`

Payload optional fields:

- `capabilities: object`

Example:

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "webviewReady",
  "payload": {
    "rendererVersion": "1.0.0",
    "supportedIncomingMessages": [
      "loadModel",
      "refreshModel",
      "selectNodes",
      "highlightNodes",
      "fitToNodes",
      "clearSelection",
      "setTheme"
    ],
    "supportedOutgoingEvents": [
      "webviewReady",
      "nodeSelected",
      "selectionChanged",
      "layoutChanged",
      "errorReported"
    ],
    "capabilities": {
      "dragLayoutEditing": true,
      "viewportCommands": false,
      "contextMenu": false
    }
  }
}
```

### `nodeSelected`

Status: can be produced today by adapting `onNodeClick`.

Trigger:

- user clicks a node

Payload required fields:

- `nodeId: string`
- `nodeType: string`
- `sourceRef: SourceRef`

Payload optional fields:

- `label: string`
- `system: string | null`
- `service: string | null`

Example:

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "nodeSelected",
  "payload": {
    "nodeId": "command:renewSubscription",
    "nodeType": "COMMAND",
    "label": "renewSubscription",
    "system": "Subscription",
    "service": "SubscriptionService",
    "sourceRef": {
      "file": "subscription-flow.zfl",
      "line": 3,
      "column": 1
    }
  }
}
```

### `selectionChanged`

Status: can be produced today by adapting `onSelectionChange`.

Trigger:

- user changes selected nodes or edges in the canvas

Payload required fields:

- `selectedNodeIds: string[]`
- `selectedEdgeIds: string[]`

Payload optional fields:

- `primaryNodeId: string | null`

Example:

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "selectionChanged",
  "payload": {
    "selectedNodeIds": [
      "command:renewSubscription"
    ],
    "selectedEdgeIds": [],
    "primaryNodeId": "command:renewSubscription"
  }
}
```

### `viewportChanged`

Status: not implemented by the base component.

Trigger:

- recommended for future use when the wrapper starts listening to React Flow viewport changes

Payload required fields:

- `x: number`
- `y: number`
- `zoom: number`

Payload optional fields:

- `reason: "user" | "programmatic"`

Example:

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "viewportChanged",
  "payload": {
    "x": 120,
    "y": 40,
    "zoom": 0.9,
    "reason": "user"
  }
}
```

### `contextMenuRequested`

Status: not implemented by the base component.

Trigger:

- recommended future event on right-click or equivalent context gesture

Payload required fields:

- `targetType: "node" | "edge" | "canvas"`
- `clientX: number`
- `clientY: number`

Payload optional fields:

- `nodeId: string`
- `edgeId: string`
- `sourceRef: SourceRef`

Example:

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "contextMenuRequested",
  "payload": {
    "targetType": "node",
    "clientX": 522,
    "clientY": 311,
    "nodeId": "event:SubscriptionRenewed",
    "sourceRef": {
      "file": "subscription-flow.zfl",
      "line": 5,
      "column": 1
    }
  }
}
```

### `layoutChanged`

Status: can be produced today by adapting `onFlowViewModelChange`.

Trigger:

- user drags one or more nodes and the renderer emits an updated `FlowViewModel`

Payload required fields:

- `flowViewModel: FlowViewModel`

Payload optional fields:

- `changedNodeIds: string[]`

Example:

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "layoutChanged",
  "payload": {
    "changedNodeIds": [
      "command:renewSubscription"
    ],
    "flowViewModel": {
      "schema": "zfl.eventflow.view@1",
      "nodes": [],
      "edges": [],
      "layout": {
        "engine": "elk-layered",
        "direction": "LR",
        "rankSpacing": 180,
        "nodeSpacing": 80
      },
      "bounds": {
        "x": 0,
        "y": 0,
        "width": 1200,
        "height": 400
      },
      "systemGroups": null
    }
  }
}
```

### `errorReported`

Status: recommended bridge event, not implemented by the base component.

Trigger:

- wrapper cannot parse host message
- host sends unsupported command
- wrapper detects invalid model

Payload required fields:

- `code: string`
- `message: string`

Payload optional fields:

- `details: object`
- `recoverable: boolean`

Example:

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "errorReported",
  "payload": {
    "code": "INVALID_GRAPH",
    "message": "Graph payload is missing required top-level field 'nodes'.",
    "recoverable": true,
    "details": {
      "field": "nodes"
    }
  }
}
```

## 6. Host integration model

The IntelliJ plugin should wrap the renderer with a very small adapter component and treat it as a controlled view.

Recommended interaction model:

1. Host creates the webview and waits for `webviewReady`.
2. Host sends `loadModel` with a full `FlowViewModel`.
3. Renderer displays the graph from that model.
4. User interactions inside the graph are emitted back to the host.
5. If the underlying source changes, the host sends `refreshModel` with a new full `FlowViewModel`.
6. If the host wants selection/highlight synchronization, it sends explicit commands such as `selectNodes` or `highlightNodes`.
7. If drag layout editing is enabled and the user moves nodes, the renderer emits `layoutChanged`; the host decides whether to persist or ignore it.

Important: the current base component already supports steps 2, 4, and 7 through React props/callbacks. Steps involving message passing require a wrapper.

## 7. Message bridge assumptions

### Recommended protocol

Use a single JSON message envelope in both directions:

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "loadModel",
  "requestId": "req-1",
  "payload": {}
}
```

### Host -> renderer messages

#### `loadModel`

Use when the webview is first populated.

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "loadModel",
  "requestId": "req-1",
  "payload": {
    "flowViewModel": {
      "schema": "zfl.eventflow.view@1",
      "nodes": [],
      "edges": [],
      "layout": null,
      "bounds": null,
      "systemGroups": null
    },
    "theme": "light",
    "editable": true,
    "displaySettings": {
      "humanizeLabels": true
    }
  }
}
```

#### `refreshModel`

Use when the host has a replacement graph after reparse/reanalysis.

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "refreshModel",
  "payload": {
    "flowViewModel": {
      "schema": "zfl.eventflow.view@1",
      "nodes": [],
      "edges": [],
      "layout": null,
      "bounds": null,
      "systemGroups": null
    }
  }
}
```

#### `selectNodes`

Recommended command for controlled selection.

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "selectNodes",
  "payload": {
    "nodeIds": [
      "command:renewSubscription"
    ],
    "replace": true,
    "fitView": false
  }
}
```

#### `highlightNodes`

Recommended command for transient emphasis distinct from selection.

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "highlightNodes",
  "payload": {
    "nodeIds": [
      "event:SubscriptionRenewed",
      "policy:SubscriptionRenewed:chargePayment"
    ],
    "mode": "transient"
  }
}
```

#### `fitToNodes`

Recommended future command.

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "fitToNodes",
  "payload": {
    "nodeIds": [
      "command:renewSubscription"
    ],
    "padding": 0.2,
    "maxZoom": 1.2
  }
}
```

#### `clearSelection`

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "clearSelection",
  "payload": {}
}
```

#### `setTheme`

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "setTheme",
  "payload": {
    "theme": "dark"
  }
}
```

### Renderer -> host messages

Recommended outgoing messages:

- `webviewReady`
- `nodeSelected`
- `selectionChanged`
- `viewportChanged`
- `layoutChanged`
- `contextMenuRequested`
- `errorReported`

Example:

```json
{
  "channel": "zfl.eventflow",
  "version": 1,
  "type": "selectionChanged",
  "payload": {
    "selectedNodeIds": [
      "event:SubscriptionRenewed"
    ],
    "selectedEdgeIds": []
  }
}
```

## 8. Selection and highlighting model

### Current behavior

The base component supports:

- user click on a node
- user-driven multi-selection inside React Flow
- callback emission when selection changes

The base component does not currently expose imperative APIs for:

- programmatic node selection
- programmatic highlighting
- programmatic fit-to-selection
- external tree-to-graph synchronization

### Recommended host model

Use two distinct concepts:

- `selection`
  Persistent, host-owned state representing the item currently selected in graph or tree UI.
- `highlight`
  Transient emphasis for hover, search result preview, or cross-panel focus.

Recommended rules:

- selecting a node in the tree sends `selectNodes`
- selecting a node in the graph emits `nodeSelected` and `selectionChanged`
- the host updates the rest of the IntelliJ UI from those events
- highlighting should not replace selection unless explicitly requested
- `fitToNodes` should be host-triggered, not automatic on every selection change

Recommended command semantics:

- `highlightNodes`
  Visually emphasize nodes without changing selection
- `selectNodes`
  Replace or extend current selection
- `fitToNodes`
  Center/zoom to a node set
- `clearSelection`
  Remove current graph selection

Because these commands are not implemented in the base component yet, the IntelliJ integration should treat them as wrapper-level features.

## 9. Error and empty-state handling

### Graph is missing

If no graph model is available, the host should render or instruct the wrapper to render an empty placeholder state such as:

- "No event flow available"
- "Open a ZFL flow file to visualize"

The base component expects a `flowViewModel` prop and does not itself own the "missing model" state. The demo page handles this outside the component.

### Graph is invalid

The host or wrapper should validate basic structure before rendering:

- `schema` present
- `nodes` array present
- `edges` array present
- node IDs unique
- edge endpoints reference existing nodes

Current renderer behavior on invalid-but-parseable data:

- nodes without `position` or `dimensions` are skipped
- edges with missing visible endpoints are skipped
- some classes of invalid input may still fail earlier in the host if required fields are absent

Recommended behavior:

- emit `errorReported`
- keep the previous valid graph if possible
- show a visible invalid-state message rather than a blank pane with no explanation

### Graph is empty

An empty but valid graph is:

```json
{
  "schema": "zfl.eventflow.view@1",
  "nodes": [],
  "edges": [],
  "layout": null,
  "bounds": null,
  "systemGroups": null
}
```

Recommended host behavior:

- render an explicit "empty flow" message
- do not treat empty as an error

## 10. Webview embedding guidance for IntelliJ

For IntelliJ JCEF embedding:

- mount the renderer into a root element with explicit width and height
- avoid reloading the whole webview for every selection change; send messages instead
- prefer full-model replacement on refresh over incremental graph patching
- keep message payloads pure JSON
- do not rely on filesystem access from inside the webview
- keep source navigation in the IntelliJ host, not inside the renderer

Practical constraints:

- React Flow needs measurable layout space
- webview theme changes should be forwarded explicitly
- focus handling may differ from a normal browser tab, so keyboard shortcuts should stay host-owned unless intentionally added
- large graphs should be sent after model generation is complete, not streamed node-by-node

Recommended IntelliJ-side split:

- plugin: fetch model, validate, persist, navigate source, own selection state
- webview wrapper: translate plugin messages to React props
- renderer: draw graph and report UI interactions

## 11. Current capabilities vs planned capabilities

### Current behavior in this repository

- Renders `FlowViewModel` using React Flow
- Supports node types `START`, `COMMAND`, `EVENT`, `POLICY`, `END`
- Supports edge types `CAUSATION`, `TRIGGER`, `CONDITIONAL`, `ERROR`
- Supports light/dark theme prop
- Supports display-only label humanization
- Emits node click callbacks
- Emits selection-change callbacks
- Emits updated `FlowViewModel` after drag stop when editing is enabled
- Skips nodes lacking `position` or `dimensions`
- Skips dangling edges
- Ignores `systemGroups`
- Has no built-in message bridge
- Has no built-in programmatic selection/highlight API
- Has no built-in viewport event API

### Planned or recommended for host integration

- Standard host/webview JSON message protocol
- `webviewReady` handshake
- Programmatic selection commands
- Programmatic highlight commands
- Fit-to-selection commands
- Viewport synchronization events
- Structured error reporting
- Context menu events
- Optional richer empty/invalid states inside the wrapper

## 12. Versioning and compatibility notes

### Model versioning

The graph payload already contains a schema marker:

- `zfl.eventflow.view@1`

Hosts should branch on schema version before assuming field compatibility.

### Bridge versioning

The recommended message bridge should include:

- `channel`
- `version`
- `type`

Use `version: 1` for the first stable IntelliJ bridge contract.

### Safe evolution rules

- add new message types without changing existing ones
- add optional payload fields freely
- do not rename existing fields in place
- do not change selection or event semantics without bumping bridge version
- if a new graph schema is introduced, support old schema in the host adapter during a migration period

Recommended compatibility stance:

- renderer should ignore unknown incoming optional fields
- host should ignore unknown outgoing event fields
- unsupported incoming message types should yield `errorReported`, not silent failure

## 13. Open questions / ambiguities

- Should the IntelliJ integration standardize on full-model replacement only, or also support incremental updates later?
- Should `sourceRef.file` be an absolute path, workspace-relative path, URI, or logical document ID?
- Should graph selection be single-select only from IntelliJ tree interactions, even though React Flow supports multi-selection?
- Should host-triggered highlighting be a separate visual state from selection, or can selection styling serve both?
- Should drag-based layout editing be enabled in IntelliJ by default, or remain an opt-in editing mode?
- Should `layoutChanged` be emitted on every drag move, or only on drag stop? Current base behavior is drag stop only.
- Should the wrapper preserve the previous valid graph when a refresh payload is invalid?
- Is `systemGroups` intentionally deferred, or should swimlane/group rendering become part of the supported contract?
- Does the IntelliJ plugin need edge-click events in addition to node-click events?
- Should viewport persistence be part of the first integration version, or deferred until selection and navigation are stable?
