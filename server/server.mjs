import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sql, initializeDatabase } from './db.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(root, '../public');
await initializeDatabase();
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const assets = new Set(['/index.html', '/styles.css', '/theme.css', '/theme.js', '/loader.css', '/bootstrap.js', '/app.js', '/audio.js', '/favicon.svg']);
const attempts = new Map();
const cleanUser = u => u && ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status });
const hash = (password, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const check = (password, stored) => { const [salt, value] = stored.split(':'); return timingSafeEqual(Buffer.from(hash(password, salt).split(':')[1], 'hex'), Buffer.from(value, 'hex')); };
const cookieToken = req => /(?:^|;\s*)studio_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
async function current(req) {
  const [user] = await sql`SELECT users.* FROM users JOIN sessions ON users.id = sessions.user_id WHERE sessions.token = ${cookieToken(req) || ''} AND sessions.expires > ${Date.now()}`;
  return user;
}
async function jsonBody(req) {
  let body = '';
  for await (const part of req) { body += part; if (body.length > 16384) throw Object.assign(new Error('Request too large.'), { status: 413 }); }
  try { return JSON.parse(body || '{}'); } catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
}
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function send(res, status, value, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(value)); }
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(req.method)) {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) fail('Cross-origin request rejected.', 403);
        if (!req.headers['content-type']?.startsWith('application/json')) fail('JSON content type required.', 415);
      }
      if (req.method === 'GET' && url.pathname === '/api/status') {
        const [{ n }] = await sql`SELECT count(*)::int AS n FROM users`;
        return send(res, 200, { setupRequired: n === 0, user: cleanUser(await current(req)) || null, capabilities: { localAudio: true, wavExport: true, separation: false, transcription: false } });
      }
      if (req.method === 'POST' && ['/api/register', '/api/login'].includes(url.pathname)) {
        const key = req.socket.remoteAddress;
        let attempt = attempts.get(key);
        if (!attempt || attempt.until < Date.now()) { attempt = { count: 0, until: Date.now() + 60000 }; attempts.set(key, attempt); }
        if (++attempt.count > 15) fail('Too many attempts. Please try again in a minute.', 429);
        const body = await jsonBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fail('Enter a valid email address.');
        if (password.length < 10 || password.length > 128) fail('Use a password between 10 and 128 characters.');
        let user;
        if (url.pathname === '/api/register') {
          const name = String(body.name || '').trim();
          if (!name || name.length > 80) fail('Enter a name of up to 80 characters.');
          if ((await sql`SELECT id FROM users WHERE email = ${email}`)[0]) fail('An account with this email already exists.', 409);
          const [{ n }] = await sql`SELECT count(*)::int AS n FROM users`;
          const first = n === 0;
          if (first && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) fail('Create the first administrator from this computer.', 403);
          const id = randomBytes(16).toString('hex');
          await sql`INSERT INTO users (id, name, email, password, role, status, created_at) VALUES (${id}, ${name}, ${email}, ${hash(password)}, ${first ? 'admin' : 'user'}, ${first ? 'active' : 'pending'}, ${new Date().toISOString()})`;
          [user] = await sql`SELECT * FROM users WHERE id = ${id}`;
          if (!first) return send(res, 201, { pending: true, message: 'Account created. An administrator needs to approve it before you can sign in.' });
        } else {
          [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
          if (!user || !check(password, user.password)) fail('Email or password is incorrect.', 401);
          if (user.status !== 'active') fail(user.status === 'pending' ? 'Your account is waiting for administrator approval.' : 'Your account is not active. Contact your administrator.', 403);
        }
        const token = randomBytes(32).toString('hex');
        await sql`DELETE FROM sessions WHERE expires < ${Date.now()}`;
        await sql`INSERT INTO sessions (token, user_id, expires) VALUES (${token}, ${user.id}, ${Date.now() + 86400000})`;
        return send(res, 200, { user: cleanUser(user) }, { 'Set-Cookie': `studio_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}` });
      }
      if (req.method === 'POST' && url.pathname === '/api/logout') {
        await sql`DELETE FROM sessions WHERE token = ${cookieToken(req) || ''}`;
        return send(res, 200, { ok: true }, { 'Set-Cookie': 'studio_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
      }
      if (url.pathname.startsWith('/api/admin/')) {
        const user = await current(req);
        if (!user || user.status !== 'active') fail('Sign in to continue.', 401);
        if (user.role !== 'admin') fail('Administrator access required.', 403);
        if (req.method === 'GET' && url.pathname === '/api/admin/users') return send(res, 200, { users: (await sql`SELECT * FROM users ORDER BY created_at DESC`).map(cleanUser) });
        if (req.method === 'POST' && url.pathname === '/api/admin/users') {
          const { id, status } = await jsonBody(req);
          if (!['active', 'rejected', 'suspended'].includes(status)) fail('Invalid account status.');
          const [target] = await sql`SELECT * FROM users WHERE id = ${String(id)}`;
          if (!target) fail('Account not found.', 404);
          if (target.role === 'admin') fail('Administrator status cannot be changed here.');
          await sql`UPDATE users SET status = ${status} WHERE id = ${String(id)}`;
          await sql`DELETE FROM sessions WHERE user_id = ${String(id)}`;
          await sql`INSERT INTO audit (actor, target, action, created_at) VALUES (${user.id}, ${String(id)}, ${status}, ${new Date().toISOString()})`;
          return send(res, 200, { ok: true });
        }
      }
      fail('Endpoint not found.', 404);
    }
    if (!['GET', 'HEAD'].includes(req.method)) fail('Method not allowed.', 405);
    const file = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!assets.has(file)) fail('Not found.', 404);
    const buffer = await readFile(path.join(publicRoot, file));
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : buffer);
  } catch (error) { send(res, error.status || 500, { error: error.status ? error.message : 'Something went wrong. Please try again.' }); }
});
server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\nAudioLab could not start: ${host}:${port} is already in use.`);
    console.error('An AudioLab instance may already be running. Open its address, or stop it with Ctrl+C in its terminal.');
    console.error('Run either "npm run dev" or "npm start", not both at the same time.');
    console.error(`To use another port in PowerShell:\n  $env:PORT = '${port + 1}'\n  npm run dev\n`);
  } else {
    console.error(`AudioLab could not start: ${error.message}`);
  }
  process.exitCode = 1;
});
server.listen(port, host, () => console.log(`AudioLab is ready at http://${host}:${server.address().port}`));
