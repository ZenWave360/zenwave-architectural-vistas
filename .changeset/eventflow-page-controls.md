---
"@zenwave360/vistas-eventflow-webview": minor
---

The toolbar page has a *Humanize labels* toggle that sends `labelsChanged { humanize }` for the user's own change, and a status bar at the bottom for the saved-positions messages, which leave the toolbar. Policy nodes draw an optional `title` in place of their text, and a person icon with the `actor` or an hourglass with the `timer` text when `policyKind` says so. The protocol version stays 1.
