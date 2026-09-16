// Copies the built EventFlow webview (apps/eventflow-webview/dist) into this package's webview/ directory.
// Source maps are left out: hosts load the bundle, they do not debug it.
import { cp, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const sourceDirectory = path.resolve(packageDirectory, '../../apps/eventflow-webview/dist');
const targetDirectory = path.resolve(packageDirectory, 'webview');

async function main() {
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
