---
"@zenwave360/vistas-eventflow-webview": minor
---

The toolbar page lists a flow's variants and sends `variantChanged` when the user picks one. `renderBundle` takes optional `variants` and `variant`; the page waits for the host's next bundle instead of swapping the graph. A variant keeps the flow's `diagramId`, and the opening zoom runs again when the shown variant changes. The protocol version stays 1.
