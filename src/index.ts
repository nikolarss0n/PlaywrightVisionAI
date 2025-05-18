/**
 * Main entry point for the Playwright Vision AI Debugger v1.5.0
 * Provides AI-powered visual debugging for Playwright tests
 * Now with multi-model support (Google Gemini and Anthropic Claude)
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

// Import new simplified setup functions
import { createAiTest, addAiDebugging } from './modules/easy-setup';

// Re-export types for consumers
import type { AiDebuggingResult, NetworkRequest, AiProvider, VideoFrame } from './modules/types';
import type { AiTestOptions } from './modules/easy-setup';
export type { AiDebuggingResult, NetworkRequest, AiProvider, VideoFrame, AiTestOptions };

// Import post-test analysis module
import { runPostTestAnalysis } from './modules/postTestAnalysis';

// Import config loader functions
import { loadConfig, createExampleEnvFile } from './modules/configLoader';

// Import the Playwright Vision Reporter
import VisionReporter, { VisionReporterOptions } from './reporter';

// Re-export the simplified setup functions (MAIN API)
export {
  createAiTest,    // One-line setup for new projects
  addAiDebugging,  // One-line setup for existing custom test fixtures
  loadConfig,      // Manually load configuration
  createExampleEnvFile // Create example .env file
};

// Re-export the main functions (advanced API)
export {
  runAiDebuggingAnalysis,
  setupAiDebugging,
  enhanceTestWithAiDebugging,  // New elegant one-line integration
  runPostTestAnalysis          // Post-test analysis for video processing
};

// Network capture exports
export {
  setupNetworkCapture,
  setupAutomaticNetworkCapture,
  getCapturedNetworkRequests
};

// Video recording and processing exports
import { setupVideoRecording, extractVideoFromAttachments, getActiveVideoPath } from './modules/videoRecorder';
import { createManualVideoRecorder, videoToBase64, attachVideoToTest as attachManualVideoToTest } from './modules/manualVideoRecorder';
import {
  SimpleVideoRecorder,
  getGlobalRecorder,
  createGlobalRecorder,
  attachVideoToTest
} from './modules/simpleVideoRecorder';

// Import video frame extraction (new in v1.5.0)
import { extractKeyFrames, extractFrameAtPosition } from './modules/browserFrameExtractor';

export {
  // Original video recording
  setupVideoRecording,
  extractVideoFromAttachments,
  getActiveVideoPath,

  // Manual video recording
  createManualVideoRecorder,
  videoToBase64,
  attachManualVideoToTest,

  // Simple video recording
  SimpleVideoRecorder,
  getGlobalRecorder,
  createGlobalRecorder,
  attachVideoToTest,
  
  // Video frame extraction (new in v1.5.0)
  extractKeyFrames,
  extractFrameAtPosition
};

// Console styling exports for backwards compatibility
export {
  TOP_BORDER,
  BOTTOM_BORDER,
  SEPARATOR,
  createCenteredHeader,
  wrapTextInBox
};

// Export the new Playwright Vision Reporter
export {
  VisionReporter,
  VisionReporterOptions
};