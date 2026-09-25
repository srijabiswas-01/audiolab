import { sql } from './db.mjs';

const cleanProject = project => ({
  id: project.id,
  name: project.name,
  filename: project.filename,
  size: Number(project.size),
  duration: Number(project.duration),
  transcript: project.transcript,
  settings: project.settings,
  createdAt: Number(project.created_at),
  updatedAt: Number(project.updated_at),
  chunks: project.expected_chunks
});

export async function handleProjectApi(req, res, url, user, jsonBody, send, fail) {
  if (!url.pathname.startsWith('/api/projects')) return false;
  if (!user || user.status !== 'active') fail('Sign in to synchronize projects.', 401);

  if (req.method === 'GET' && url.pathname === '/api/projects') {
    const projects = await sql`SELECT * FROM projects WHERE user_id = ${user.id} AND complete = TRUE ORDER BY updated_at DESC`;
    const deleted = await sql`SELECT project_id AS id, deleted_at FROM project_tombstones WHERE user_id = ${user.id}`;
    send(res, 200, { projects: projects.map(cleanProject), deleted: deleted.map(item => ({ id: item.id, deletedAt: Number(item.deleted_at) })) });
    return true;
  }

  const chunkMatch = /^\/api\/projects\/([^/]+)\/chunks\/(\d+)$/.exec(url.pathname);
  if (req.method === 'GET' && chunkMatch) {
    const [, id, index] = chunkMatch;
    const [chunk] = await sql`SELECT project_chunks.data FROM project_chunks JOIN projects ON projects.id = project_chunks.project_id WHERE project_chunks.project_id = ${id} AND project_chunks.chunk_index = ${Number(index)} AND projects.user_id = ${user.id}`;
    if (!chunk) fail('Project audio chunk not found.', 404);
    send(res, 200, { data: chunk.data });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/projects') {
    const body = await jsonBody(req);
    const id = String(body.id || '');
    const name = String(body.name || '').trim();
    const filename = String(body.filename || '').trim();
    const size = Number(body.size);
    const duration = Number(body.duration);
    const createdAt = Number(body.createdAt);
    const updatedAt = Number(body.updatedAt);
    const expectedChunks = Number(body.chunks);
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(id) || !name || name.length > 180 || !filename || filename.length > 255) fail('Invalid project details.');
    if (!Number.isSafeInteger(size) || size < 1 || size > 100 * 1024 ** 2 || !Number.isFinite(duration) || duration <= 0 || duration > 600) fail('Invalid project audio.');
    if (!Number.isSafeInteger(createdAt) || !Number.isSafeInteger(updatedAt) || !Number.isInteger(expectedChunks) || expectedChunks < 1 || expectedChunks > 256) fail('Invalid project synchronization data.');
    const settings = Array.isArray(body.settings) ? body.settings : [];
    const transcript = String(body.transcript || '').slice(0, 1_000_000);
    const reset = body.resetChunks === true;
    const [existing] = await sql`SELECT user_id FROM projects WHERE id = ${id}`;
    if (existing && existing.user_id !== user.id) fail('Project ID is already in use.', 409);
    if (!existing && !reset) fail('Project audio must be uploaded before its settings can synchronize.', 409);
    await sql`INSERT INTO projects (id, user_id, name, filename, size, duration, transcript, settings, created_at, updated_at, expected_chunks, complete)
      VALUES (${id}, ${user.id}, ${name}, ${filename}, ${size}, ${duration}, ${transcript}, ${JSON.stringify(settings)}, ${createdAt}, ${updatedAt}, ${expectedChunks}, ${!reset})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, filename = EXCLUDED.filename, size = EXCLUDED.size, duration = EXCLUDED.duration, transcript = EXCLUDED.transcript, settings = EXCLUDED.settings, updated_at = EXCLUDED.updated_at, expected_chunks = EXCLUDED.expected_chunks, complete = CASE WHEN ${reset} THEN FALSE ELSE projects.complete END
      WHERE projects.user_id = ${user.id}`;
    if (reset) await sql`DELETE FROM project_chunks WHERE project_id = ${id}`;
    await sql`DELETE FROM project_tombstones WHERE project_id = ${id} AND user_id = ${user.id}`;
    send(res, 200, { ok: true });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/projects/chunk') {
    const { id, index, data } = await jsonBody(req);
    const numericIndex = Number(index);
    if (typeof data !== 'string' || data.length > 750_000 || !Number.isInteger(numericIndex) || numericIndex < 0) fail('Invalid audio chunk.');
    const [project] = await sql`SELECT expected_chunks FROM projects WHERE id = ${String(id)} AND user_id = ${user.id}`;
    if (!project || numericIndex >= project.expected_chunks) fail('Project not found.', 404);
    await sql`INSERT INTO project_chunks (project_id, chunk_index, data) VALUES (${String(id)}, ${numericIndex}, ${data}) ON CONFLICT (project_id, chunk_index) DO UPDATE SET data = EXCLUDED.data`;
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM project_chunks WHERE project_id = ${String(id)}`;
    if (count === project.expected_chunks) await sql`UPDATE projects SET complete = TRUE WHERE id = ${String(id)} AND user_id = ${user.id}`;
    send(res, 200, { ok: true, complete: count === project.expected_chunks });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/projects/delete') {
    const { id } = await jsonBody(req);
    const projectId = String(id);
    await sql`INSERT INTO project_tombstones (project_id, user_id, deleted_at) VALUES (${projectId}, ${user.id}, ${Date.now()}) ON CONFLICT (project_id, user_id) DO UPDATE SET deleted_at = EXCLUDED.deleted_at`;
    await sql`DELETE FROM projects WHERE id = ${projectId} AND user_id = ${user.id}`;
    send(res, 200, { ok: true });
    return true;
  }

  fail('Endpoint not found.', 404);
}

export async function handleExportApi(req, res, url, user, jsonBody, send, fail) {
  if (!url.pathname.startsWith('/api/exports')) return false;
  if (!user || user.status !== 'active') fail('Sign in to access exports.', 401);

  if (req.method === 'GET' && url.pathname === '/api/exports') {
    const exports = await sql`SELECT id, project_id, name, size, created_at, expected_chunks FROM exports WHERE user_id = ${user.id} AND complete = TRUE ORDER BY created_at DESC`;
    send(res, 200, { exports: exports.map(item => ({ id:item.id, projectId:item.project_id, name:item.name, size:Number(item.size), createdAt:Number(item.created_at), chunks:item.expected_chunks })) });
    return true;
  }
  const chunkMatch = /^\/api\/exports\/([^/]+)\/chunks\/(\d+)$/.exec(url.pathname);
  if (req.method === 'GET' && chunkMatch) {
    const [, id, index] = chunkMatch;
    const [chunk] = await sql`SELECT export_chunks.data FROM export_chunks JOIN exports ON exports.id = export_chunks.export_id WHERE export_chunks.export_id = ${id} AND export_chunks.chunk_index = ${Number(index)} AND exports.user_id = ${user.id}`;
    if (!chunk) fail('Export chunk not found.', 404);
    send(res, 200, { data:chunk.data });
    return true;
  }
  if (req.method === 'POST' && url.pathname === '/api/exports') {
    const body = await jsonBody(req), id = String(body.id||''), name = String(body.name||'').trim();
    const size=Number(body.size), createdAt=Number(body.createdAt), chunks=Number(body.chunks), projectId=body.projectId?String(body.projectId):null;
    if(!/^[a-zA-Z0-9-]{16,64}$/.test(id)||!name||name.length>180||!Number.isSafeInteger(size)||size<1||size>100*1024**2||!Number.isSafeInteger(createdAt)||!Number.isInteger(chunks)||chunks<1||chunks>256) fail('Invalid export details.');
    const [existing]=await sql`SELECT user_id FROM exports WHERE id=${id}`;
    if(existing&&existing.user_id!==user.id) fail('Export ID is already in use.',409);
    await sql`INSERT INTO exports (id,user_id,project_id,name,size,created_at,expected_chunks,complete) VALUES (${id},${user.id},${projectId},${name},${size},${createdAt},${chunks},FALSE) ON CONFLICT (id) DO UPDATE SET project_id=EXCLUDED.project_id,name=EXCLUDED.name,size=EXCLUDED.size,created_at=EXCLUDED.created_at,expected_chunks=EXCLUDED.expected_chunks,complete=FALSE WHERE exports.user_id=${user.id}`;
    await sql`DELETE FROM export_chunks WHERE export_id=${id}`;
    send(res,200,{ok:true}); return true;
  }
  if(req.method==='POST'&&url.pathname==='/api/exports/chunk') {
    const {id,index,data}=await jsonBody(req), numericIndex=Number(index);
    if(typeof data!=='string'||data.length>750000||!Number.isInteger(numericIndex)||numericIndex<0) fail('Invalid export chunk.');
    const [item]=await sql`SELECT expected_chunks FROM exports WHERE id=${String(id)} AND user_id=${user.id}`;
    if(!item||numericIndex>=item.expected_chunks) fail('Export not found.',404);
    await sql`INSERT INTO export_chunks (export_id,chunk_index,data) VALUES (${String(id)},${numericIndex},${data}) ON CONFLICT (export_id,chunk_index) DO UPDATE SET data=EXCLUDED.data`;
    const [{count}]=await sql`SELECT count(*)::int AS count FROM export_chunks WHERE export_id=${String(id)}`;
    if(count===item.expected_chunks) await sql`UPDATE exports SET complete=TRUE WHERE id=${String(id)} AND user_id=${user.id}`;
    send(res,200,{ok:true,complete:count===item.expected_chunks}); return true;
  }
  if(req.method==='POST'&&url.pathname==='/api/exports/delete') {
    const {id}=await jsonBody(req); await sql`DELETE FROM exports WHERE id=${String(id)} AND user_id=${user.id}`; send(res,200,{ok:true}); return true;
  }
  fail('Endpoint not found.',404);
}
