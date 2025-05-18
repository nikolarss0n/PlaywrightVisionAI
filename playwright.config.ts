import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './',
  timeout: 30000,
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries to keep test output clean
  workers: 1,  // Single worker for predictable runs
  reporter: 'html',
  use: {
    headless: false, // Run in headed mode for testing
    trace: 'on',    // Capture traces for all test runs
    screenshot: 'on', // Take screenshots on failure
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 }
    }, // Record video for all tests with specific size
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    }
  ],
});