---
"@zenwave360/vistas-eventflow-webview": minor
---

The variant dropdown can be a tree grouped by outcome. `renderBundle` takes an optional `variantTree`, the variants grouped by end outcome as a prefix tree of steps; variants may carry `outcome` and `steps`. The page draws one `<optgroup>` per outcome with `├─ │ └─` lines, shows the chosen line's full title in the toolbar, and sends the id of a line, leaf or not, in `variantChanged`. Without a tree the flat list stays. The protocol version stays 1.
