import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { resolveRequestPath, mimeFor, createServer } from '../serve.js';

const ROOT = path.resolve('/app');

test('"/" and directories map to index.html, and app files map to their path', () => {
  assert.equal(resolveRequestPath(ROOT, '/'), path.join(ROOT, 'index.html'));
  assert.equal(resolveRequestPath(ROOT, '/index.html'), path.join(ROOT, 'index.html'));
  assert.equal(resolveRequestPath(ROOT, '/js/main.js'), path.join(ROOT, 'js', 'main.js'));
  assert.equal(resolveRequestPath(ROOT, '/js/ui/todoList.js'), path.join(ROOT, 'js', 'ui', 'todoList.js'));
  assert.equal(resolveRequestPath(ROOT, '/css/style.css'), path.join(ROOT, 'css', 'style.css'));
  assert.equal(
    resolveRequestPath(ROOT, '/tests/browser/ui-smoke.html'),
    path.join(ROOT, 'tests', 'browser', 'ui-smoke.html'),
  );
});

test('query strings and fragments are ignored', () => {
  assert.equal(resolveRequestPath(ROOT, '/index.html?x=1#y'), path.join(ROOT, 'index.html'));
  assert.equal(resolveRequestPath(ROOT, '/?b0.123'), path.join(ROOT, 'index.html'));
});

test('path traversal is rejected in every spelling', () => {
  const attacks = [
    '/../package.json',
    '/js/../../x',
    '/%2e%2e/package.json',
    '/js/%2e%2e/%2e%2e/x',
    '/..%2fpackage.json',
    '/js\\..\\..\\x',
    '/js/%5c..%5c..%5cx',
    '/js/\u0000x',
    '/js/%00x',
    '/%',
    '//etc/passwd',
  ];
  for (const attack of attacks) {
    assert.equal(resolveRequestPath(ROOT, attack), null, attack);
  }
});

test('only the web surface is served: no server script, package files, docs, unit tests or dotfiles', () => {
  const blocked = [
    '/package.json', '/serve.js', '/run.sh', '/run.bat', '/README.md',
    '/tests/dateUtils.test.js', '/tests/storage.test.js', '/tests',
    '/tests/browser/../dateUtils.test.js', '/.git/config', '/js/.hidden', '/.env',
  ];
  for (const url of blocked) {
    assert.equal(resolveRequestPath(ROOT, url), null, url);
  }
});

test('mimeFor returns utf-8 text types and a safe default', () => {
  assert.equal(mimeFor('a/index.html'), 'text/html; charset=utf-8');
  assert.equal(mimeFor('a/main.js'), 'text/javascript; charset=utf-8');
  assert.equal(mimeFor('a/style.css'), 'text/css; charset=utf-8');
  assert.equal(mimeFor('a/data.json'), 'application/json; charset=utf-8');
  assert.equal(mimeFor('a/icon.svg'), 'image/svg+xml');
  assert.equal(mimeFor('a/unknown.bin'), 'application/octet-stream');
  assert.equal(mimeFor('a/UPPER.JS'), 'text/javascript; charset=utf-8');
});

function request(port, method, urlPath) {
  return new Promise((resolve, reject) => {
    // http.request 는 경로를 정규화하지 않으므로 ".." 같은 원본 경로를 그대로 보낼 수 있다
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('the server serves app files, hides everything else and only answers GET/HEAD', async (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ffg-serve-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const root = path.join(tmp, 'web');
  fs.mkdirSync(path.join(root, 'js'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<h1>hello 한글</h1>');
  fs.writeFileSync(path.join(root, 'js', 'a.js'), 'export const a = 1;');
  fs.writeFileSync(path.join(root, 'secret.txt'), 'top secret');
  fs.writeFileSync(path.join(tmp, 'outside.txt'), 'outside the root');

  const server = createServer(root);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();

  const home = await request(port, 'GET', '/');
  assert.equal(home.status, 200);
  assert.equal(home.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(home.headers['cache-control'], 'no-store');
  assert.equal(home.body, '<h1>hello 한글</h1>');

  const js = await request(port, 'GET', '/js/a.js');
  assert.equal(js.status, 200);
  assert.equal(js.headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal(js.body, 'export const a = 1;');

  assert.equal((await request(port, 'GET', '/js/missing.js')).status, 404);
  assert.equal((await request(port, 'GET', '/secret.txt')).status, 404);
  assert.equal((await request(port, 'GET', '/../outside.txt')).status, 404);
  assert.equal((await request(port, 'GET', '/%2e%2e/outside.txt')).status, 404);

  const head = await request(port, 'HEAD', '/index.html');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.ok(Number(head.headers['content-length']) > 0);

  const post = await request(port, 'POST', '/index.html');
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
});
