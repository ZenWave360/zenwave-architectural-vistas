// Static checks on webview-toolbar/: it has the same shape as webview/ and the same protocol identity.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as api from '../index.js';

const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(packageDirectory, api.EVENTFLOW_WEBVIEW_TOOLBAR_DIRECTORY);
const manifest = JSON.parse(readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'));
const read = (relative) => readFileSync(path.join(directory, relative), 'utf8');

test('webview-toolbar/ has an index.html that references only its own relative assets, and nothing inline', () => {
  assert.equal(api.EVENTFLOW_WEBVIEW_TOOLBAR_ENTRY, `${api.EVENTFLOW_WEBVIEW_TOOLBAR_DIRECTORY}/index.html`);
  const html = read('index.html');
  assert.doesNotMatch(html, /<style\b|\sstyle=|\son[a-z]+=/i);
  for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    assert.match(attributes, /\bsrc=/);
    assert.equal(body.trim(), '');
  }
  const references = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]);
  for (const reference of references) assert.match(reference, /^\.\/assets\//);
  const assets = readdirSync(path.join(directory, 'assets')).map((file) => `./assets/${file}`);
  assert.deepEqual([...assets].sort(), [...references].sort());
});

test('webview-toolbar/ states the same protocol as webview/', () => {
  const expected = { protocol: api.EVENTFLOW_WEBVIEW_PROTOCOL, protocolVersion: api.EVENTFLOW_WEBVIEW_PROTOCOL_VERSION };
  assert.deepEqual(JSON.parse(read('protocol.json')), expected);
  assert.deepEqual(JSON.parse(readFileSync(path.join(packageDirectory, 'webview/protocol.json'), 'utf8')), expected);
  assert.match(read('index.html'), new RegExp(`<meta name="zenwave-webview-protocol-version" content="${expected.protocolVersion}">`));
});

test('the package ships and exports webview-toolbar/, and its API additions keep the existing ones', () => {
  assert.ok(manifest.files.includes('webview-toolbar'));
  assert.ok(manifest.files.includes('webview'));
  assert.equal(manifest.exports['./webview-toolbar/*'], './webview-toolbar/*');
  assert.equal(manifest.exports['./webview-toolbar/protocol.json'], './webview-toolbar/protocol.json');
  assert.equal(manifest.exports['./webview/*'], './webview/*');
  assert.deepEqual([...api.EVENTFLOW_WEBVIEW_OUTBOUND_MESSAGES], ['webviewReady']);
  assert.deepEqual([...api.EVENTFLOW_WEBVIEW_TOOLBAR_OUTBOUND_MESSAGES], ['webviewReady', 'viewModeChanged']);
  assert.ok(existsSync(path.join(directory, 'protocol.json')));
});
