import { readFile } from 'node:fs/promises';
export default async function teardown() {
  // Terminate only this run's server. Avoid Windows process-tree cleanup delays.
  try {
    const pid = Number(await readFile(process.env.AUDIOLAB_TEST_PID, 'utf8'));
    if (Number.isInteger(pid) && pid > 0) process.kill(pid);
  } catch (error) {
    if (!['ESRCH', 'ENOENT'].includes(error.code)) throw error;
  }
}
