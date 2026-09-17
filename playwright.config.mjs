import { defineConfig } from '@playwright/test';
import path from 'node:path';
const run = Date.now();
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
process.env.AUDIOLAB_TEST_PID = path.resolve(`test-results/server-${run}.pid`);
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.mjs', workers: 1, timeout: 60000,
  globalTeardown: './tests/browser-teardown.mjs',
  use: { baseURL: 'http://127.0.0.1:4174', channel: 'msedge', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node tests/browser-server.mjs', url: 'http://127.0.0.1:4174/api/status', env: { PORT: '4174', DATABASE_URL: testDatabaseUrl, AUDIOLAB_TEST_PID: process.env.AUDIOLAB_TEST_PID }, reuseExistingServer: false, timeout: 20000 },
});
