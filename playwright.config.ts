import { defineConfig, devices } from '@playwright/test';
import './infrastructure/scripts/windows-path.mjs';

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Launch Vite directly so Windows teardown does not leave a pnpm child running.
    command:
      'node node_modules/vite/bin/vite.js apps/web --config apps/web/vite.config.ts --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_BASE_URL: 'http://127.0.0.1:3000' },
  },
});
