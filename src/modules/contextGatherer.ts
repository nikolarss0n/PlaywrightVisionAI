/**
 * Module for gathering page and error context
 */
import { Page, TestInfo, BrowserContext } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractSelectorFromError } from '../utils/errorUtils';
import { extractVideoFromAttachments, videoToBase64 } from './videoRecorder';

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

/**
 * Captures video from active page or test info attachments
 * @param page The Playwright Page object (can be undefined if not available)
 * @param testInfo The Playwright TestInfo object
 * @returns Object containing video path and base64-encoded video
 */
export async function captureVideo(page: Page | undefined, testInfo: TestInfo): Promise<{
  videoPath?: string;
  videoBase64?: string;
}> {
  try {
    let videoPath: string | undefined;

    // First, try to get the video from the active page if available
    if (page && !page.isClosed()) {
      try {
        // Import the getActiveVideoPath function
        const { getActiveVideoPath } = await import('./videoRecorder');

        // Try to get the video path from the active page
        // This might not be available immediately, so we'll retry a few times
        for (let i = 0; i < 3; i++) {
          console.log(`🎬 Attempting to get active video path (attempt ${i + 1}/3)...`);
          videoPath = await getActiveVideoPath(page);
          if (videoPath) {
            console.log(`✅ Successfully captured video from active page: ${videoPath}`);
            break;
          }

          // Wait a bit before retrying
          if (i < 2) { // Don't wait after the last attempt
            console.log("⏳ Waiting before retrying...");
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (e) {
        console.warn(`⚠️ Error getting video from active page: ${e}`);
        // Continue to try other methods
      }
    }

    // If we couldn't get the video from the active page, try to extract it from test attachments
    if (!videoPath) {
      videoPath = extractVideoFromAttachments(testInfo);
    }

    if (!videoPath) {
      console.log("ℹ️ No video found in active page or test attachments.");
      return {};
    }

    // Convert video to base64 if path is available
    // Add retry mechanism for video conversion
    let videoBase64: string | undefined;

    // Try up to 3 times to convert the video to base64
    for (let i = 0; i < 3; i++) {
      console.log(`🎬 Attempting to convert video to base64 (attempt ${i + 1}/3)...`);
      videoBase64 = videoToBase64(videoPath);

      if (videoBase64) {
        console.log(`✅ Successfully converted video to base64 (${Math.round(videoBase64.length / 1024)} KB)`);
        break;
      }

      // Wait a bit before retrying
      if (i < 2) { // Don't wait after the last attempt
        console.log("⏳ Waiting before retrying video conversion...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!videoBase64) {
      console.warn("⚠️ Failed to convert video to base64 after multiple attempts");
    }

    return {
      videoPath,
      videoBase64
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Error capturing video: ${errorMessage}`);
    return {};
  }
}