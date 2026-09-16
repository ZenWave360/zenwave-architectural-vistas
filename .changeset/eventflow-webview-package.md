---
"@zenwave360/vistas-eventflow-webview": minor
---

New package with the static EventFlow webview bundle for IDE hosts. The page loads under a strict content security
policy (no inline script or style, no remote resources), signals `webviewReady` through a host channel, the VS Code
webview API, or the parent frame, and reports its protocol version.
