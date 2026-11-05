---
"@zenwave360/vistas-eventflow-webview": minor
---

Render server-positioned Systems and Services lane bands, including variants. The toolbar's Lanes control starts from `displaySettings.lanes` and sends `lanesChanged { lanes: "none" | "systems" | "services" }` for user changes. Lanes disable dragging and saving positions and explain automatic layout in the status bar. `renderBundle.payload.lanesSupported: false` hides the control and treats lanes as none; absent counts as true. Protocol version stays 1.
