/**
 * Common type definitions for the Playwright Vision AI Debugger
 */
import type { Page, TestInfo } from '@playwright/test';

/**
 * Structure for a video frame extracted from a test recording
 */
export interface VideoFrame {
  /** Path to the frame image file */
  path: string;
  /** Position in seconds where the frame was extracted from the video */
  position: number;
  /** Base64-encoded image data */
  base64?: string;
  /** MIME type of the image */
  mimeType?: string;
  /** Indicates if this is a placeholder frame rather than an actual video frame */
  isPlaceholder?: boolean;
}

/**
 * Structure for the AI analysis input data
 */
export interface AiAnalysisInput {
  /** HTML content of the page */
  html?: string;
  /** Base64-encoded screenshot */
  screenshotBase64?: string;
  /** Base64-encoded video */
  videoBase64?: string;
  /** Path to the video file */
  videoPath?: string;
  /** Error message */
  errorMsg: string;
  /** Error stack trace */
  stackTrace?: string;
  /** Failing selector extracted from error */
  failingSelector?: string;
  /** Test title */
  testTitle?: string;
  /** Test code content */
  testCode?: string;
  /** Network request data */
  networkRequests?: string;
}

/**
 * Available AI providers
 */
export type AiProvider = "gemini" | "claude" | "both";

/**
 * Result structure from AI call
 */
export interface AiDebuggingResult {
  /** Markdown content with the AI analysis */
  analysisMarkdown?: string;
  /** Markdown content with usage information */
  usageInfoMarkdown?: string;
  /** Markdown content with error information */
  errorMarkdown?: string;
  /** Name of the model used */
  modelName?: string;
  /** Provider of the AI model */
  provider?: string;
  /** Number of tokens used for the analysis */
  tokensUsed?: number;
  /** Time taken to process the analysis in milliseconds */
  processingTimeMs?: number;
  /** Estimated cost of the analysis */
  estimatedCost?: number;
  /** Currency of the estimated cost */
  currency?: string;
}

/**
 * Interface for a captured network request
 */
export interface NetworkRequest {
  /** Request URL */
  url: string;
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** HTTP status code */
  status?: number;
  /** Timestamp when the request was made */
  timestamp: string;
  /** Resource type (xhr, fetch, document, etc.) */
  resourceType: string;
  /** Request headers */
  requestHeaders?: Record<string, string>;
  /** Response headers */
  responseHeaders?: Record<string, string>;
  /** Request body for POST/PUT/PATCH requests */
  requestPostData?: string | null; // Match Playwright's return type
  /** Response body */
  responseBody?: string;
}