import { appendFileSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const changesetDirectory = path.join(repositoryRoot, '.changeset');
const packagesDirectory = path.join(repositoryRoot, 'packages');

const lifecycleScripts = new Set([
  'preinstall',
  'install',
  'postinstall',
  'prepublish',
  'prepare',
  'prepublishOnly',
  'prepack',
  'postpack',
  'publish',
  'postpublish',
  'preuninstall',
  'uninstall',
  'postuninstall',
]);

function fail(message) {
  process.stderr.write(`::error::${message}\n`);
  process.exit(1);
}

function parseArguments(arguments_) {
  const [command, ...rest] = arguments_;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === '--') continue;
    if (!argument.startsWith('--')) {
      fail(`Unexpected argument: ${argument}`);
    }

    const key = argument.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) {
      options[key] = 'true';
      continue;
    }
    options[key] = next;
    index += 1;
  }

  return { command, options };
}

function requiredOption(options, name) {
  const value = options[name];
  if (!value) fail(`Missing required --${name}`);
  return value;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function listPublicPackages() {
  const entries = await readdir(packagesDirectory, { withFileTypes: true });
  const packages = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(packagesDirectory, entry.name);
    const manifestPath = path.join(directory, 'package.json');
    const manifest = await readJson(manifestPath);
    if (manifest.private === true) continue;
    if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
      fail(`Invalid package.json in ${path.relative(repositoryRoot, directory)}`);
    }
    packages.push({
      name: manifest.name,
      version: manifest.version,
      directory: path.relative(repositoryRoot, directory).replaceAll('\\', '/'),
    });
  }

  return packages.sort((left, right) => left.name.localeCompare(right.name));
}

function packageByName(packages, name) {
  return packages.find((item) => item.name === name);
}

function tagFor(name, version) {
  return `${name}@${version}`;
}

function parseChangesetFrontmatter(content, filePath) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    fail(`Changeset ${filePath} is missing a YAML frontmatter block.`);
  }

  const releases = [];
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const entry = trimmed.match(/^["']?([^"':]+)["']?\s*:\s*(\S+)\s*$/);
    if (!entry) {
      fail(`Changeset ${filePath} has an unreadable frontmatter line: ${trimmed}`);
    }
    releases.push({ name: entry[1], type: entry[2] });
  }

  return releases;
}

async function listChangesetFiles() {
  const entries = await readdir(changesetDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
    .map((entry) => path.join(changesetDirectory, entry.name));
}

function selectedReleases(status, selection, publicPackages) {
  const publicNames = new Set(publicPackages.map((item) => item.name));
  const releases = (status.releases || []).filter((release) => publicNames.has(release.name));

  if (selection === 'all') return releases;

  if (!publicNames.has(selection)) {
    fail(`Unknown public package '${selection}'.`);
  }

  return releases.filter((release) => release.name === selection);
}

function toPlan(releases, publicPackages) {
  return {
    releases: releases.map((release) => {
      const found = packageByName(publicPackages, release.name);
      if (!found) fail(`Status refers to unknown package '${release.name}'.`);
      if (!release.newVersion) fail(`Changeset status did not compute a new version for ${release.name}.`);
      return {
        name: release.name,
        version: release.newVersion,
        oldVersion: release.oldVersion,
        type: release.type,
        directory: found.directory,
        tag: tagFor(release.name, release.newVersion),
      };
    }),
  };
}

function writeGithubOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    process.stdout.write(`${name}=${value}\n`);
    return;
  }
  appendFileSync(outputFile, `${name}<<EOF\n${value}\nEOF\n`);
}

function writePlanOutputs(plan) {
  const json = JSON.stringify(plan);
  writeGithubOutput('packages', json);
  writeGithubOutput('count', String(plan.releases.length));
  writeGithubOutput(
    'summary',
    plan.releases.map((release) => `${release.name} ${release.oldVersion} -> ${release.version}`).join(', '),
  );
  writeGithubOutput(
    'branch_suffix',
    plan.releases
      .map((release) => `${release.name.replace(/^@zenwave360\//, '')}-${release.version}`)
      .join('_'),
  );
}

async function plan(options) {
  const selection = requiredOption(options, 'package');
  const statusPath = requiredOption(options, 'status');
  const publicPackages = await listPublicPackages();
  const status = await readJson(statusPath);
  const releases = selectedReleases(status, selection, publicPackages);

  if (releases.length === 0) {
    if (selection === 'all') {
      fail('No pending changesets for any public package. Run `pnpm changeset` and merge that file to main first.');
    }
    fail(
      `No pending changesets for ${selection}. Run \`pnpm changeset\`, select this package, and merge that file to main first.`,
    );
  }

  const planDocument = toPlan(releases, publicPackages);
  const json = `${JSON.stringify(planDocument, null, 2)}\n`;
  if (options.out) await writeFile(options.out, json, 'utf8');
  writePlanOutputs(planDocument);
  process.stdout.write(json);
}

async function isolate(options) {
  const selection = requiredOption(options, 'package');
  const holdDirectory = requiredOption(options, 'hold-dir');
  if (selection === 'all') return;

  const publicNames = new Set((await listPublicPackages()).map((item) => item.name));
  if (!publicNames.has(selection)) fail(`Unknown public package '${selection}'.`);

  await mkdir(holdDirectory, { recursive: true });
  const files = await listChangesetFiles();

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8');
    const mentioned = parseChangesetFrontmatter(content, path.relative(repositoryRoot, filePath))
      .map((entry) => entry.name)
      .filter((name) => publicNames.has(name));
    const unique = [...new Set(mentioned)];

    if (unique.includes(selection) && unique.some((name) => name !== selection)) {
      fail(
        `${path.relative(repositoryRoot, filePath)} mentions ${selection} and another public package (${unique.join(', ')}). Split that changeset or choose package=all.`,
      );
    }

    if (!unique.includes(selection)) {
      await rename(filePath, path.join(holdDirectory, path.basename(filePath)));
    }
  }
}

async function restore(options) {
  const holdDirectory = requiredOption(options, 'hold-dir');
  let entries = [];
  try {
    entries = await readdir(holdDirectory, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    await rename(path.join(holdDirectory, entry.name), path.join(changesetDirectory, entry.name));
  }
}

async function assertPlannedVersions(options) {
  const planDocument = await readJson(requiredOption(options, 'plan'));
  const before = await readJson(requiredOption(options, 'before'));
  const after = await listPublicPackages();
  const planned = new Map(planDocument.releases.map((release) => [release.name, release]));
  const previousVersions = new Map((before.packages || []).map((item) => [item.name, item.version]));

  for (const item of after) {
    const expected = planned.get(item.name);
    if (expected) {
      if (item.version !== expected.version) {
        fail(`Expected ${item.name} to be ${expected.version} after changeset version, found ${item.version}.`);
      }
      continue;
    }
    if (item.version !== previousVersions.get(item.name)) {
      fail(
        `${item.name} was also versioned to ${item.version}. Re-run with package=all, or split the pending changesets.`,
      );
    }
  }
}

async function snapshotPublicPackages(options = {}) {
  const snapshot = { packages: await listPublicPackages() };
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  if (options.out) await writeFile(options.out, json, 'utf8');
  process.stdout.write(json);
}

async function snapshotDiff(options) {
  const beforePath = requiredOption(options, 'before');
  const before = await readJson(beforePath);
  const previousVersions = new Map((before.packages || []).map((item) => [item.name, item.version]));
  const after = await listPublicPackages();

  const releases = after
    .filter((item) => item.version !== previousVersions.get(item.name))
    .map((item) => ({ name: item.name, version: item.version, directory: item.directory }));

  const planDocument = { releases };
  const json = `${JSON.stringify(planDocument, null, 2)}\n`;
  if (options.out) await writeFile(options.out, json, 'utf8');

  writeGithubOutput('packages', JSON.stringify(planDocument));
  writeGithubOutput('count', String(releases.length));
  writeGithubOutput('summary', releases.map((release) => `${release.name}@${release.version}`).join(', '));
  process.stdout.write(json);
}

function extractChangelogSection(markdown, version) {
  const heading = `## ${version}`;
  const start = markdown.indexOf(heading);
  if (start === -1) return '';

  const afterHeading = start + heading.length;
  const next = markdown.indexOf('\n## ', afterHeading);
  const section = (next === -1 ? markdown.slice(start) : markdown.slice(start, next)).trim();
  return section;
}

async function extractChangelog(options) {
  const packageName = requiredOption(options, 'package');
  const version = requiredOption(options, 'version');
  const output = requiredOption(options, 'out');
  const publicPackages = await listPublicPackages();
  const found = packageByName(publicPackages, packageName);
  if (!found) fail(`Unknown public package '${packageName}'.`);

  const changelogPath = path.join(repositoryRoot, found.directory, 'CHANGELOG.md');
  let markdown;
  try {
    markdown = await readFile(changelogPath, 'utf8');
  } catch {
    fail(`Missing ${found.directory}/CHANGELOG.md after versioning.`);
  }

  const section = extractChangelogSection(markdown, version);
  if (!section) {
    fail(`${found.directory}/CHANGELOG.md has no '${version}' section.`);
  }

  await writeFile(output, `${section}\n`, 'utf8');
}

function runTar(filePath) {
  const result = spawnSync('tar', ['-tzf', filePath], { encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`tar -tzf failed for ${filePath}: ${result.stderr || result.stdout}`);
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

async function validateTarball(options) {
  const filePath = requiredOption(options, 'file');
  const expectedName = requiredOption(options, 'name');
  const expectedVersion = requiredOption(options, 'version');
  const entries = runTar(filePath);
  const unexpected = entries.filter((entry) => !entry.startsWith('package/'));
  if (unexpected.length > 0) {
    fail(`Tarball contains entries outside package/: ${unexpected.join(', ')}`);
  }

  const extract = spawnSync('tar', ['-xzOf', filePath, 'package/package.json'], { encoding: 'utf8' });
  if (extract.status !== 0) {
    fail(`Could not read package/package.json from ${filePath}`);
  }

  const manifest = JSON.parse(extract.stdout);
  if (manifest.name !== expectedName) {
    fail(`Tarball name '${manifest.name}' != expected '${expectedName}'.`);
  }
  if (manifest.version !== expectedVersion) {
    fail(`Tarball version '${manifest.version}' != expected '${expectedVersion}'.`);
  }

  const scripts = manifest.scripts || {};
  const blocked = Object.keys(scripts).filter((name) => lifecycleScripts.has(name));
  if (blocked.length > 0) {
    fail(`Tarball package.json declares lifecycle scripts (${blocked.join(', ')}); refusing to publish.`);
  }
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (!command) fail('Missing command');

  switch (command) {
    case 'plan':
      await plan(options);
      break;
    case 'isolate':
      await isolate(options);
      break;
    case 'restore':
      await restore(options);
      break;
    case 'assert-planned-versions':
      await assertPlannedVersions(options);
      break;
    case 'snapshot-public':
      await snapshotPublicPackages(options);
      break;
    case 'snapshot-diff':
      await snapshotDiff(options);
      break;
    case 'extract-changelog':
      await extractChangelog(options);
      break;
    case 'validate-tarball':
      await validateTarball(options);
      break;
    default:
      fail(`Unknown command: ${command}`);
  }
}

await main();
