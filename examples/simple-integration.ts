/**
 * Example of the elegant one-line integration for Playwright Vision AI Debugger
 */
import { test as baseTest } from '@playwright/test';
import { enhanceTestWithAiDebugging } from 'playwright-vision-ai-debugger';
import dotenv from 'dotenv';

// Load environment variables for API access
dotenv.config();

// Enhance your test with AI debugging and network capture in ONE LINE
export const test = enhanceTestWithAiDebugging(baseTest, {
  // Optional configuration (all settings below are the default values):
  runOnlyOnFailure: true,      // Only run AI debugging on test failures
  customPageProperty: 'customPage',  // Use this property if you have a custom page object
  includeNetworkCapture: true  // Automatically capture network requests
});

// Re-export everything else from Playwright
export { expect } from '@playwright/test';

// That's it! Now use this test object in your test files just like the regular Playwright test.
// import { test, expect } from './simple-integration';
//
// test('my awesome test', async ({ page }) => {
//   // Your test code here...
// });