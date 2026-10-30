# ZenWave Architectural Vistas

Component-oriented visualization packages for ZenWave architecture models and their host integrations.

See [Repository Purpose and Scope](https://github.com/ZenWave360/zenwave-specs/blob/main/zenwave-architectural-vistas/REPOSITORY_SCOPE.md) for the project goals, boundaries, and planned contents. See [CONTRIBUTING.md](./CONTRIBUTING.md) for feature development and how to release one package or all pending packages.

## Workspace

- `packages/eventflow` — the bounded EventFlow and Service Map visualization package.
- `packages/eventcatalog-components` — installable Astro components for EventCatalog projects.
- `packages/eventflow-webview` — `@zenwave360/vistas-eventflow-webview`, the built EventFlow webview page as a package, for IDE hosts such as VS Code.
- `apps/eventflow-webview` — the standalone Vite/JCEF host for the EventFlow package. It builds the webview page.

Packages are organized by visualization capability rather than by UI framework. A capability may expose framework-independent model, layout, SVG, React, or Astro entry points without forcing unrelated visualizations into the same runtime bundle.

## Development

```bash
pnpm install
pnpm check
pnpm build
pnpm test
```

The copied EventFlow implementation intentionally retains its current `FlowViewModel` contract. Moving normalization, layout, and SVG generation behind independent entry points is subsequent work.

## IntelliJ webview

The IntelliJ plugin embeds a static browser bundle rather than the npm package itself. Build and synchronize that bundle with the default sibling checkout:

```bash
pnpm sync:intellij
```

The default plugin directory is `../ZenWaveDomainModelEditor`. For another checkout, set `ZENWAVE_INTELLIJ_PLUGIN_DIR` or pass an explicit path:

```bash
pnpm sync:intellij -- --plugin-dir C:/workspace/ZenWaveDomainModelEditor
```

The synchronization script validates the plugin project and exact resource directory, rejects symbolic links, copies the new build first, and removes only stale files within `src/main/resources/web/eventflow`.

## Other webview hosts

`@zenwave360/vistas-eventflow-webview` packages the same page for hosts that consume it as an npm package, such as the ZenWave VS Code extension. The page has no inline script or style and loads nothing remote. See [packages/eventflow-webview/README.md](./packages/eventflow-webview/README.md) for how to load it, the messages, and protocol versioning.

To use it locally without publishing:

```bash
pnpm --filter @zenwave360/vistas-eventflow-webview build
pnpm --filter @zenwave360/vistas-eventflow-webview pack
```

## CI and release

Pull requests and pushes to `main` run `.github/workflows/ci.yml`. Releases are manual: **Actions → Release** from `main`, then promote `next` to `latest` on npm yourself.

The full workflow — Changesets, individual vs `all` releases, and the human npm gateway — is in [CONTRIBUTING.md](./CONTRIBUTING.md).
