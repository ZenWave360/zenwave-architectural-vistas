---
"@zenwave360/vistas-eventflow-webview": minor
---

Also ship `webview-toolbar/`: the same EventFlow page with a Flow / Systems selector, for hosts with no toolbar of their
own. It has its own `protocol.json` and the same `protocolVersion`. When the user changes the view in the selector it
sends `viewModeChanged` to the host; a host `setViewMode` or `renderBundle` moves the selector without a message. The
`webview/` page and every existing export are unchanged.
