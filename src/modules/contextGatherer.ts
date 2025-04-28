/**
 * Module for gathering page and error context
 */
import { Page, TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import { extractSelectorFromError } from '../utils/errorUtils';

/**
 * Captures HTML content from the page
 */
export async function captureHtml(page: Page): Promise<string | undefined> {
  try {
    const html = await page.content();
    console.log("✅ HTML content captured.");
    return html;
  } catch (htmlError: unknown) {
    const errorMessage = htmlError instanceof Error ? htmlError.message : String(htmlError);
    console.warn(`⚠️ Could not capture HTML content: ${errorMessage}`);
    return `Error capturing HTML: ${errorMessage}`;
  }
}

/**
 * Captures a full-page screenshot
 */
export async function captureScreenshot(page: Page): Promise<string | undefined> {
  try {
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    const screenshotBase64 = screenshotBuffer.toString('base64');
    console.log("✅ Screenshot captured.");
    return screenshotBase64;
  } catch (screenshotError: unknown) {
    const errorMessage = screenshotError instanceof Error ? screenshotError.message : String(screenshotError);
    console.warn(`⚠️ Could not capture screenshot: ${errorMessage}`);
    return undefined;
  }
}

/**
 * Safely converts any error message to string
 */
function safeMessageToString(message: unknown): string {
  if (message === undefined || message === null) {
    return 'No error message provided.';
  }
  
  if (typeof message === 'string') {
    return message;
  }
  
  if (typeof message === 'object') {
    try {
      return JSON.stringify(message, null, 2);
    } catch (e) {
      return String(message);
    }
  }
  
  return String(message);
}

/**
 * Extracts error information
 */
export function extractErrorInfo(error: Error | any): {
  errorMsg: string;
  stackTrace?: string;
  failingSelector?: string;
} {
  let errorMsg = 'No error message provided.';
  let stackTrace: string | undefined = undefined;
  
  // Handle different error types
  if (error) {
    // Extract message
    if (error.message !== undefined) {
      errorMsg = safeMessageToString(error.message);
    } else if (typeof error === 'string') {
      errorMsg = error;
    } else if (typeof error === 'object') {
      try {
        errorMsg = JSON.stringify(error, null, 2);
      } catch (e) {
        errorMsg = String(error);
      }
    } else {
      errorMsg = String(error);
    }
    
    // Extract stack trace
    stackTrace = error.stack ? String(error.stack) : undefined;
  }
  
  const failingSelector = extractSelectorFromError(error);
  
  return {
    errorMsg,
    stackTrace,
    failingSelector
  };
}

/**
 * Extracts test code from the test file
 */
export function extractTestCode(testInfo: TestInfo): string | undefined {
  try {
    // Get file path from testInfo
    const testFilePath = testInfo.file;
    if (!testFilePath || !fs.existsSync(testFilePath)) {
      console.warn(`⚠️ Could not find test file: ${testFilePath}`);
      return undefined;
    }

    // Read the test file
    const fileContent = fs.readFileSync(testFilePath, 'utf8');
    
    // For now, return the whole file content - in the future we could extract just
    // the specific test based on test title, but that's more complex
    // since tests can have complex structures (nested describes, etc.)
    return fileContent;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Error extracting test code: ${errorMessage}`);
    return undefined;
  }
}