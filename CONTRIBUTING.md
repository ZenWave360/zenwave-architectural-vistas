# Contributing

This repository is a pnpm workspace of visualization packages. Public packages can be versioned and released on their own, or together in one run.

Use simple technical English in documentation, errors, and public API descriptions.

## Prerequisites

- Node.js 20 or newer
- [pnpm](https://pnpm.io) 10.34.5 (see `packageManager` in the root `package.json`)

```bash
pnpm install
```

## Workspace

| Path | Package | Published to npm |
| --- | --- | --- |
| `packages/eventflow` | `@zenwave360/vistas-eventflow` | Yes |
| `packages/eventcatalog-components` | `@zenwave360/eventcatalog-components` | Yes |
| `packages/eventflow-webview` | `@zenwave360/vistas-eventflow-webview` | Yes. The page built by `apps/eventflow-webview`, packaged for IDE hosts. |
| `apps/eventflow-webview` | `@zenwave360/vistas-eventflow-webview-app` | No. Private host used to build the IntelliJ static bundle. |

See [REPOSITORY_SCOPE.md](./REPOSITORY_SCOPE.md) for what belongs in this repository.

## Feature development

1. Branch from `main`.
2. Change only the package that owns the feature. Do not add unrelated visualizations to an existing package.
3. Check your work from the repository root:

```bash
pnpm check
pnpm build
pnpm test
```

4. If you changed a **public** package, record a Changeset in the same pull request (see below).
5. Open a pull request into `main`. CI runs the same check, build, and test commands.

Do not bump `version` in `package.json` by hand. The release workflow does that from Changeset files.

### Preview EventFlow

```bash
pnpm --filter @zenwave360/vistas-eventflow-webview-app dev
```

This opens `test.html`, where you can paste `FlowViewModel` JSON.

### Sync the IntelliJ webview

The IntelliJ plugin does not consume the npm package. It embeds the static webview build.

```bash
pnpm sync:intellij
```

The default plugin checkout is `../ZenWaveDomainModelEditor`. Override it with `ZENWAVE_INTELLIJ_PLUGIN_DIR` or `--plugin-dir`. Preview the copy with `pnpm sync:intellij:dry-run`.

This is a local integration step. It is not part of the npm release.

### EventFlow webview package

`packages/eventflow-webview` has no page source of its own. Its build runs the `apps/eventflow-webview` build and copies `dist` (without source maps) into `webview/`. Its tests load that directory in a headless Chromium-based browser under a strict content security policy. The browser is Edge or Chrome at the standard install paths, or the executable named by `ZENWAVE_TEST_BROWSER`. Without a browser, the browser tests are skipped locally and fail in CI.

A change to the page in `apps/eventflow-webview` reaches npm through this package, so record its Changeset against `@zenwave360/vistas-eventflow-webview`. If the change is not backwards compatible for a host, increase `EVENTFLOW_WEBVIEW_PROTOCOL_VERSION` in both `apps/eventflow-webview/src/protocol.ts` and `packages/eventflow-webview/index.js` (a test checks they match), and use a major bump.

## Changesets

A Changeset is a small markdown file that says which public package should bump, and whether that bump is patch, minor, or major. It is not a version number yet. `package.json` stays unchanged until you run a release.

After you change a public package:

```bash
pnpm changeset
```

Select the package or packages you changed, choose the bump type, and write a short summary. Commit the generated `.changeset/*.md` file with the pull request.

Use these bump types:

- **patch** — bug fix, no API change
- **minor** — new backwards-compatible API or feature
- **major** — breaking change

Rules:

- Every user-facing change to a public package needs a Changeset.
- Do not add a Changeset for `apps/eventflow-webview` itself. That app is ignored and is not published. Record page changes against `@zenwave360/vistas-eventflow-webview`.
- Docs-only or CI-only changes do not need a Changeset.
- One Changeset file may list more than one public package. That file is a **joint** change. See [Individual or all](#individual-or-all).

To inspect what a release would do, without writing files:

```bash
pnpm exec changeset status
```

## Releases

Releases are manual. Dispatch **Actions → Release** from `main`. There is no develop branch and no snapshot publish.

The workflow does not ask for a version number. It reads pending `.changeset/*.md` files on `main` and computes the next version for each selected package.

You must dispatch from `main`. The run fails on any other branch.

### Individual or all

The workflow `package` input is a select:

| Choice | What it releases |
| --- | --- |
| `@zenwave360/vistas-eventflow` | Only that package, if it has pending Changesets |
| `@zenwave360/eventcatalog-components` | Only that package, if it has pending Changesets |
| `@zenwave360/vistas-eventflow-webview` | Only that package, if it has pending Changesets |
| `all` | Every public package that has pending Changesets, in one run |

**Individual** means you pick one package. Other pending Changesets stay on `main` for a later run. Public packages keep independent versions.

**All** (a joint / solidary release) means one workflow run versions and publishes every public package that currently has pending Changesets. Each package still gets its own version, git tag, and GitHub Release. They are not forced to the same number. Use `all` when you want one publish pass for everything that is ready, or when a Changeset file lists more than one public package.

If a single `.changeset/*.md` file names two public packages, you cannot release only one of them. Split that file into two Changesets, or choose `all`.

If releasing one package would also bump another public package (for example an internal dependency update), the workflow fails. Choose `all`, or split the work.

### Release steps

1. Merge the feature pull request, including its Changeset, to `main`.
2. On GitHub, open **Actions → Release**.
3. Run the workflow from `main`.
4. Select one package, or `all`.
5. Wait for the jobs to finish. The `npm-publish` environment may ask for an approval before upload.
6. Confirm each package on npm under the `next` tag.
7. Promote `latest` yourself when you are ready (see [Go live](#go-live)).

### What the workflow does

1. **Validate** — secretless. Checks that you dispatched from `main`, that pending Changesets exist for the selection, that the computed versions are new, and that the git tags, GitHub Releases, and npm versions do not already exist. The first publish of a brand-new package is not allowed here (see [First publish](#first-publish)).
2. **Prepare** — applies `changeset version` on a throwaway `release/…` branch: bumps the selected `package.json` files, writes each package `CHANGELOG.md`, and deletes the consumed Changeset files. Opens a pull request into `main` and merges it. Then it pushes one annotated tag per package: `@scope/name@version`.
3. **Publish** — gated by the `npm-publish` GitHub Environment. Rebuilds the selected packages from that release commit and uploads each tarball with `npm publish --tag next`. There is no `NPM_TOKEN`. Authentication is OIDC trusted publishing.
4. **GitHub Release** — one release per tag. The body is the new section from that package’s `CHANGELOG.md`.

Packages stay on the released version on `main` until the next Changeset run. There is no SNAPSHOT or `-next` version bump after publish.

If publish fails after prepare succeeded, use **Re-run failed jobs** on that same run. Do not **Re-run all jobs**. That would try to version again.

### Go live

Upload is not the same as going live. CI always publishes to the `next` dist-tag. `npm install @zenwave360/vistas-eventflow` still installs the previous `latest` until you promote:

```bash
npm dist-tag add @zenwave360/vistas-eventflow@0.2.0 latest
npm dist-tag add @zenwave360/eventcatalog-components@0.1.1 latest
```

Run those commands from an npm account that can write the `@zenwave360` org and has 2FA. This is the human gateway: a compromised GitHub credential can upload a version under `next`. It cannot move `latest`.

### First publish

OIDC trusted publishing cannot create a package that does not already exist on the registry. Publish the first version of a new package from a trusted machine, once. After that, use this workflow.

### One-time setup

These are repository and npm settings, not per-release steps:

- GitHub Environment `npm-publish`: required reviewer, deployment branches restricted to `main`, no secrets.
- On npmjs.com, a Trusted Publisher for each public package: GitHub Actions, this repository, workflow file `release.yml`, environment `npm-publish`.

### Adding a public package

1. Put it under `packages/` with `publishConfig.access` set to `public`.
2. Do not add it to `.changeset/config.json` `ignore` (that list is for private apps such as the webview).
3. Add its name to the `package` select in `.github/workflows/release.yml`.
4. Publish the first version manually, then configure its Trusted Publisher.

## What not to do

- Do not run `changeset publish` or `npm publish` from a laptop for a normal release. That would publish `latest` and skip the human gateway.
- Do not edit versions in `package.json` to perform a release.
- Do not put IntelliJ plugin code, ZFL/ZDL parsers, or EventCatalog core in this repository. See [REPOSITORY_SCOPE.md](./REPOSITORY_SCOPE.md).
