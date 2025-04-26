/**
 * Example of integrating Playwright Vision AI Debugger with a complex test setup
 * that uses custom fixtures and page objects.
 */
import { test as baseTest } from '@playwright/test';
import { setupAiDebugging } from 'playwright-vision-ai-debugger';
import dotenv from 'dotenv';

// Load environment variables for AI API access
dotenv.config();

// Method 1: Using afterEach hook (compatible with most setups)
export function setupAiDebuggingWithAfterEach(testObject: any) {
  testObject.afterEach(async ({ page, customPage }, testInfo) => {
    // Only run AI debugging for failed tests
    if (testInfo.status === 'failed' && testInfo.error) {
      try {
        // Convert the error to ensure it has the right properties
        const error = testInfo.error instanceof Error
          ? testInfo.error
          : new Error(String(testInfo.error));
        
        // Use whichever page object is available (custom or standard)
        const pageToUse = customPage || page;
        
        // Import the function directly to avoid issues with the setupAiDebugging wrapper
        const { runAiDebuggingAnalysis } = require('playwright-vision-ai-debugger');
        
        // Run the AI debugging analysis
        await runAiDebuggingAnalysis(pageToUse, testInfo, error);
      } catch (e) {
        console.error('Error in AI debugging:', e);
      }
    }
  });
  
  return testObject;
}

// Method 2: Direct integration with the enhanced setupAiDebugging function
// This method should work for most complex setups as of version 1.2.2+
export const test = setupAiDebugging(baseTest);

// Export expect for convenience
export { expect } from '@playwright/test';

/**
 * Example usage in your test file:
 * 
 * // Option 1: Using the pre-configured test object
 * import { test, expect } from './path/to/this/file';
 * 
 * test('your test', async ({ page }) => {
 *   // Your test code here
 * });
 * 
 * // Option 2: Using the setupAiDebuggingWithAfterEach function with your existing test object
 * import { test as baseTest } from './your-existing-test-setup';
 * import { setupAiDebuggingWithAfterEach } from './path/to/this/file';
 * 
 * // Enhance your existing test object with AI debugging
 * const test = setupAiDebuggingWithAfterEach(baseTest);
 * 
 * test('your test', async ({ page, customPage, ...otherFixtures }) => {
 *   // Your test code here will have AI debugging on failure
 * });
 */