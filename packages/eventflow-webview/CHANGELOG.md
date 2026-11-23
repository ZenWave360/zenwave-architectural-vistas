# @zenwave360/vistas-eventflow-webview

## 0.2.0

### Minor Changes

- 4371e57: The opening view frames when a diagram is first shown and when its `diagramId` changes, and keeps the user's pan and zoom when nodes are added, removed or reordered. `renderBundle` and the visualizers take an optional `diagramId`: a host should send something stable for one diagram, such as the document URI and the flow name. The protocol version stays 1.
- 0c33982: Render server-positioned Systems and Services lane bands, including variants. The toolbar's Lanes control starts from `displaySettings.lanes` and sends `lanesChanged { lanes: "none" | "systems" | "services" }` for user changes. Lanes disable dragging and saving positions and explain automatic layout in the status bar. The control shows only when `renderBundle.payload.lanesSupported` is `true`; false or absent (older hosts) hides it and treats lanes as none. Protocol version stays 1.
- 07ed208: The toolbar page has a _Humanize labels_ toggle that sends `labelsChanged { humanize }` for the user's own change, and a status bar at the bottom for the saved-positions messages, which leave the toolbar. Policy nodes draw an optional `title` in place of their text, and a person icon with the `actor` or an hourglass with the `timer` text when `policyKind` says so. The protocol version stays 1.
- 7a62050: Hosts can send `savePositionsFailed { message }` after a `savePositions` they could not write. The toolbar page shows the message in its status bar and brings Save positions back, until the next click or `renderBundle`. The protocol version stays 1.
- c532a5a: The toolbar page shows a Save positions button in the Flow view of the full diagram once a node was moved, and sends `savePositions` with every node's whole-number position. `renderBundle` takes an optional `savedPositions`, and the page notes a saved layout that did not match. The minimal page has neither. The protocol version stays 1.
- 4268531: The toolbar page lists a flow's variants and sends `variantChanged` when the user picks one. `renderBundle` takes optional `variants` and `variant`; the page waits for the host's next bundle instead of swapping the graph. A variant keeps the flow's `diagramId`, and the opening zoom runs again when the shown variant changes. The protocol version stays 1.
- 77bac1d: The variant dropdown can be a tree grouped by outcome. `renderBundle` takes an optional `variantTree`, the variants grouped by end outcome as a prefix tree of steps; variants may carry `outcome` and `steps`. The page draws one `<optgroup>` per outcome with `├─ │ └─` lines, shows the chosen line's full title in the toolbar, and sends the id of a line, leaf or not, in `variantChanged`. Without a tree the flat list stays. The protocol version stays 1.
- 2e60d25: New package with the static EventFlow webview bundle for IDE hosts. The page loads under a strict content security
  policy (no inline script or style, no remote resources), signals `webviewReady` through a host channel, the VS Code
  webview API, or the parent frame, and reports its protocol version.
- 6b52895: Also ship `webview-toolbar/`: the same EventFlow page with a Flow / Systems selector, for hosts with no toolbar of their
  own. It has its own `protocol.json` and the same `protocolVersion`. When the user changes the view in the selector it
  sends `viewModeChanged` to the host; a host `setViewMode` or `renderBundle` moves the selector without a message. The
  `webview/` page and every existing export are unchanged.
