// Local HTTP server that plays the part of each embedding host for the browser tests.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const STRICT_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

// The same pattern ZenWaveDomainModelEditor's ZflJcefDiagramHost.assetPaths uses to register resources.
export const JCEF_ASSET_PATTERN = /(?:src|href)=["']\.\/([^"']+)["']/g;

export function jcefAssetPaths(indexHtml) {
  return new Set([...indexHtml.matchAll(JCEF_ASSET_PATTERN)].map((match) => `/${match[1]}`));
}

const PARENT_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>parent host</title><script src="/host/parent.js"></script></head>
<body style="margin:0"><iframe id="webview" src="/webview/index.html" style="width:1200px;height:800px;border:0"></iframe></body></html>`;

const PARENT_JS = `window.__received = [];
window.addEventListener('message', (event) => {
  const frame = document.getElementById('webview');
  window.__received.push({ data: event.data, fromWebview: !!frame && event.source === frame.contentWindow });
});`;

/**
 * Routes:
 * - /webview/**            the packaged bundle, as a VS Code-like host serves it, under STRICT_CSP
 * - /rewritten/index.html  index.html with asset URLs rewritten to another local origin, as VS Code's asWebviewUri does,
 *                          under a CSP that names that origin instead of 'self'
 * - /host/parent.html      a parent page that embeds /webview/index.html in an iframe
 * - /jcef/**               only index.html and the assets IntelliJ's JCEF host registers, no CSP
 */
export async function startServer(webviewDirectory) {
  const indexHtml = await readFile(path.join(webviewDirectory, 'index.html'), 'utf8');
  const jcefAssets = jcefAssetPaths(indexHtml);

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const send = (status, body, headers = {}) => {
      response.writeHead(status, headers);
      response.end(body);
    };
    const serveFile = async (relative, headers = {}) => {
      const absolute = path.resolve(webviewDirectory, `.${relative}`);
      if (!absolute.startsWith(path.resolve(webviewDirectory))) return send(403, 'forbidden');
      try {
        const body = await readFile(absolute);
        return send(200, body, {
          'Content-Type': MIME_TYPES[path.extname(absolute)] ?? 'application/octet-stream',
          ...headers,
        });
      } catch {
        return send(404, 'not found');
      }
    };

    if (url.pathname === '/favicon.ico') return send(204, '');

    if (url.pathname.startsWith('/webview/')) {
      return serveFile(url.pathname.slice('/webview'.length), {
        'Content-Security-Policy': STRICT_CSP,
        // A webview resource origin must allow the module script's crossorigin fetch from the page origin.
        'Access-Control-Allow-Origin': '*',
      });
    }

    if (url.pathname === '/rewritten/index.html') {
      const assetOrigin = `http://localhost:${server.address().port}`;
      const rewritten = indexHtml.replace(JCEF_ASSET_PATTERN, (match, asset) =>
        match.replace(`./${asset}`, `${assetOrigin}/webview/${asset}`));
      const csp = STRICT_CSP
        .replace("script-src 'self'", `script-src ${assetOrigin}`)
        .replace("style-src 'self'", `style-src ${assetOrigin}`)
        .replace("img-src 'self' data:", `img-src ${assetOrigin} data:`)
        .replace("font-src 'self'", `font-src ${assetOrigin}`);
      return send(200, rewritten, { 'Content-Type': MIME_TYPES['.html'], 'Content-Security-Policy': csp });
    }

    if (url.pathname === '/host/parent.html') return send(200, PARENT_HTML, { 'Content-Type': MIME_TYPES['.html'] });
    if (url.pathname === '/host/parent.js') return send(200, PARENT_JS, { 'Content-Type': MIME_TYPES['.js'] });

    if (url.pathname === '/jcef/index.html') return serveFile('/index.html');
    if (url.pathname.startsWith('/jcef/')) {
      const asset = url.pathname.slice('/jcef'.length);
      if (!jcefAssets.has(asset)) return send(404, 'not registered by the JCEF host');
      return serveFile(asset);
    }

    return send(404, 'not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    port,
    origin: `http://127.0.0.1:${port}`,
    localOrigins: [`http://127.0.0.1:${port}`, `http://localhost:${port}`],
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
