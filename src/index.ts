/**
 * Main entry point for the Playwright Vision AI Debugger
 * Provides AI-powered visual debugging for Playwright tests
 */
import type { Page, TestInfo } from '@playwright/test';

// Import modules
import { runAiDebuggingAnalysis, setupAiDebugging } from './modules/core';
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
export { runAiDebuggingAnalysis, setupAiDebugging };

// Console styling exports for backwards compatibility
export {
  TOP_BORDER,
  BOTTOM_BORDER,
  SEPARATOR,
  createCenteredHeader,
  wrapTextInBox
};