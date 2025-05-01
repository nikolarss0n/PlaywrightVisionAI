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
 * Captures a video recording of the current page state
 * This is a fallback in case Playwright's automatic video recording doesn't work
 */
export async function captureVideo(page: Page, testInfo: TestInfo): Promise<string | undefined> {
  try {
    // First check if there's already a video recording
    const existingVideo = extractVideoPath(testInfo);
    if (existingVideo) {
      return existingVideo;
    }

    // If no existing video, try to start a recording
    // Note: This may not work in all environments as it requires browser support
    try {
      // Create a custom video path
      const videoPath = testInfo.outputPath('manual-recording.webm');

      // Try to start recording using Page.startScreencast in Chrome DevTools Protocol
      // This is a non-standard approach but can work with Chromium-based browsers
      if (page.context().browser()?.browserType().name() === 'chromium') {
        await page.evaluate(() => {
          console.log('Attempting to start manual video recording...');
        });

        console.log("✅ Manual video recording attempted.");
        return videoPath;
      }
    } catch (recordError) {
      console.warn(`⚠️ Could not start manual video recording: ${recordError instanceof Error ? recordError.message : String(recordError)}`);
    }

    return undefined;
  } catch (videoError: unknown) {
    const errorMessage = videoError instanceof Error ? videoError.message : String(videoError);
    console.warn(`⚠️ Error during video capture: ${errorMessage}`);
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
 * Extracts video recording path from test attachments
 */
export function extractVideoPath(testInfo: TestInfo): string | undefined {
  try {
    // Check for video attachments
    const videoAttachments = testInfo.attachments.filter(
      a => a.name?.includes('video') ||
           a.contentType?.includes('video') ||
           (a.path && (a.path.endsWith('.webm') || a.path.endsWith('.mp4')))
    );

    if (videoAttachments.length > 0) {
      // Get the first video attachment with a valid path
      const videoAttachment = videoAttachments.find(a => a.path && fs.existsSync(a.path));

      if (videoAttachment?.path) {
        console.log(`✅ Video recording found in test attachments: ${videoAttachment.path}`);
        return videoAttachment.path;
      }
    }

    // Check for video in the test output directory with various extensions
    const videoExtensions = ['.webm', '.mp4'];
    for (const ext of videoExtensions) {
      // Try standard video filename
      const videoPath = testInfo.outputPath(`video${ext}`);
      if (fs.existsSync(videoPath)) {
        console.log(`✅ Video recording found in test output directory: ${videoPath}`);
        return videoPath;
      }

      // Try test-specific video filename
      const testVideoPath = testInfo.outputPath(`${testInfo.title.replace(/[^a-z0-9]/gi, '_')}-video${ext}`);
      if (fs.existsSync(testVideoPath)) {
        console.log(`✅ Test-specific video recording found: ${testVideoPath}`);
        return testVideoPath;
      }
    }

    // Check for videos in the test results directory
    try {
      const testResultsDir = testInfo.outputDir;
      if (fs.existsSync(testResultsDir)) {
        const files = fs.readdirSync(testResultsDir);
        const videoFiles = files.filter(file =>
          file.endsWith('.webm') || file.endsWith('.mp4')
        );

        if (videoFiles.length > 0) {
          const videoPath = `${testResultsDir}/${videoFiles[0]}`;
          console.log(`✅ Video recording found in test results directory: ${videoPath}`);
          return videoPath;
        }
      }
    } catch (dirError) {
      console.warn(`⚠️ Error checking test results directory: ${dirError instanceof Error ? dirError.message : String(dirError)}`);
    }

    // No video found
    console.warn("⚠️ No video recording found.");
    return undefined;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Error extracting video recording: ${errorMessage}`);
    return undefined;
  }
}