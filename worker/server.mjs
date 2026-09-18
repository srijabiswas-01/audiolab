import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const port = Number(process.env.PORT || 8080);
const secret = process.env.YOUTUBE_WORKER_SECRET;
const allowedOrigin = process.env.ALLOWED_ORIGIN;
const usedTickets = new Map();
if (!secret || !allowedOrigin) throw new Error('YOUTUBE_WORKER_SECRET and ALLOWED_ORIGIN are required.');

function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
function extractorMessage(stderr) {
  const detail = String(stderr).split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('[debug]')).slice(-2).join(' ');
  return detail ? `Could not import this YouTube video: ${detail.slice(0, 500)}` : 'Could not import this YouTube video.';
}
function validToken(value) {
  const [payload, signature] = String(value || '').split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const received = Buffer.from(signature); const expectedBuffer = Buffer.from(expected);
  if (received.length !== expectedBuffer.length || !timingSafeEqual(received, expectedBuffer)) return null;
  try { const ticket = JSON.parse(Buffer.from(payload, 'base64url')); return ticket.exp > Date.now() && typeof ticket.url === 'string' ? ticket : null; } catch { return null; }
}
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-m', 'yt_dlp', ...args], { shell: false }); let stderr = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Object.assign(new Error('Import timed out.'), { status: 504 })); }, 120000);
    child.stdout.resume(); child.stderr.on('data', part => { stderr += part; });
    child.on('error', error => { clearTimeout(timer); reject(Object.assign(new Error(error.code === 'ENOENT' ? 'Python is unavailable in the import worker.' : 'The import worker is unavailable.'), { status: 503 })); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(Object.assign(new Error(stderr.includes('duration') ? 'Choose a video no longer than 10 minutes.' : extractorMessage(stderr)), { status: 422 })); });
  });
}
async function audioFromYouTube(url) {
  const directory = await mkdtemp(path.join(tmpdir(), 'audiolab-'));
  try {
    await run(['--no-playlist', '--no-progress', '--js-runtimes', 'node', '--remote-components', 'ejs:github', '--format', 'bestaudio/best', '--extract-audio', '--audio-format', 'wav', '--max-filesize', '100M', '--match-filter', 'duration <= 600', '--output', path.join(directory, '%(id)s.%(ext)s'), url]);
    const filename = (await readdir(directory)).find(file => file.toLowerCase().endsWith('.wav'));
    if (!filename) fail('No compatible audio was produced.', 422);
    const file = path.join(directory, filename); if ((await stat(file)).size > 100 * 1024 ** 2) fail('The converted file is larger than 100 MB.', 422);
    return { directory, file, filename: filename.replace(/[^a-zA-Z0-9._ -]/g, '_') };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}

http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin === allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') { res.writeHead(origin === allowedOrigin ? 204 : 403, { 'Access-Control-Allow-Headers': 'Authorization', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '300' }); return res.end(); }
  try {
    if (req.method === 'GET' && new URL(req.url, 'http://localhost').pathname === '/health') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end('{"ok":true}'); }
    if (req.method !== 'GET' || new URL(req.url, 'http://localhost').pathname !== '/youtube') fail('Not found.', 404);
    if (origin !== allowedOrigin) fail('Origin rejected.', 403);
    const rawTicket = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1]; const ticket = validToken(rawTicket); if (!ticket) fail('Import ticket is invalid or expired.', 401);
    for (const [nonce, expiry] of usedTickets) if (expiry <= Date.now()) usedTickets.delete(nonce);
    if (usedTickets.has(ticket.nonce)) fail('This import ticket was already used.', 409); usedTickets.set(ticket.nonce, ticket.exp);
    const output = await audioFromYouTube(ticket.url);
    try { const audio = await readFile(output.file); res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': audio.length, 'Content-Disposition': `attachment; filename="${output.filename}"`, 'Cache-Control': 'no-store' }); res.end(audio); }
    finally { await rm(output.directory, { recursive: true, force: true }); }
  } catch (error) { send(res, error.status || 500, { error: error.status ? error.message : 'Import failed.' }); }
}).listen(port, '0.0.0.0', () => console.log(`AudioLab worker listening on ${port}`));
