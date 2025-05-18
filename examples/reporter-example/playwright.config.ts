import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration 
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  
  // Configure Playwright 
  use: {
    baseURL: 'https://playwright.dev',
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'on',
  },
  
  // Projects configuration
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  
  // Longer timeout to allow AI analysis to complete
  // Test timeout allows plenty of time for AI analysis to complete
  timeout: 60000,
  
  // Configure expectations - locator wait timeout is 15 seconds
  expect: {
    timeout: 15000
  },
});