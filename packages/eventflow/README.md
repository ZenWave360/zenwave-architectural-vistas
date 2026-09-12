# @zenwave360/vistas-eventflow

A React Flow visualizer for EventFlow diagrams with pre-computed positions.

## Features

- Event-storming-inspired node legend
- Timeline-first rendering with no system swimlanes
- START nodes rendered as green circles
- END/end-outcome nodes rendered as red squares
- Visual distinction for `CAUSATION`, `TRIGGER`, `CONDITIONAL`, and `ERROR` edges
- Light and dark themes
- Source navigation hooks for IDE integrations

## Quick Start

From the monorepo root, run `pnpm install` and then
`pnpm --filter @zenwave360/vistas-eventflow-webview dev`. This opens
`test.html`, where you can paste `FlowViewModel` JSON to test the viewer.

## Static Bundle For IntelliJ / JCEF

Build the static webview bundle with:

```bash
pnpm --filter @zenwave360/vistas-eventflow-webview build
```

The build output is written to:

```text
dist/index.html
```

Vite is configured to emit relative asset paths so the bundle can be loaded from a local `file://` URL inside IntelliJ JCEF.

## Typecheck

```bash
npm run typecheck
```

This checks both:

- browser app code via `tsconfig.json`
- Vite and Node-side config via `tsconfig.node.json`

## Basic Usage

```tsx
import {
  EventFlowVisualizer,
  type FlowViewModel,
} from '@zenwave360/vistas-eventflow/react';
import '@zenwave360/vistas-eventflow/styles.css';

const flowData: FlowViewModel = {
  schema: "zfl.eventflow.view@1",
  nodes: [
    {
      id: "event:CustomerRequestsSubscriptionRenewal",
      type: "START",
      label: "CustomerRequestsSubscriptionRenewal",
      position: { x: 40, y: 140 },
      dimensions: { width: 100, height: 100 },
      system: null,
      service: null,
      sourceRef: { file: "flow.zfl", line: 1, column: 1 }
    },
    {
      id: "command:renewSubscription",
      type: "COMMAND",
      label: "renewSubscription",
      position: { x: 220, y: 160 },
      dimensions: { width: 180, height: 64 },
      system: "Subscription",
      service: "SubscriptionService",
      sourceRef: { file: "flow.zfl", line: 3, column: 1 }
    }
  ],
  edges: [
    {
      id: "e1",
      source: "event:CustomerRequestsSubscriptionRenewal",
      target: "command:renewSubscription",
      type: "TRIGGER",
      outcome: null,
      label: null,
      sourceRef: null
    }
  ],
  systemGroups: null,
  layout: {
    engine: "elk-layered",
    direction: "LR",
    rankSpacing: 180,
    nodeSpacing: 80
  },
  bounds: { x: 0, y: 0, width: 1200, height: 400 }
};
```

## FlowViewModel Notes

- `position` and `dimensions` can be `null` before layout is applied.
- Node end-state labels are read from `endOutcome`; edge outcome labels are read from `outcome`.
- When a command emits multiple events for the same `outcome`, the viewer inserts a synthetic outcome pill node at render time.
- When a command has a single event for an `outcome`, the viewer keeps a direct edge and uses the outcome text as the edge label.
- The viewer skips nodes without layout information instead of crashing.
- `systemGroups` may be `null` and is ignored by the viewer.
- System and service metadata are preserved as tooltip metadata, not as visual grouping.
- The viewer can emit a full updated `FlowViewModel` after drag-based layout edits via `onFlowViewModelChange`.

## Layout Editing

```tsx
<EventFlowVisualizer
  flowViewModel={flowData}
  displaySettings={{ humanizeLabels: true }}
  onFlowViewModelChange={(updatedFlowViewModel) => {
    console.log(updatedFlowViewModel.nodes.map((node) => node.position));
  }}
/>
```

The emitted model keeps the original schema, edges, metadata, and dimensions, while updating node positions and recomputed bounds.

`displaySettings.humanizeLabels` is enabled by default and converts viewer labels like `RenewalCancelled` into `Renewal Cancelled` without changing the underlying JSON.

## Node Legend

- `START`: green circle
- `COMMAND`: blue rounded rectangle
- `EVENT`: orange pill
- `POLICY`: purple dashed rule box
- `END`: red square end outcome

## Edge Legend

- `CAUSATION`: solid neutral edge
- `TRIGGER`: dashed purple edge
- `CONDITIONAL`: dashed teal edge
- `ERROR`: dashed red edge

## Notes

This is a visualization-only component:

- Does not parse ZFL source files
- Does not compute layout positions
- Renders the provided flow model and preserves branching in the source layout
