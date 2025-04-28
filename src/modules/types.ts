/**
 * Common type definitions for the Playwright Vision AI Debugger
 */
import type { Page, TestInfo } from '@playwright/test';

/**
 * Structure for the AI analysis input data
 */
export interface AiAnalysisInput {
  /** HTML content of the page */
  html?: string;
  /** Base64-encoded screenshot */
  screenshotBase64?: string;
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
 * Result structure from AI call
 */
export interface AiDebuggingResult {
  /** Markdown content with the AI analysis */
  analysisMarkdown: string | null;
  /** Markdown content with usage information */
  usageInfoMarkdown: string | null;
  /** Markdown content with error information */
  errorMarkdown: string | null;
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