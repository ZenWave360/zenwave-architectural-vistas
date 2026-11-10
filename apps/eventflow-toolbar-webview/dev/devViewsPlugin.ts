import { existsSync, mkdirSync, readdirSync, renameSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';

export type DevViewKind = 'eventflow' | 'mermaid' | 'error' | 'positions';

export const DEV_VIEWS_EVENT = 'zenwave:dev-views';

const FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._ -]*$/;

function kindOf(file: string): DevViewKind | null {
  if (!FILE_PATTERN.test(file) || file.includes('..')) return null;
  if (file.endsWith('.eventflow.json')) return 'eventflow';
  if (file.endsWith('.mermaid.json')) return 'mermaid';
  if (file.endsWith('.error.txt')) return 'error';
  if (file.endsWith('.positions.json')) return 'positions';
  return null;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function writeAtomic(path: string, content: string) {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, content);
  renameSync(temp, path);
}

/**
 * Dev only. Serves the JSON files that dsl-kotlin's DevViewsExport writes, lets a client POST new ones, and tells the
 * dev pages over the Vite websocket when a file changed.
 */
export function devViewsPlugin(): Plugin {
  const dir = resolve(process.env.ZENWAVE_DEV_VIEWS_DIR ?? fileURLToPath(new URL('../../../../dsl-kotlin/build/dev-views', import.meta.url)));

  return {
    name: 'zenwave-dev-views',
    apply: 'serve',
    configureServer(server) {
      mkdirSync(dir, { recursive: true });
      server.config.logger.info(`  dev views directory: ${dir}`);
      server.watcher.add(dir);

      const notify = (path: string) => {
        if (resolve(dirname(path)) !== dir) return;
        const file = basename(path);
        const kind = kindOf(file);
        if (!kind) return;
        server.ws.send({ type: 'custom', event: DEV_VIEWS_EVENT, data: { file, kind } });
      };
      for (const event of ['add', 'change', 'unlink'] as const) server.watcher.on(event, notify);

      server.middlewares.use('/__dev/views', async (req, res) => {
        const send = (status: number, body: string, type = 'application/json') => {
          res.statusCode = status;
          res.setHeader('Content-Type', `${type}; charset=utf-8`);
          res.setHeader('Cache-Control', 'no-store');
          res.end(body);
        };
        try {
          const file = decodeURIComponent((req.url ?? '/').split('?')[0].replace(/^\//, ''));
          if (file === '') {
            if (req.method !== 'GET') return send(405, '{"error":"method not allowed"}');
            const list = readdirSync(dir)
              .map((name) => ({ name, kind: kindOf(name) }))
              .filter((entry): entry is { name: string; kind: DevViewKind } => entry.kind !== null && entry.kind !== 'positions')
              .map(({ name, kind }) => ({
                file: name,
                name: name.replace(/\.(eventflow\.json|mermaid\.json|error\.txt)$/, ''),
                kind,
                mtime: statSync(join(dir, name)).mtimeMs,
              }));
            return send(200, JSON.stringify(list));
          }
          const kind = kindOf(file);
          if (!kind) return send(400, '{"error":"unsupported file name"}');
          const path = join(dir, file);
          if (req.method === 'GET') {
            if (!existsSync(path)) return send(404, '{"error":"not found"}');
            return send(200, readFileSync(path, 'utf8'), kind === 'error' ? 'text/plain' : 'application/json');
          }
          if (req.method === 'POST' || req.method === 'PUT') {
            if (kind === 'error') return send(400, '{"error":"error files are written by the generator"}');
            const text = await readBody(req);
            let body: unknown;
            try {
              body = JSON.parse(text);
            } catch (e) {
              return send(400, JSON.stringify({ error: `invalid JSON: ${(e as Error).message}` }));
            }
            if (typeof body !== 'object' || body === null || Array.isArray(body)) return send(400, '{"error":"body must be a JSON object"}');
            if (kind === 'eventflow' && (body as { schema?: unknown }).schema === 'zfl.eventflow.view@1') {
              body = { name: file.replace(/\.eventflow\.json$/, ''), generatedAt: new Date().toISOString(), flowGraph: body };
            }
            writeAtomic(path, JSON.stringify(body));
            return send(200, JSON.stringify({ file, written: true }));
          }
          send(405, '{"error":"method not allowed"}');
        } catch (e) {
          send(500, JSON.stringify({ error: (e as Error).message }));
        }
      });
    },
  };
}
