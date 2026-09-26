import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { sql, initializeDatabase } from '../server/db.mjs';
import { handleExportApi, handleProjectApi } from '../server/project-api.mjs';

await initializeDatabase();

const attempts = new Map();
const cleanUser = user => user && ({ id: user.id, name: user.name, email: user.email, role: user.role, status: user.status });
const hash = (password, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const check = (password, stored) => {
  const [salt, value] = stored.split(':');
  return timingSafeEqual(Buffer.from(hash(password, salt).split(':')[1], 'hex'), Buffer.from(value, 'hex'));
};
const cookieToken = req => /(?:^|;\s*)studio_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
async function current(req) {
  const [user] = await sql`SELECT users.* FROM users JOIN sessions ON users.id = sessions.user_id WHERE sessions.token = ${cookieToken(req) || ''} AND sessions.expires > ${Date.now()}`;
  return user;
}

async function jsonBody(req) {
  let body = '';
  for await (const part of req) {
    body += part;
    if (body.length > 800000) fail('Request too large.', 413);
  }
  try { return JSON.parse(body || '{}'); } catch { fail('Invalid JSON.', 400); }
}

function send(res, status, value, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(value));
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  try {
    const url = new URL(req.url, 'https://localhost');
    const routedPath = url.searchParams.get('__path');
    if (routedPath) url.pathname = `/api/${routedPath.replace(/^\/+/, '')}`;
    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) fail('Cross-origin request rejected.', 403);
      if (!req.headers['content-type']?.startsWith('application/json')) fail('JSON content type required.', 415);
    }
    if (req.method === 'GET' && url.pathname === '/api/status') {
      const [{ n }] = await sql`SELECT count(*)::int AS n FROM users`;
      return send(res, 200, { setupRequired: n === 0, user: cleanUser(await current(req)) || null, capabilities: { localAudio: true, cloudProjects: true, cloudExports: true, wavExport: true, separation: false, transcription: false } });
    }
    if (req.method === 'POST' && ['/api/register', '/api/login'].includes(url.pathname)) {
      const key = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
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
        const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
        if (first && !local && process.env.ALLOW_FIRST_ADMIN_SIGNUP !== 'true') fail('First-admin setup is disabled. Set ALLOW_FIRST_ADMIN_SIGNUP=true briefly to create the first administrator.', 403);
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
      return send(res, 200, { user: cleanUser(user) }, { 'Set-Cookie': `studio_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400; Secure` });
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      await sql`DELETE FROM sessions WHERE token = ${cookieToken(req) || ''}`;
      return send(res, 200, { ok: true }, { 'Set-Cookie': 'studio_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure' });
    }
    if (url.pathname.startsWith('/api/projects')) {
      await handleProjectApi(req, res, url, await current(req), jsonBody, send, fail);
      return;
    }
    if (url.pathname.startsWith('/api/exports')) {
      await handleExportApi(req, res, url, await current(req), jsonBody, send, fail);
      return;
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
  } catch (error) {
    send(res, error.status || 500, { error: error.status ? error.message : 'Something went wrong. Please try again.' });
  }
}
