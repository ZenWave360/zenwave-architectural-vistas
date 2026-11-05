---
"@zenwave360/vistas-eventflow-webview": minor
---

Hosts can send `savePositionsFailed { message }` after a `savePositions` they could not write. The toolbar page shows the message in its status bar and brings Save positions back, until the next click or `renderBundle`. The protocol version stays 1.
