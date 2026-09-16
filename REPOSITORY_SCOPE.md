# Repository Purpose and Scope

## Short summary

This repository contains reusable ZenWave visualization components and their integrations. It turns ZenWave architecture models into interactive diagrams or static SVG files.

Packages are grouped by visualization feature, not only by UI framework. This keeps each package small and prevents an IntelliJ or website bundle from including unrelated components.

## Why this repository exists

ZenWave visualization code was spread across different projects. The EventFlow visualizer was a standalone React application. EventCatalog components lived inside one EventCatalog project. Other consumers could not reuse these components easily.

This repository gives that code one clear home. The same visualization implementation can be used by:

- ZenWave websites.
- Third-party Astro websites.
- EventCatalog projects.
- React applications.
- The ZenWave IntelliJ and VSCode plugins through a static webview bundle.
- Static SVG generation for Markdown and other documents.

EventCatalog is a consumer of these components. It is not the owner of the visualization implementation.

## Package rule

Each visualization feature should have its own package. A package may expose several entry points when needed:

- Model adapters.
- A framework-independent graph model.
- Layout code.
- React components.
- Astro components.
- Static SVG rendering.

For example, `@zenwave360/vistas-eventflow` owns EventFlow and Service Map visualization. A future ZDL visualization should use another package. It should not be added to a large package that contains every React component.

Shared code should be extracted only after two or more packages need it. A shared package must stay small and have a clear purpose.

## What the repository contains now

### `packages/eventflow`

The `@zenwave360/vistas-eventflow` package contains the copied EventFlow React implementation. It exports `EventFlowVisualizer`, `ServiceMapVisualizer`, their node components, and their current view-model contracts.

The current implementation still expects a prepared and positioned `FlowViewModel` or `ServiceViewModel`. Parser, semantic-model, layout, and SVG boundaries will be improved in later work.

### `apps/eventflow-webview`

This private Vite application creates the static browser bundle used by the IntelliJ plugin. It imports only the EventFlow package. Future visualization packages will not increase this bundle unless this app imports them.

### `packages/eventflow-webview`

The `@zenwave360/vistas-eventflow-webview` package contains the page built by `apps/eventflow-webview`, as static files, and documents its host message protocol and protocol version. IDE hosts that consume npm packages, such as the ZenWave VS Code extension, use it. It contains no visualization code of its own.

### `packages/eventcatalog-components`

The `@zenwave360/eventcatalog-components` package is the installable component suite for EventCatalog users. It can contain architecture diagrams and other useful EventCatalog components, such as `RemoteSpecificationSchema`.

This package may depend on several bounded visualization packages. It should wrap or re-export them. It should not copy their implementations.

## What the repository should contain later

Planned work includes:

- A stable EventFlow graph model that does not depend on React.
- EventFlow layout and normalization outside the React renderer.
- Static EventFlow SVG rendering from the same graph and layout.
- An Astro component for EventFlow diagrams.
- ZDL architecture and domain diagram packages.
- Astro components such as `ZflDiagram` and `ZdlDiagram`.
- More installable EventCatalog components.
- Examples used by the ZenWave website and EventCatalog projects.
- A small command-line renderer if static SVG generation needs it.
- A remote rendering service only if there is a real later need.

## What this repository should not contain

This repository should not become the source of truth for ZenWave language semantics.

The following code should remain in its current upstream projects:

- ZFL and ZDL parsers.
- DSL semantic analysis.
- Manifest architecture graph construction.
- IntelliJ plugin business logic and IDE integration.
- EventCatalog core implementation.
- ZenWave SDK generators that do not render diagrams.

This repository may contain adapters for those projects, but it should not duplicate their main models or rules.

## Dependency direction

Dependencies should move in one direction:

```text
ZFL / ZDL / Manifest models
            |
            v
visualization feature package
  model -> graph -> layout
       |             |
       v             v
     React          SVG
       |
       v
     Astro
       |
       +--> ZenWave website
       +--> third-party Astro websites
       +--> EventCatalog components
```

Integration packages may depend on visualization packages. Visualization packages must not depend on EventCatalog, the ZenWave website, or the IntelliJ plugin.

## Publishing

Public packages use the `@zenwave360` npm scope. Packages can have separate versions and releases. Changesets records package changes and prepares releases.

Private applications under `apps/` are build and integration tools. They are not published as general npm libraries.

## Writing rule

Documentation, errors, and public API descriptions should use simple technical English. Prefer short sentences, clear names, and direct examples.
