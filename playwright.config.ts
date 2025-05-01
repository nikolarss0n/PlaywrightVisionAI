import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './',
  timeout: 30000,
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries to keep test output clean
  workers: 1,  // Single worker for predictable runs
  reporter: 'html',
  use: {
    headless: true, // Run in headless mode by default
    trace: 'on',    // Capture traces for all test runs
    screenshot: 'on', // Take screenshots on failure
    video: 'on', // Always record videos to help with debugging
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    }
  ],
});