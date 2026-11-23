---
"@zenwave360/vistas-eventflow-webview": minor
---

Render server-positioned Systems and Services lane bands, including variants. The toolbar's Lanes control starts from `displaySettings.lanes` and sends `lanesChanged { lanes: "none" | "systems" | "services" }` for user changes. Lanes disable dragging and saving positions and explain automatic layout in the status bar. The control shows only when `renderBundle.payload.lanesSupported` is `true`; false or absent (older hosts) hides it and treats lanes as none. Protocol version stays 1.
