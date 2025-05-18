/**
 * Global test fixtures setup for Playwright Vision AI
 */
import { test as baseTest } from '@playwright/test';
import { enhanceTestWithAiDebugging } from '../../src/modules/core';

/**
 * Enhanced test fixture with AI debugging capabilities
 * 
 * This provides a centralized setup for all tests to use AI debugging
 * without needing to import the enhancement in each test file.
 */
export const test = enhanceTestWithAiDebugging(baseTest);

/**
 * Re-export expect so tests can import both test and expect from one place
 */
export { expect } from '@playwright/test';