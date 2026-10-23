'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const BACKEND = String(process.env.BACKEND_URL || '').trim().replace(/\/+$/, '');
const API_TOKEN = String(process.env.BACKEND_API_KEY || '').trim();
const sessionsFile = process.env.SESSIONS_FILE || path.join(__dirname, 'data', 'sessions.json');
fs.mkdirSync(path.dirname(sessionsFile), { recursive: true });

function readSessions() {
  try { const data = JSON.parse(fs.readFileSync(sessionsFile, 'utf8')); return Array.isArray(data) ? data : []; }
  catch { return []; }
}
function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '', finished = false;
    req.on('data', chunk => {
      if (finished) return;
      data += chunk;
      if (Buffer.byteLength(data) > limit) { finished = true; reject(new Error('Solicitud demasiado grande')); req.destroy(); }
    });
    req.on('end', () => {
      if (finished) return;
      try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}
async function proxyToBackend(req, res, pathname) {
  if (!BACKEND) return send(res, 503, { error: 'Falta configurar BACKEND_URL con la URL pública del backend Python desplegado en Render.' });
  try {
    const opts = { method: req.method, headers: { Accept: 'application/json' } };
    if (API_TOKEN) opts.headers['X-API-Key'] = API_TOKEN;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const body = await readBody(req);
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const upstream = await fetch(`${BACKEND}${pathname}`, { ...opts, signal: AbortSignal.timeout(10 * 60 * 1000) });
    const raw = await upstream.text();
    let payload;
    try { payload = raw ? JSON.parse(raw) : {}; }
    catch { payload = { error: `El backend respondió con un formato no JSON (HTTP ${upstream.status}).`, detail: raw.slice(0, 500) }; }
    return send(res, upstream.status, payload);
  } catch (err) {
    const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return send(res, timeout ? 504 : 502, {
      error: timeout ? 'El backend agotó el tiempo de espera del backtest.' : 'No se pudo conectar con el backend Python. Comprueba BACKEND_URL y que el servicio de Render esté disponible.',
      detail: err.message
    });
  }
}
function saveSessions(items) { fs.writeFileSync(sessionsFile, JSON.stringify(items, null, 2)); }

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (pathname === '/healthz' && req.method === 'GET') return send(res, 200, { ok: true, service: 'backtest-lab-frontend' });
  if ((pathname === '/api/backtest' || pathname === '/api/health') && ['GET', 'POST', 'HEAD'].includes(req.method)) {
    return proxyToBackend(req, res, pathname + url.search);
  }
  if (pathname === '/api/sessions' && req.method === 'GET') return send(res, 200, { sessions: readSessions() });
  if (pathname === '/api/sessions' && req.method === 'POST') {
    try {
      const d = await readBody(req);
      const all = readSessions();
      const item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name: String(d.name || 'Sesión sin título').slice(0, 100), createdAt: new Date().toISOString(), config: d.config || {}, result: d.result || null };
      all.unshift(item); saveSessions(all.slice(0, 100));
      return send(res, 201, { session: item });
    } catch (e) { return send(res, 400, { error: e.message }); }
  }
  const match = pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (match && req.method === 'DELETE') {
    try { saveSessions(readSessions().filter(x => x.id !== decodeURIComponent(match[1]))); return send(res, 200, { ok: true }); }
    catch (e) { return send(res, 500, { error: 'No se pudo actualizar el historial de sesiones.', detail: e.message }); }
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Método no permitido' });

  const requested = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const full = path.resolve(root, '.' + requested);
  if (!full.startsWith(root + path.sep) && full !== path.join(root, 'index.html')) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(full, (err, content) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    const ext = path.extname(full);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') return res.end();
    res.end(content);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Backtest Lab frontend escuchando en puerto ${PORT}`);
  console.log(`Backend Python: ${BACKEND || 'NO CONFIGURADO (define BACKEND_URL)'}`);
});
