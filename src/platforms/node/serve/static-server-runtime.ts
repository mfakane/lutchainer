import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

export interface StaticServerOptions {
  rootDir: string;
  host?: string;
  port?: number;
}

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.lutchain': 'application/x-lutchain',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

function normalizeRequestPath(urlPath: string): string {
  const decoded = decodeURIComponent(urlPath).replace(/\?.*$/, '');
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  if (normalized === '.' || normalized === path.sep) {
    return 'index.html';
  }
  return normalized.replace(/^[/\\]+/, '');
}

export async function createStaticServer(options: StaticServerOptions): Promise<{
  close: () => Promise<void>;
  host: string;
  port: number;
  server: unknown;
}> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 8000;
  const rootDir = path.resolve(options.rootDir);

  const server = http.createServer((req, res) => {
    const requestPath = normalizeRequestPath(req.url ?? '/');
    const filePath = path.join(rootDir, requestPath);
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
      });
      res.end(data);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  return {
    close: async () => await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    }),
    host,
    port,
    server,
  };
}
