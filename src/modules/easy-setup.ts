/**
 * Simplified setup module providing one-line integration with multi-model support
 */
import { test as baseTest } from '@playwright/test';

// Import core module
import { enhanceTestWithAiDebugging } from './core';
import { AiProvider } from './types';
import { loadConfig, createExampleEnvFile } from './configLoader';

// Load environment configuration from .env files
loadConfig();

// Create example .env file if none exists
createExampleEnvFile();

// Check if API keys are available (check both possible Claude API key env vars)
const geminiApiKey = process.env.GEMINI_API_KEY;
const claudeApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

if (!geminiApiKey && !claudeApiKey) {
  console.warn('⚠️ Neither GEMINI_API_KEY nor ANTHROPIC_API_KEY/CLAUDE_API_KEY is set in environment variables. AI debugging will not work correctly.');
} else {
  if (!geminiApiKey) {
    console.warn('⚠️ GEMINI_API_KEY is not set. Only Claude will be available for AI analysis.');
  }
  if (!claudeApiKey) {
    console.warn('⚠️ Neither ANTHROPIC_API_KEY nor CLAUDE_API_KEY is set. Only Gemini will be available for AI analysis.');
  }
}

// Interface for AI configuration options
export interface AiTestOptions {
  // Core options
  runOnlyOnFailure?: boolean;
  includeNetworkCapture?: boolean;
  captureNetworkRequests?: boolean;
  openReportAutomatically?: boolean;
  
  // AI provider options
  aiProvider?: AiProvider;
  preferredModel?: 'gemini' | 'claude';
  fallbackToSecondaryModel?: boolean;
  
  // Video processing options
  useVideoFrames?: boolean;
  maxFrames?: number;
  frameInterval?: number;
}

/**
 * One-line setup function that does everything needed for AI debugging
 * - Auto-loads .env file with your API keys
 * - Captures network requests automatically
 * - Adds AI debugging to your tests
 * - Supports multiple AI models (Gemini and Claude)
 * - Configurable with optional settings
 * 
 * @param options Optional configuration for AI debugging
 * @returns Enhanced test object with AI debugging capabilities
 */
export function createAiTest(options?: AiTestOptions) {
  // Default options for enhanceTestWithAiDebugging
  const defaultOptions = {
    runOnlyOnFailure: true,
    includeNetworkCapture: true,
    captureNetworkRequests: true,
    openReportAutomatically: true,
    aiProvider: process.env.DEFAULT_AI_PROVIDER as AiProvider || 'claude',
    preferredModel: process.env.PREFERRED_AI_MODEL as 'gemini' | 'claude' || 'claude',
    fallbackToSecondaryModel: true,
    useVideoFrames: process.env.USE_VIDEO_FRAMES !== 'false',
    maxFrames: parseInt(process.env.MAX_VIDEO_FRAMES || '5', 10),
    frameInterval: parseInt(process.env.VIDEO_FRAME_INTERVAL || '0', 10) // 0 means extract frames at key moments
  };

  // Merge provided options with defaults
  const mergedOptions = { ...defaultOptions, ...options };

  // Set environment variables based on options
  if (mergedOptions.aiProvider) {
    process.env.DEFAULT_AI_PROVIDER = mergedOptions.aiProvider;
  }
  
  if (mergedOptions.preferredModel) {
    process.env.PREFERRED_AI_MODEL = mergedOptions.preferredModel;
  }
  
  if (mergedOptions.useVideoFrames !== undefined) {
    process.env.USE_VIDEO_FRAMES = mergedOptions.useVideoFrames ? 'true' : 'false';
  }
  
  if (mergedOptions.maxFrames !== undefined) {
    process.env.MAX_VIDEO_FRAMES = mergedOptions.maxFrames.toString();
  }
  
  if (mergedOptions.frameInterval !== undefined) {
    process.env.VIDEO_FRAME_INTERVAL = mergedOptions.frameInterval.toString();
  }

  // Return the enhanced test object
  return enhanceTestWithAiDebugging(baseTest, mergedOptions);
}

/**
 * Add AI debugging to your custom test setup
 * 
 * @param customTest Your custom test setup
 * @param options Optional configuration for AI debugging
 * @returns Enhanced test object with AI debugging capabilities
 */
export function addAiDebugging(customTest: any, options?: AiTestOptions) {
  // Use createAiTest to get the default options, then apply them to the custom test
  const defaultOptions = {
    runOnlyOnFailure: true,
    includeNetworkCapture: true,
    captureNetworkRequests: true,
    openReportAutomatically: true,
    aiProvider: process.env.DEFAULT_AI_PROVIDER as AiProvider || 'claude',
    preferredModel: process.env.PREFERRED_AI_MODEL as 'gemini' | 'claude' || 'claude',
    fallbackToSecondaryModel: true,
    useVideoFrames: process.env.USE_VIDEO_FRAMES !== 'false',
    maxFrames: parseInt(process.env.MAX_VIDEO_FRAMES || '5', 10),
    frameInterval: parseInt(process.env.VIDEO_FRAME_INTERVAL || '0', 10)
  };

  // Merge provided options with defaults
  const mergedOptions = { ...defaultOptions, ...options };

  // Return the enhanced test object
  return enhanceTestWithAiDebugging(customTest, mergedOptions);
}