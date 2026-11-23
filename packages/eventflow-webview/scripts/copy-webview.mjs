// Copies the built EventFlow webview pages into this package: apps/eventflow-webview/dist into webview/ and
// apps/eventflow-toolbar-webview/dist into webview-toolbar/.
// Source maps are left out: hosts load the bundle, they do not debug it.
import { cp, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const pages = [
  { app: 'eventflow-webview', target: 'webview' },
  { app: 'eventflow-toolbar-webview', target: 'webview-toolbar' },
];

async function copyPage({ app, target }) {
  const sourceDirectory = path.resolve(packageDirectory, '../../apps', app, 'dist');
  const targetDirectory = path.resolve(packageDirectory, target);

  try {
    await stat(path.join(sourceDirectory, 'index.html'));
  } catch {
    throw new Error(`EventFlow webview has not been built: ${sourceDirectory}`);
  }

  await rm(targetDirectory, { recursive: true, force: true });
  await cp(sourceDirectory, targetDirectory, {
    recursive: true,
    filter: (source) => !source.endsWith('.map'),
  });

  const assets = await readdir(path.join(targetDirectory, 'assets'));
  console.log(`EventFlow webview copied to ${targetDirectory}: index.html, protocol.json, assets/${assets.join(', assets/')}`);
}

async function main() {
  for (const page of pages) await copyPage(page);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
