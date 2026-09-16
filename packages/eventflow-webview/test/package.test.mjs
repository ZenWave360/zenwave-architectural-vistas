// Static checks on the packaged webview directory: what a host serves, and what it can rely on without running it.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as api from '../index.js';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const webviewDirectory = path.join(packageDirectory, 'webview');
const manifest = JSON.parse(readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'));
const appProtocolSource = readFileSync(
  path.resolve(packageDirectory, '../../apps/eventflow-webview/src/protocol.ts'),
  'utf8',
);

function read(relative) {
  return readFileSync(path.join(webviewDirectory, relative), 'utf8');
}

test('the package was built', () => {
  assert.ok(existsSync(path.join(webviewDirectory, 'index.html')), 'run `pnpm build` before `pnpm test`');
});

test('index.html has no inline script, inline style or style attribute', () => {
  const html = read('index.html');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length > 0);
  for (const [, attributes, body] of scripts) {
    assert.match(attributes, /\bsrc=/, 'every script is loaded from a file');
    assert.equal(body.trim(), '', 'no inline script body');
  }
  assert.doesNotMatch(html, /<style\b/i);
  assert.doesNotMatch(html, /\sstyle=/i);
  assert.doesNotMatch(html, /\son[a-z]+=/i, 'no inline event handlers');
});

test('index.html references only relative assets that exist in the package', () => {
  const html = read('index.html');
  const references = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]);
  assert.ok(references.some((reference) => reference.endsWith('.js')));
  assert.ok(references.some((reference) => reference.endsWith('.css')));
  for (const reference of references) {
    assert.match(reference, /^\.\/assets\//, `${reference} is relative to index.html`);
    assert.ok(existsSync(path.join(webviewDirectory, reference)), `${reference} exists`);
  }
  // The only files a host must serve are index.html, what it references, and protocol.json.
  const assets = readdirSync(path.join(webviewDirectory, 'assets')).map((file) => `./assets/${file}`);
  assert.deepEqual([...assets].sort(), [...references].sort());
});

test('styles load nothing remote and declare no fonts', () => {
  for (const file of readdirSync(path.join(webviewDirectory, 'assets')).filter((name) => name.endsWith('.css'))) {
    const css = read(`assets/${file}`);
    assert.doesNotMatch(css, /@font-face/i, `${file} declares no font`);
    assert.doesNotMatch(css, /@import/i, `${file} imports nothing`);
    for (const [, target] of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      assert.match(target, /^data:/, `${file} url(${target}) is inline data`);
    }
  }
});

test('the protocol version is the same in the package API, protocol.json, index.html and the page source', () => {
  const protocol = JSON.parse(read('protocol.json'));
  assert.deepEqual(protocol, {
    protocol: api.EVENTFLOW_WEBVIEW_PROTOCOL,
    protocolVersion: api.EVENTFLOW_WEBVIEW_PROTOCOL_VERSION,
  });

  const html = read('index.html');
  assert.match(html, new RegExp(`<meta name="zenwave-webview-protocol" content="${api.EVENTFLOW_WEBVIEW_PROTOCOL}">`));
  assert.match(
    html,
    new RegExp(`<meta name="zenwave-webview-protocol-version" content="${api.EVENTFLOW_WEBVIEW_PROTOCOL_VERSION}">`),
  );

  assert.match(appProtocolSource, new RegExp(`EVENTFLOW_WEBVIEW_PROTOCOL = '${api.EVENTFLOW_WEBVIEW_PROTOCOL}'`));
  assert.match(appProtocolSource, new RegExp(`EVENTFLOW_WEBVIEW_PROTOCOL_VERSION = ${api.EVENTFLOW_WEBVIEW_PROTOCOL_VERSION};`));
});

test('package.json exposes the webview directory and ships no source maps or lifecycle scripts', () => {
  assert.equal(api.EVENTFLOW_WEBVIEW_ENTRY, `${api.EVENTFLOW_WEBVIEW_DIRECTORY}/index.html`);
  assert.ok(manifest.files.includes(api.EVENTFLOW_WEBVIEW_DIRECTORY));
  assert.equal(manifest.exports['./protocol.json'], './webview/protocol.json');
  assert.equal(manifest.exports['./webview/*'], './webview/*');
  assert.deepEqual(manifest.dependencies ?? {}, {}, 'a static bundle has no runtime dependencies');
  for (const script of ['prepare', 'prepack', 'postpack', 'prepublishOnly', 'install', 'postinstall']) {
    assert.equal(manifest.scripts[script], undefined, `no ${script} script`);
  }
  const maps = readdirSync(path.join(webviewDirectory, 'assets')).filter((file) => file.endsWith('.map'));
  assert.deepEqual(maps, []);
});
