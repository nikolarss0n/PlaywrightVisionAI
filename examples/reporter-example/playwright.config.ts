import { defineConfig, devices } from '@playwright/test';
import path from 'path';

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
    baseURL: 'https://jsonplaceholder.typicode.com',
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
  ]
});