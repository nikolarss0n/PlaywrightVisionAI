/**
 * Main entry point for the Playwright Vision AI Debugger
 * Provides AI-powered visual debugging for Playwright tests
 */
import type { Page, TestInfo } from '@playwright/test';

// Import modules
import { runAiDebuggingAnalysis, setupAiDebugging, enhanceTestWithAiDebugging } from './modules/core';
import { 
  setupNetworkCapture, 
  setupAutomaticNetworkCapture, 
  getCapturedNetworkRequests 
} from './modules/networkCapture';
import {
  TOP_BORDER,
  SEPARATOR,
  BOTTOM_BORDER,
  createCenteredHeader,
  wrapTextInBox,
} from './modules/consoleLogger';

// Re-export types for consumers
import type { AiDebuggingResult, NetworkRequest } from './modules/types';
export type { AiDebuggingResult, NetworkRequest };

// Re-export the main functions
export { 
  runAiDebuggingAnalysis, 
  setupAiDebugging,
  enhanceTestWithAiDebugging  // New elegant one-line integration
};

// Network capture exports
export {
  setupNetworkCapture,
  setupAutomaticNetworkCapture,
  getCapturedNetworkRequests
};

// Console styling exports for backwards compatibility
export {
  TOP_BORDER,
  BOTTOM_BORDER,
  SEPARATOR,
  createCenteredHeader,
  wrapTextInBox
};