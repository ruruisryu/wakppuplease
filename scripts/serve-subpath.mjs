// Verify the exact relative-asset behavior of a repository GitHub Pages URL.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain',
  '.md': 'text/plain',
};
http
  .createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (!path.startsWith('/WAKPPU_Please/')) {
        res.writeHead(404).end();
        return;
      }
      const relative = decodeURIComponent(path.slice('/WAKPPU_Please/'.length)) || 'index.html';
      const file = resolve(root, relative);
      if (!file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      const data = await readFile(file);
      res
        .writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' })
        .end(data);
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(4174, '127.0.0.1', () => console.log('http://127.0.0.1:4174/WAKPPU_Please/'));
