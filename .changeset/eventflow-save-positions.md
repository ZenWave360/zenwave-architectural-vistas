---
"@zenwave360/vistas-eventflow-webview": minor
---

The toolbar page shows a Save positions button in the Flow view of the full diagram once a node was moved, and sends `savePositions` with every node's whole-number position. `renderBundle` takes an optional `savedPositions`, and the page notes a saved layout that did not match. The minimal page has neither. The protocol version stays 1.
