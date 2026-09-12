import { constants } from 'node:fs';
import {
  access,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rmdir,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceDirectory = path.resolve(repositoryRoot, 'apps/eventflow-webview/dist');
const defaultPluginDirectory = path.resolve(repositoryRoot, '../ZenWaveDomainModelEditor');
const resourcePath = path.join('src', 'main', 'resources', 'web', 'eventflow');

function parseArguments(arguments_) {
  let pluginDirectory;
  let dryRun = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--') continue;
    if (argument === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (argument === '--plugin-dir') {
      pluginDirectory = arguments_[index + 1];
      index += 1;
      if (!pluginDirectory) throw new Error('--plugin-dir requires a path');
      continue;
    }
    if (argument.startsWith('--plugin-dir=')) {
      pluginDirectory = argument.slice('--plugin-dir='.length);
      if (!pluginDirectory) throw new Error('--plugin-dir requires a path');
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    dryRun,
    pluginDirectory:
      pluginDirectory || process.env.ZENWAVE_INTELLIJ_PLUGIN_DIR || defaultPluginDirectory,
  };
}

function normalizedPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function assertInside(parent, child, label) {
  const relative = path.relative(parent, child);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} is not a child of the validated plugin directory: ${child}`);
  }
}

async function exists(value) {
  try {
    await access(value, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function assertOrdinaryDirectory(directory, label) {
  const status = await lstat(directory);
  if (status.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link or junction: ${directory}`);
  if (!status.isDirectory()) throw new Error(`${label} is not a directory: ${directory}`);
}

async function validatePluginDirectory(candidate) {
  const absoluteCandidate = path.resolve(candidate);
  await assertOrdinaryDirectory(absoluteCandidate, 'IntelliJ plugin directory');

  const pluginDirectory = await realpath(absoluteCandidate);
  const marker = path.join(pluginDirectory, 'build.gradle.kts');
  const resourcesDirectory = path.join(pluginDirectory, 'src', 'main', 'resources');
  const webDirectory = path.join(resourcesDirectory, 'web');
  if (!(await exists(marker))) throw new Error(`Not a ZenWave IntelliJ plugin checkout; missing ${marker}`);
  await assertOrdinaryDirectory(resourcesDirectory, 'IntelliJ resources directory');

  if (await exists(webDirectory)) {
    await assertOrdinaryDirectory(webDirectory, 'IntelliJ web resources directory');
    const actualWebDirectory = await realpath(webDirectory);
    if (normalizedPath(actualWebDirectory) !== normalizedPath(webDirectory)) {
      throw new Error(`IntelliJ web resources directory resolves outside its expected path: ${actualWebDirectory}`);
    }
  }

  const targetDirectory = path.resolve(pluginDirectory, resourcePath);
  assertInside(pluginDirectory, targetDirectory, 'EventFlow resource directory');

  if (await exists(targetDirectory)) {
    await assertOrdinaryDirectory(targetDirectory, 'EventFlow resource directory');
    const actualTarget = await realpath(targetDirectory);
    if (normalizedPath(actualTarget) !== normalizedPath(targetDirectory)) {
      throw new Error(`EventFlow resource directory resolves outside its expected path: ${actualTarget}`);
    }
  }

  return { pluginDirectory, targetDirectory };
}

async function listFiles(directory, relativeDirectory = '') {
  if (!(await exists(directory))) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relative = path.join(relativeDirectory, entry.name);
    const absolute = path.join(directory, entry.name);
    const status = await lstat(absolute);
    if (status.isSymbolicLink()) throw new Error(`Refusing to traverse symbolic link or junction: ${absolute}`);
    if (status.isDirectory()) {
      files.push(...(await listFiles(absolute, relative)));
    } else if (status.isFile()) {
      files.push(relative);
    } else {
      throw new Error(`Unsupported filesystem entry in bundle directory: ${absolute}`);
    }
  }

  return files;
}

async function filesEqual(left, right) {
  if (!(await exists(right))) return false;
  const rightStatus = await lstat(right);
  if (rightStatus.isSymbolicLink() || !rightStatus.isFile()) {
    throw new Error(`Expected an ordinary target file: ${right}`);
  }
  const [leftContents, rightContents] = await Promise.all([readFile(left), readFile(right)]);
  return leftContents.equals(rightContents);
}

async function removeEmptyDirectories(directory, root) {
  if (!(await exists(directory))) return;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    await removeEmptyDirectories(path.join(directory, entry.name), root);
  }
  if (normalizedPath(directory) !== normalizedPath(root) && (await readdir(directory)).length === 0) {
    await rmdir(directory);
  }
}

async function synchronize() {
  const options = parseArguments(process.argv.slice(2));
  await assertOrdinaryDirectory(sourceDirectory, 'Built EventFlow webview directory');
  if (!(await exists(path.join(sourceDirectory, 'index.html')))) {
    throw new Error(`EventFlow webview has not been built: ${sourceDirectory}`);
  }

  const { pluginDirectory, targetDirectory } = await validatePluginDirectory(options.pluginDirectory);
  const sourceFiles = await listFiles(sourceDirectory);
  const targetFiles = await listFiles(targetDirectory);
  const sourceSet = new Set(sourceFiles);
  const staleFiles = targetFiles.filter((file) => !sourceSet.has(file));
  const changedFiles = [];

  for (const file of sourceFiles) {
    const source = path.resolve(sourceDirectory, file);
    const target = path.resolve(targetDirectory, file);
    assertInside(sourceDirectory, source, 'Source bundle file');
    assertInside(targetDirectory, target, 'Target bundle file');
    if (!(await filesEqual(source, target))) changedFiles.push(file);
  }

  console.log(`IntelliJ plugin: ${pluginDirectory}`);
  console.log(`EventFlow target: ${targetDirectory}`);
  console.log(`Bundle files: ${sourceFiles.length}; changed: ${changedFiles.length}; stale: ${staleFiles.length}`);
  for (const file of changedFiles) console.log(`  copy   ${file}`);
  for (const file of staleFiles) console.log(`  remove ${file}`);

  if (options.dryRun) {
    console.log('Dry run complete; no files changed.');
    return;
  }

  await mkdir(targetDirectory, { recursive: true });
  for (const file of changedFiles) {
    const source = path.resolve(sourceDirectory, file);
    const target = path.resolve(targetDirectory, file);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }

  for (const file of staleFiles) {
    const target = path.resolve(targetDirectory, file);
    assertInside(targetDirectory, target, 'Stale target file');
    const status = await lstat(target);
    if (status.isSymbolicLink() || !status.isFile()) {
      throw new Error(`Refusing to remove a non-file target: ${target}`);
    }
    await unlink(target);
  }
  await removeEmptyDirectories(targetDirectory, targetDirectory);
  console.log('EventFlow webview synchronized.');
}

synchronize().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
