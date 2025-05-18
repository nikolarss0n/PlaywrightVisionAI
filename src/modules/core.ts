/**
 * Core functionality for the AI debugger
 */
import { Page, TestInfo } from '@playwright/test';
import { marked } from 'marked';

// Import modules
import { callDebuggingAI, DEFAULT_AI_PROVIDER } from './aiCaller';
import {
  captureHtml,
  captureScreenshot,
  extractErrorInfo,
  extractTestCode,
  captureVideo
} from './contextGatherer';
import { AiProvider } from './types';
import {
  setupNetworkCapture,
  formatNetworkRequestsForAi,
  extractNetworkRequestsFromAttachments
} from './networkCapture';
import {
  generateHtmlReport,
  saveAndAttachReport
} from './reportGenerator';
import {
  TOP_BORDER,
  SEPARATOR,
  BOTTOM_BORDER,
  createCenteredHeader,
  wrapTextInBox,
  logTestStart,
  logContextComplete,
  logErrorBox,
  logWarningBox,
  logAnalysisComplete
} from './consoleLogger';
// Import NetworkRequest type
import { NetworkRequest } from './types';

/**
 * Orchestrates the AI debugging analysis process for a failed Playwright test.
 * This function should be called within a test hook (e.g., test.afterEach).
 * @param page The Playwright Page object.
 * @param testInfo The Playwright TestInfo object.
 * @param error The Error object from the failed test.
 * @param existingNetworkRequests Optional array of already captured network requests
 * @returns Object containing the path to the generated report
 */
export async function runAiDebuggingAnalysis(
  page: Page,
  testInfo: TestInfo,
  error: any,
  existingNetworkRequests?: NetworkRequest[]
): Promise<{ reportPath?: string }> {
  let aiAnalysisResult: any = null;
  let aiAnalysisHtml = '<p>AI Analysis could not be performed.</p>';
  let usageInfoHtml = '';

  try {
    // --- Begin Context Gathering ---
    // Convert types to match function parameters
    const title = typeof testInfo.title === 'string' ? testInfo.title : undefined;
    const status = String(testInfo.status);
    const duration = Number(testInfo.duration);

    logTestStart(title, status, duration);

    const startTime = Date.now();

    // Extract error information
    const { errorMsg, stackTrace, failingSelector } = extractErrorInfo(error);

    // Capture HTML and screenshot
    const html = await captureHtml(page);
    const screenshotBase64 = await captureScreenshot(page);

    // Extract test code
    const testCode = extractTestCode(testInfo);
    if (testCode) {
      console.log("✅ Test code extracted.");
    }

    // Capture video if available - using the new async method that can get video from active page
    console.log("🔍 Attempting to capture video from active page or test attachments...");

    // Use the new async captureVideo function that can get video from the active page
    const { videoPath, videoBase64 } = await captureVideo(page, testInfo);

    if (videoPath) {
      console.log(`✅ Video captured: ${videoPath}`);

      // Verify the video file exists and has content
      try {
        const fs = require('fs');
        if (fs.existsSync(videoPath)) {
          const stats = fs.statSync(videoPath);
          console.log(`✅ Video file exists and is ${Math.round(stats.size / 1024)} KB`);

          if (videoBase64) {
            console.log(`✅ Video base64 data is ${Math.round(videoBase64.length / 1024)} KB`);
          } else {
            console.log(`⚠️ Video base64 data is not available`);
          }
        } else {
          console.log(`⚠️ Video file does not exist: ${videoPath}`);
        }
      } catch (e) {
        console.warn(`⚠️ Error checking video file: ${e}`);
      }
    } else {
      console.log("⚠️ No video path found");
    }

    // We already extracted the test code earlier

    // Network request handling - use existing requests if provided
    let networkRequests: NetworkRequest[] = existingNetworkRequests || [];
    let teardown = () => {}; // Default no-op function

    // Only set up network capture if we don't already have network requests
    if (!existingNetworkRequests || existingNetworkRequests.length === 0) {
      // Set up network capture for the current page
      const capture = setupNetworkCapture(page);
      networkRequests = capture.networkRequests;
      teardown = capture.teardown;

      // Check for manually tracked network requests (added by test)
      try {
        // @ts-ignore: Accessing custom property
        const manualRequests = testInfo._manualNetworkRequests || [];
        if (manualRequests.length > 0) {
          console.log(`✅ Found ${manualRequests.length} manually tracked network requests.`);
          // Add manual requests to the main requests array
          networkRequests.push(...manualRequests);
        }
      } catch (manualError: unknown) {
        const errorMessage = manualError instanceof Error ? manualError.message : String(manualError);
        console.warn(`⚠️ Could not get manually tracked network requests: ${errorMessage}`);
      }

      // Also check for existing network request attachments
      try {
        const attachedRequests = extractNetworkRequestsFromAttachments(testInfo);
        if (attachedRequests && !attachedRequests.startsWith('No network requests')) {
          console.log("✅ Found network requests in test attachments.");
        } else if (networkRequests.length === 0) {
          console.warn("⚠️ No network requests found in test attachments.");
        }
      } catch (networkError: unknown) {
        const errorMessage = networkError instanceof Error ? networkError.message : String(networkError);
        console.warn(`⚠️ Could not extract network requests from attachments: ${errorMessage}`);
      }
    } else {
      console.log(`✅ Using ${existingNetworkRequests.length} pre-captured network requests.`);
    }

    // Context gathering complete
    const contextTime = Date.now() - startTime;
    logContextComplete(contextTime, failingSelector);
    // --- End Context Gathering ---

    // --- Prepare AI Input ---
    // Format the network requests for AI
    const formattedNetworkRequests = formatNetworkRequestsForAi(networkRequests);

    const aiInput = {
      html,
      screenshotBase64,
      videoBase64,
      videoPath,
      errorMsg,
      stackTrace,
      failingSelector: failingSelector || undefined,
      testTitle: title,
      testCode,
      networkRequests: formattedNetworkRequests
    };

    // --- Call AI ---
    console.log("🧠 Calling AI for analysis...");

    // Log if video is available but not included in AI input
    if (videoPath && !videoBase64) {
      console.log("ℹ️ Video available but not included in AI input (requires base64 encoding).");
    }

    const aiStartTime = Date.now();
    aiAnalysisResult = await callDebuggingAI(aiInput);
    const aiEndTime = Date.now();
    console.log(`✅ AI analysis completed in ${aiEndTime - aiStartTime}ms.`);

    // --- Prepare AI Content for HTML ---
    if (aiAnalysisResult?.errorMarkdown) {
      console.error("AI Analysis Error:", aiAnalysisResult.errorMarkdown);
      aiAnalysisHtml = marked.parse(aiAnalysisResult.errorMarkdown) as string;
    } else if (aiAnalysisResult?.analysisMarkdown) {
      aiAnalysisHtml = marked.parse(aiAnalysisResult.analysisMarkdown) as string;
    } else {
      aiAnalysisHtml = '<p>AI analysis returned no content.</p>';
    }

    // Prepare Usage Info HTML
    if (aiAnalysisResult?.usageInfoMarkdown) {
      usageInfoHtml = marked.parse(aiAnalysisResult.usageInfoMarkdown) as string;
    }

    // --- Generate and Save HTML Report ---
    const htmlReport = generateHtmlReport({
      testInfo,
      failingSelector,
      testCode,
      errorMsg,
      stackTrace,
      networkRequests,
      aiAnalysisHtml,
      usageInfoHtml,
      screenshotBase64,
      videoPath,
      videoBase64,
      modelName: aiAnalysisResult.modelName,
      provider: aiAnalysisResult.provider,
      tokensUsed: aiAnalysisResult.tokensUsed,
      processingTimeMs: aiAnalysisResult.processingTimeMs,
      estimatedCost: aiAnalysisResult.estimatedCost,
      currency: aiAnalysisResult.currency
    });

    // Save and attach the report
    const reportPath = await saveAndAttachReport(
      testInfo,
      htmlReport,
      aiAnalysisResult?.analysisMarkdown,
      aiAnalysisResult?.usageInfoMarkdown
    );

    // Clean up network capture
    teardown();

    // Log analysis completion
    logAnalysisComplete();

    // Return the report path
    return { reportPath };

  } catch (captureError: unknown) {
    const errorMessage = captureError instanceof Error ? captureError.message : String(captureError);
    console.error(`\n❌ Critical error during failure processing: ${errorMessage}`, captureError);

    // Log error box
    logErrorBox("❌ Context Capture/Processing Error ❌", errorMessage);

    // Attempt to attach a basic error report
    try {
      await testInfo.attach('ai-processing-error.txt', {
        body: `Error during AI analysis: ${errorMessage}\n\nStack trace: ${
          captureError instanceof Error ? captureError.stack : 'No stack trace available'
        }`,
        contentType: 'text/plain',
      });
    } catch (e) {
      console.error('Could not attach error details.');
    }

    // Return empty object for error case
    return {};
  }
}

/**
 * Sets up AI debugging for a test suite.
 * Supports both simple and complex test setups (with custom fixtures).
 * @param testInstance The test instance to attach the debugging hook to
 */
export function setupAiDebugging(testInstance: any): any {
  if (!testInstance) {
    console.error("Test instance is undefined or null. Cannot set up AI debugging.");
    return testInstance;
  }

  // Method 1: Try to handle complex test setups with custom fixtures
  if (typeof testInstance.extend === 'function') {
    try {
      // Create a new test instance with the AI debugging capability
      const enhancedTest = testInstance.extend({
        page: async ({ page }: { page: Page }, use: (page: Page) => Promise<void>, testInfo: TestInfo) => {
          // Process the page with the AI debugging capability
          try {
            await use(page);
          } catch (error: any) {
            // On test failure, run AI debugging
            if (page && testInfo.status === 'failed') {
              try {
                // Preserve the original error without conversion - let extractErrorInfo handle it
                console.log("Running AI debugging with original error object");
                await runAiDebuggingAnalysis(page, testInfo, error);
              } catch (aiError) {
                console.error('Error in AI debugging:', aiError);
              }
            }
            // Re-throw the original error to maintain test behavior
            throw error;
          }
        }
      });

      return enhancedTest;
    } catch (error) {
      console.warn("Could not extend test with AI debugging. Falling back to afterEach hook method.");
      // Fall back to Method 2 if extending fails
    }
  }

  // Method 2: Use afterEach hook (more compatible with different test setups)
  try {
    testInstance.afterEach(async ({ page, customPage }: { page?: Page, customPage?: Page }, testInfo: TestInfo) => {
      // Use whichever page object is available
      const activePage = customPage || page;

      if (testInfo.status === 'failed' && testInfo.error && activePage) {
        try {
          // Pass the original error directly without conversion - let extractErrorInfo handle it
          console.log("Running AI debugging with original testInfo.error object");
          await runAiDebuggingAnalysis(activePage, testInfo, testInfo.error);
        } catch (e) {
          console.error('Error in AI debugging:', e);
        }
      }
    });
  } catch (error) {
    console.error("Failed to set up AI debugging:", error);
  }

  // Return the original or enhanced test instance
  return testInstance;
}

/**
 * Enhanced setup function for AI debugging - combines network capture and AI debugging
 * Provides elegant one-line integration for complex test setups
 *
 * @param testInstance The test instance to enhance with AI debugging and network capture
 * @param options Optional configuration options
 * @returns The enhanced test instance with AI debugging and network capture
 */
export function enhanceTestWithAiDebugging(
  testInstance: any,
  options: {
    runOnlyOnFailure?: boolean;
    customPageProperty?: string;
    includeNetworkCapture?: boolean;
    usePostTestAnalysis?: boolean;
    openReportAutomatically?: boolean;
    captureNetworkRequests?: boolean;
    waitTimeAfterTestMs?: number;
  } = {}
): any {
  // Default options
  const opts = {
    runOnlyOnFailure: true,
    customPageProperty: 'customPage',
    includeNetworkCapture: true,
    usePostTestAnalysis: false,
    openReportAutomatically: true,
    captureNetworkRequests: true,
    waitTimeAfterTestMs: 5000,
    ...options
  };

  if (!testInstance) {
    console.error("Test instance is undefined or null. Cannot set up AI debugging.");
    return testInstance;
  }

  // Set up automatic network capture if requested
  let enhancedTest = testInstance;
  if (opts.includeNetworkCapture) {
    try {
      const { setupAutomaticNetworkCapture, getCapturedNetworkRequests } = require('./networkCapture');
      enhancedTest = setupAutomaticNetworkCapture(testInstance);
      console.log("✅ Automatic network capture enabled.");
    } catch (error) {
      console.warn("⚠️ Failed to set up automatic network capture:", error);
      // Continue with the original test instance if network setup fails
      enhancedTest = testInstance;
    }
  }

  // Now, add the AI debugging afterEach hook
  try {
    // Use explicit fixture parameters for Playwright compatibility
    enhancedTest.afterEach(async ({ page }: { page: Page }, testInfo: TestInfo) => {
      // Since we can't use rest properties, we'll just use the standard page
      const pageToUse = page;

      // Run AI debugging based on runOnlyOnFailure option and test status
      const shouldRunDebugging = opts.runOnlyOnFailure
        ? testInfo.status === 'failed' && testInfo.error && pageToUse
        : pageToUse !== undefined;

      if (shouldRunDebugging) {
        try {
          console.log(`Running AI debugging for test: ${testInfo.title}`);

          // Get any captured network requests if network capture is enabled
          let networkRequests = [];
          if (opts.includeNetworkCapture) {
            try {
              // First try to get automatically captured network requests
              const { getCapturedNetworkRequests } = require('./networkCapture');
              networkRequests = getCapturedNetworkRequests(testInfo) || [];
              console.log(`Found ${networkRequests.length} captured network requests.`);
              
              // Also check for manually tracked network requests
              try {
                // @ts-ignore: Accessing custom property
                const manualRequests = testInfo._manualNetworkRequests || [];
                if (manualRequests.length > 0) {
                  console.log(`Found ${manualRequests.length} manually tracked network requests.`);
                  // Add manual requests to the network requests array
                  networkRequests = [...networkRequests, ...manualRequests];
                }
              } catch (manualError) {
                console.warn("⚠️ Could not get manually tracked network requests:", manualError);
              }
            } catch (e) {
              console.warn("⚠️ Could not get captured network requests:", e);
            }
          }

          // Get the error from testInfo
          const error = testInfo.error || new Error("Test debugger invoked without an error");

          // Run the AI debugging analysis with the captured network requests
          await runAiDebuggingAnalysis(pageToUse, testInfo, error, networkRequests);
        } catch (e) {
          console.error('❌ Error in AI debugging:', e);
        }
      }
    });

    console.log("✅ AI debugging enhancement complete.");
  } catch (error) {
    console.error("❌ Failed to set up AI debugging:", error);
  }

  // Return the enhanced test instance
  return enhancedTest;
}