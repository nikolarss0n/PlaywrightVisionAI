/**
 * Core functionality for the AI debugger
 */
import { Page, TestInfo } from '@playwright/test';
import { marked } from 'marked';

// Import modules
import { callDebuggingAI } from './aiCaller';
import { 
  captureHtml, 
  captureScreenshot, 
  extractErrorInfo, 
  extractTestCode 
} from './contextGatherer';
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

/**
 * Orchestrates the AI debugging analysis process for a failed Playwright test.
 * This function should be called within a test hook (e.g., test.afterEach).
 * @param page The Playwright Page object.
 * @param testInfo The Playwright TestInfo object.
 * @param error The Error object from the failed test.
 */
export async function runAiDebuggingAnalysis(page: Page, testInfo: TestInfo, error: Error): Promise<void> {
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
    } else {
      console.warn("⚠️ Could not extract test code.");
    }
    
    // Set up network capture for the current page
    const { networkRequests, teardown } = setupNetworkCapture(page);
    
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
      errorMsg,
      stackTrace,
      failingSelector: failingSelector || undefined,
      testTitle: title,
      testCode,
      networkRequests: formattedNetworkRequests
    };
    
    // --- Call AI ---
    console.log("🧠 Calling AI for analysis...");
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
      usageInfoHtml
    });
    
    // Save and attach the report
    await saveAndAttachReport(
      testInfo, 
      htmlReport, 
      aiAnalysisResult?.analysisMarkdown,
      aiAnalysisResult?.usageInfoMarkdown
    );
    
    // Clean up network capture
    teardown();
    
    // Log analysis completion
    logAnalysisComplete();
    
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
  }
}

/**
 * Sets up AI debugging for a test suite.
 * @param testInstance The test instance to attach the debugging hook to
 */
export function setupAiDebugging(testInstance: unknown): void {
  // Cast to a minimal interface that matches the test.afterEach structure
  const test = testInstance as { afterEach: (fn: (fixtures: Record<string, unknown>, testInfo: Record<string, unknown>) => Promise<void>) => void };
  
  test.afterEach(async (fixtures: Record<string, unknown>, testInfo: Record<string, unknown>) => {
    // Only run for failed tests with an error and page object
    if (testInfo.status === 'failed' && testInfo.error && fixtures.page) {
      try {
        // Convert the error to ensure it has the right properties
        const error = testInfo.error instanceof Error
          ? testInfo.error
          : new Error(String(testInfo.error));
        
        // Cast page and testInfo to appropriate types for the analysis function
        const page = fixtures.page as Page;
        await runAiDebuggingAnalysis(page, testInfo as unknown as TestInfo, error);
      } catch (e) {
        console.error('Error in AI debugging:', e);
      }
    }
  });
}