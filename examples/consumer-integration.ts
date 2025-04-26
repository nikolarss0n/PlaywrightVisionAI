/**
 * Example integration for the consumer-ajo-c2b-testing project
 * 
 * This file demonstrates how to integrate the AI debugger with a complex test setup
 * that uses custom page fixtures (customPage).
 */
import { test as baseTest } from '@playwright/test'; // Replace with your actual test import
import { enhanceTestWithAiDebugging } from 'playwright-vision-ai-debugger';
import dotenv from 'dotenv';

// Load environment variables for the Gemini API key
dotenv.config();

// One-line integration that handles network capture and AI debugging
export const test = enhanceTestWithAiDebugging(baseTest, {
  // Use the custom page property from your framework
  customPageProperty: 'customPage',
  // Enable automatic network request capturing
  includeNetworkCapture: true,
  // Only run AI debugging when tests fail (default)
  runOnlyOnFailure: true
});

// Re-export everything else from your test framework
export * from '@playwright/test'; // Replace with your actual test export

/**
 * Usage in your test files:
 * 
 * import { test } from './path/to/this/file';
 * 
 * test('my test', async ({ customPage }) => {
 *   // Your test code here
 *   // Network requests will be automatically captured
 *   // AI debugging will run automatically on test failure
 * });
 */