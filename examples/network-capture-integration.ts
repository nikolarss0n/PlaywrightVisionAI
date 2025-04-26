/**
 * Example of how to integrate network request capturing in a complex test setup
 */
import { test as baseTest } from '@playwright/test';
import { setupNetworkCapture } from 'playwright-vision-ai-debugger';
import dotenv from 'dotenv';

// Load environment variables for AI API access
dotenv.config();

// Store network requests for each test
const testNetworkRequests = new Map<string, any[]>();
const testNetworkCaptureTeardowns = new Map<string, Function>();

// Create a beforeEach hook to set up network capturing for each test
export function setupNetworkCaptureIntegration(testObject: any) {
  // Set up network capture at the beginning of each test
  testObject.beforeEach(async ({ page, customPage }, testInfo) => {
    // Use whichever page object is available (customPage or standard page)
    const pageToUse = customPage || page;
    
    if (pageToUse) {
      console.log(`Setting up network capture for test: ${testInfo.title}`);
      
      // Set up network capture for this test
      const { networkRequests, teardown } = setupNetworkCapture(pageToUse);
      
      // Store the network requests array and teardown function using the test ID as key
      testNetworkRequests.set(testInfo.testId, networkRequests);
      testNetworkCaptureTeardowns.set(testInfo.testId, teardown);
    }
  });

  // Clean up network capture after each test
  testObject.afterEach(async ({ page, customPage }, testInfo) => {
    // Call teardown to remove listeners
    const teardown = testNetworkCaptureTeardowns.get(testInfo.testId);
    if (teardown) {
      teardown();
      testNetworkCaptureTeardowns.delete(testInfo.testId);
      console.log(`Cleaned up network capture for test: ${testInfo.title}`);
    }
    
    // If the test failed, run AI debugging with the captured network requests
    if (testInfo.status === 'failed' && testInfo.error) {
      try {
        // Use whichever page object is available
        const pageToUse = customPage || page;
        
        if (pageToUse) {
          // Get the captured network requests for this test
          const networkRequests = testNetworkRequests.get(testInfo.testId) || [];
          
          // Convert the error to ensure it has the right properties
          const error = testInfo.error instanceof Error
            ? testInfo.error
            : new Error(String(testInfo.error));
          
          // Import core functions directly
          const { runAiDebuggingAnalysis } = require('playwright-vision-ai-debugger');
          
          // Call AI debugging with the network requests
          // The network requests are already captured, but we'll pass the reference to ensure they're included
          await runAiDebuggingAnalysis(pageToUse, testInfo, error);
        }
      } catch (e) {
        console.error('Error in AI debugging:', e);
      }
    }
    
    // Clean up the stored network requests
    testNetworkRequests.delete(testInfo.testId);
  });
  
  return testObject;
}

// Example usage:
// const test = setupNetworkCaptureIntegration(baseTest);
// export { test };