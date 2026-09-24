import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
await mkdir(path.dirname(process.env.AUDIOLAB_TEST_PID), { recursive: true });
await writeFile(process.env.AUDIOLAB_TEST_PID, String(process.pid));
await import('../server/server.mjs');
