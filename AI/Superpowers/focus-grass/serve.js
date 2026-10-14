// Focus & Grass 로컬 서버: 의존성 없이 앱 파일만 127.0.0.1 로 서빙한다. (macOS / Windows / Linux 공통)
//   node serve.js [포트] [--no-open]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 8000;
const PORT_TRIES = 20;

// 브라우저가 필요한 파일만 내보낸다. 서버 스크립트, package.json, 문서, 단위 테스트는 노출하지 않는다.
const ALLOWED_TOP = new Set(['index.html', 'css', 'js', 'tests']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

// 요청 URL 을 root 안의 파일 경로로 바꾼다. 서빙하면 안 되는 경로는 null.
export function resolveRequestPath(root, requestUrl) {
  const raw = String(requestUrl).split(/[?#]/)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;

  const segments = decoded.replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments.some((s) => s.startsWith('.'))) return null; // ".." 와 숨김 파일(.git, .env 등)
  if (segments.length === 0) segments.push('index.html');

  const [top, second] = segments;
  if (!ALLOWED_TOP.has(top)) return null;
  if (top === 'index.html' && segments.length !== 1) return null;
  if (top === 'tests' && second !== 'browser') return null; // 단위 테스트는 노출하지 않고 브라우저 테스트 페이지만

  const rootDir = path.resolve(root);
  const resolved = path.join(rootDir, ...segments);
  return resolved.startsWith(rootDir + path.sep) ? resolved : null;
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

export function createServer(root) {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }
    const file = resolveRequestPath(root, req.url ?? '/');
    if (!file) {
      notFound(res);
      return;
    }
    fs.stat(file, (statError, stat) => {
      const target = !statError && stat.isDirectory() ? path.join(file, 'index.html') : file;
      fs.stat(target, (error, info) => {
        if (error || !info.isFile()) {
          notFound(res);
          return;
        }
        res.writeHead(200, {
          'Content-Type': mimeFor(target),
          'Content-Length': info.size,
          'Cache-Control': 'no-store', // 코드를 고친 뒤 새로고침하면 바로 반영되게
        });
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        const stream = fs.createReadStream(target);
        stream.on('error', () => res.destroy());
        stream.pipe(res);
      });
    });
  });
}

function parseArgs(argv) {
  const options = { port: DEFAULT_PORT, open: true, help: false };
  for (const arg of argv) {
    if (arg === '--no-open') options.open = false;
    else if (arg === '-h' || arg === '--help') options.help = true;
    else if (/^\d+$/.test(arg) && Number(arg) <= 65535) options.port = Number(arg);
    else throw new Error(`알 수 없는 인자: ${arg}`);
  }
  return options;
}

// 포트가 사용 중이면 다음 포트로 넘어가며 최대 PORT_TRIES 번 시도한다. 실제 포트를 반환한다.
async function listenOnFreePort(server, startPort) {
  for (let port = startPort; port < startPort + PORT_TRIES; port += 1) {
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          server.off('error', reject);
          resolve();
        });
      });
      return port;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error(`${startPort}~${startPort + PORT_TRIES - 1} 포트가 모두 사용 중입니다.`);
}

function openBrowser(url) {
  const [command, args] = {
    darwin: ['open', [url]],
    win32: ['cmd', ['/c', 'start', '', url]],
  }[process.platform] ?? ['xdg-open', [url]];
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {}); // 브라우저를 못 열어도 서버는 계속 동작한다 (주소는 출력된다)
    child.unref();
  } catch {
    // 위와 같다
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  if (options.help) {
    console.log('사용법: node serve.js [포트] [--no-open]\n  포트: 기본 8000 (사용 중이면 다음 포트를 시도)\n  --no-open: 브라우저를 자동으로 열지 않음');
    return;
  }

  const root = path.dirname(fileURLToPath(import.meta.url));
  const server = createServer(root);
  let port;
  try {
    port = await listenOnFreePort(server, options.port);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const url = `http://localhost:${port}`;
  console.log(`Focus & Grass 실행 중: ${url}`);
  console.log('종료하려면 Ctrl+C 를 누르세요.');
  if (port !== options.port) {
    console.log(`(${options.port} 포트가 사용 중이어서 ${port} 포트로 열었습니다. 포트가 바뀌면 브라우저 저장소(기록)도 따로 보입니다.)`);
  }
  if (options.open) openBrowser(url);

  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  });
}

// `node serve.js` 로 직접 실행했을 때만 서버를 띄운다 (테스트에서 import 할 때는 띄우지 않는다)
const isEntry = process.argv[1]
  && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isEntry) main();
