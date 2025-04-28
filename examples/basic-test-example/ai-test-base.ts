/**
 * Simple AI debugging test base
 * Provides automatic network capture and AI debugging
 */
import { test as base, expect } from '@playwright/test';
import { 
  runAiDebuggingAnalysis, 
  setupNetworkCapture,
  type NetworkRequest 
} from '../../src/index';
import dotenv from 'dotenv';

// Make sure environment variables are loaded
dotenv.config();

// Store network capture data per test
const testNetworkCaptures = new Map<string, { networkRequests: NetworkRequest[], teardown: () => void }>();

// Enhanced test base with AI debugging
const testBase = base.extend({
  page: async ({ page }, use, testInfo) => {
    // Set up network capture
    const { networkRequests, teardown } = setupNetworkCapture(page);
    
    // Store reference to use after test
    testNetworkCaptures.set(testInfo.testId, { networkRequests, teardown });
    
    await use(page);
    
    // Run AI debugging on failure
    if (testInfo.status === 'failed' && testInfo.error) {
      const capture = testNetworkCaptures.get(testInfo.testId);
      if (capture) {
          await runAiDebuggingAnalysis(page, testInfo, testInfo.error, capture.networkRequests);
        capture.teardown();
      }
    }
    
    // Clean up
    testNetworkCaptures.delete(testInfo.testId);
  }
});

// Export the enhanced test object
export { testBase as test, expect };