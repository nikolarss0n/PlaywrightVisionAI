import { test as baseTest } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';
import { marked } from 'marked'; // Ensure marked is installed: npm install marked @types/marked
import {
  callDebuggingAI,
  type AiDebuggingResult,
  // Console logging helpers (optional but kept for console output)
  TOP_BORDER,
  BOTTOM_BORDER,
  SEPARATOR,
  createCenteredHeader,
  wrapTextInBox,
} from './aiDebugger'; // Assuming './aiDebugger.ts'
// Import the report generation functions with corrected path - ensure they are imported correctly
import { generateHtmlReport, saveAndAttachReport } from './src/modules/reportGenerator.js';
import { extractSelectorFromError } from './errorUtils'; // Assuming './errorUtils.ts'
import * as fs from 'node:fs';
import type { NetworkRequest } from './src/modules/types'; // Import NetworkRequest type (updated to accept null)

// Define the shape of the AI analysis input (remains the same)
interface AiAnalysisInput {
  html?: string;
  screenshotBase64?: string;
  errorMsg: string;
  stackTrace?: string;
  failingSelector?: string;
  testTitle?: string;
  testCode?: string; // Add the test code content
  networkRequests?: string; // Network request logs
}

// Helper function to escape HTML characters (Corrected)
function escapeHtml(unsafe: string | undefined | null): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Attempts to extract test code from the test file
 * @param testInfo TestInfo object from Playwright
 * @returns The test code if found, undefined otherwise
 */
function extractTestCode(testInfo: TestInfo): string | undefined {
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

// Extend the base test object
export const test = baseTest.extend<{ aiEnhancedPage: Page }>({

  // Browser context options
  async context({ context }, use, testInfo) {
    // Only start tracing if not already started
    let tracingStarted = false;
    
    try {
      // Start fresh tracing session (only if not already started)
      try {
        await context.tracing.start({
          screenshots: true,
          snapshots: true,
          sources: true
        });
        tracingStarted = true;
        console.log("✓ Tracing started successfully.");
      } catch (error) {
        if (error.message.includes("Tracing has been already started")) {
          console.log("ℹ️ Tracing was already started, continuing with existing trace.");
          tracingStarted = true;
        } else {
          console.error("❌ Failed to start tracing:", error.message);
        }
      }
      
      // Use the context
      await use(context);
    } finally {
      // Only stop tracing if we successfully started it
      if (tracingStarted && testInfo.status !== 'passed') {
        try {
          await context.tracing.stop({
            path: testInfo.outputPath('trace.zip')
          });
          console.log("✓ Trace saved to:", testInfo.outputPath('trace.zip'));
        } catch (error) {
          console.error("❌ Failed to stop tracing:", error.message);
        }
      } else if (tracingStarted) {
        try {
          await context.tracing.stop();
          console.log("✓ Tracing stopped (test passed, no trace saved).");
        } catch (error) {
          console.error("❌ Failed to stop tracing:", error.message);
        }
      }
    }
  },

  // Define an afterEach hook
  async page({ page }, use, testInfo: TestInfo) {
    // Store captured network requests (Use imported NetworkRequest type)
    const networkRequests: NetworkRequest[] = [];
    
    // Store request-response pairs for correlation
    const requestMap = new Map<string, {
      url: string;
      method: string;
      timestamp: string;
      resourceType: string;
      requestHeaders: Record<string, string>;
      requestPostData?: string | null; // Align with Playwright's return type
    }>();
    
    // Generate a unique ID counter
    let requestCounter = 0;
    
    // Listen for network requests - capture ALL request types
    page.on('request', async request => {
      const uniqueId = `req_${++requestCounter}`;
      const timestamp = new Date().toISOString();
      
      // Store all request types but prioritize API calls
      const resourceType = request.resourceType();
      let requestPostData: string | null = null;
      
      // Try to capture POST data when available
      try {
        if (request.method() === 'POST' || request.method() === 'PUT' || request.method() === 'PATCH') {
          requestPostData = request.postData();
        }
      } catch (err) {
        // Ignore errors in getting post data
      }
      
      // Track all requests but add importance flag for XHR/fetch/document
      requestMap.set(request.url(), {
        url: request.url(),
        method: request.method(),
        timestamp,
        resourceType,
        requestHeaders: request.headers(),
        requestPostData: requestPostData ?? undefined
      });
    });
    
    // Listen for responses
    page.on('response', async response => {
      const url = response.url();
      const requestData = requestMap.get(url);
      
      if (requestData) {
        try {
          // Try to get response body for XHR/fetch/API responses
          let responseBody;
          if (
            requestData.resourceType === 'xhr' || 
            requestData.resourceType === 'fetch' ||
            response.headers()['content-type']?.includes('application/json')
          ) {
            try {
              // Only try to get text for non-binary responses
              const contentType = response.headers()['content-type'] || '';
              if (
                contentType.includes('json') || 
                contentType.includes('text') || 
                contentType.includes('javascript') ||
                contentType.includes('xml')
              ) {
                responseBody = await response.text().catch(() => undefined);
              }
            } catch (textError) {
              // Ignore text extraction errors
            }
          }
          
          networkRequests.push({
            ...requestData,
            status: response.status(),
            responseHeaders: response.headers(),
            responseBody
          });
        } catch (responseError) {
          // If we fail to process the response, still add the basic info
          networkRequests.push({
            ...requestData,
            status: response.status(),
            responseHeaders: response.headers()
          });
        }
        
        // Remove from map to avoid duplicate entries
        requestMap.delete(url);
      }
    });
    
    // Run the test
    await use(page);

    // --- This code runs AFTER the test body has finished ---
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      // Check if there's an error object and the page is still open
      if (testInfo.error && !page.isClosed()) {
        let aiAnalysisResult: AiDebuggingResult | null = null; // To store AI result
        let aiAnalysisHtml = '<p>AI Analysis could not be performed.</p>'; // Default HTML content
        let usageInfoHtml = ''; // Default usage HTML

        try {
          // --- Context Gathering ---
          console.log(`\n${TOP_BORDER}`);
          console.log(createCenteredHeader("🤖 AI Debugging Assistant Activated 🤖"));
          console.log(`${SEPARATOR}`);
          console.log(`Test Failed: "${testInfo.title}"`);
          console.log(`Status: ${testInfo.status}`);
          console.log(`Duration: ${testInfo.duration}ms`);
          console.log(`${SEPARATOR}`);
          console.log("Gathering context for analysis...");

          const startTime = Date.now();
          let html: string | undefined;
          let screenshotBase64: string | undefined;
          // Variables to store error details
          let errorMsg = '';
          const stackTrace: string | undefined = testInfo.error.stack;
          const failingSelector: string | null | undefined = extractSelectorFromError(
            testInfo.error as unknown as Error
          ); // Use the utility function

          // Capture HTML content
          try {
            html = await page.content();
            console.log("✅ HTML content captured.");
          } catch (htmlError: unknown) {
            const errorMessage = htmlError instanceof Error ? htmlError.message : String(htmlError);
            console.warn(`⚠️ Could not capture HTML content: ${errorMessage}`);
            html = `Error capturing HTML: ${errorMessage}`;
          }

          // Capture Screenshot
          try {
            const screenshotBuffer = await page.screenshot({ fullPage: true });
            screenshotBase64 = screenshotBuffer.toString('base64');
            console.log("✅ Screenshot captured.");
          } catch (screenshotError: unknown) {
            const errorMessage = screenshotError instanceof Error ? screenshotError.message : String(screenshotError);
            console.warn(`⚠️ Could not capture screenshot: ${errorMessage}`);
            screenshotBase64 = undefined; // Indicate screenshot failed
          }

          // Extract Error Details
          errorMsg = testInfo.error.message || 'No error message provided.';

          const contextTime = Date.now() - startTime;
          console.log(`✅ Context gathered in ${contextTime}ms.`);
          console.log(`Failing Selector (extracted): ${failingSelector || 'N/A'}`);
          console.log(`${SEPARATOR}`);
          // --- End Context Gathering ---

          // Extract the test code
          const testCode = extractTestCode(testInfo);
          if (testCode) {
            console.log("✅ Test code extracted.");
          } else {
            console.warn("⚠️ Could not extract test code.");
          }

          // --- Prepare Network Requests Data ---
          let networkRequestsData = "No network requests captured.";
          if (networkRequests.length > 0) {
            // Filter only the most important requests for the AI analysis
            const apiRequestsOnly = networkRequests.filter(req => 
              req.resourceType === 'xhr' || 
              req.resourceType === 'fetch' || 
              (req.responseHeaders?.['content-type']?.includes('json') || 
               req.responseHeaders?.['content-type']?.includes('application/javascript'))
            );
            
            const relevantRequests = apiRequestsOnly.length > 0 
              ? apiRequestsOnly.slice(-20)  // Limit to last 20 API requests 
              : networkRequests.slice(-20); // If no API requests, use last 20 of any type
            
            // Format nicely for AI analysis
            const formattedRequests = relevantRequests.map(req => {
              const requestInfo: any = {
                url: req.url,
                method: req.method,
                resourceType: req.resourceType,
                status: req.status || 'No status',
                timestamp: req.timestamp
              };
              
              // Add important headers
              if (req.requestHeaders) {
                requestInfo.requestHeaders = Object.fromEntries(
                  Object.entries(req.requestHeaders)
                    .filter(([key]) => [
                      'content-type', 'authorization', 'accept', 
                      'x-requested-with', 'referer'
                    ].includes(key.toLowerCase()))
                );
              }
              
              if (req.responseHeaders) {
                requestInfo.responseHeaders = Object.fromEntries(
                  Object.entries(req.responseHeaders)
                    .filter(([key]) => [
                      'content-type', 'content-length', 'cache-control',
                      'status', 'x-powered-by'
                    ].includes(key.toLowerCase()))
                );
              }
              
              // Add request/response body if available and is an API call
              if (req.resourceType === 'xhr' || req.resourceType === 'fetch') {
                if (req.requestPostData) {
                  try {
                    const parsedData = JSON.parse(req.requestPostData);
                    requestInfo.requestBody = parsedData;
                  } catch (e) {
                    requestInfo.requestData = req.requestPostData.substring(0, 500) + 
                      (req.requestPostData.length > 500 ? '... (truncated)' : '');
                  }
                }
                
                if (req.responseBody) {
                  try {
                    const parsedData = JSON.parse(req.responseBody);
                    requestInfo.responseBody = parsedData;
                  } catch (e) {
                    requestInfo.responseData = req.responseBody.substring(0, 500) + 
                      (req.responseBody.length > 500 ? '... (truncated)' : '');
                  }
                }
              }
              
              return requestInfo;
            });
            
            networkRequestsData = JSON.stringify(formattedRequests, null, 2);
            console.log(`✅ Captured ${networkRequests.length} network requests (${formattedRequests.length} processed for AI analysis).`);
          } else {
            // Try to get network requests from trace if available
            try {
              const tracePath = testInfo.outputPath('trace.zip');
              if (fs.existsSync(tracePath)) {
                networkRequestsData = `Network requests are available in the trace file. Use 'npx playwright show-trace ${tracePath}' to view them.`;
              } else {
                console.warn("⚠️ No network requests were captured during test execution.");
              }
            } catch (error) {
              console.warn("⚠️ No network requests were captured during test execution.");
            }
          }

          // --- Prepare AI Input ---
          const aiInput: AiAnalysisInput = {
            html: html,
            screenshotBase64: screenshotBase64,
            errorMsg: errorMsg,
            stackTrace: stackTrace,
            failingSelector: failingSelector || undefined,
            testTitle: testInfo.title,
            testCode: testCode, // Include the test code
            networkRequests: networkRequestsData // Include network request data
          };

          // --- Call AI *BEFORE* Generating HTML Report ---
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

          // Prepare Usage Info HTML (optional)
          if (aiAnalysisResult?.usageInfoMarkdown) {
            usageInfoHtml = marked.parse(aiAnalysisResult.usageInfoMarkdown) as string;
          }

          // --- Generate Report using imported function ---
          const htmlReport = generateHtmlReport({
            testInfo,
            failingSelector: failingSelector || null, // Pass null if undefined
            testCode,
            errorMsg,
            stackTrace,
            networkRequests, // Pass the full network requests array
            aiAnalysisHtml,
            usageInfoHtml
          });

          // --- Save and Attach Report using imported function ---
          await saveAndAttachReport(
            testInfo,
            htmlReport,
            aiAnalysisResult?.analysisMarkdown,
            aiAnalysisResult?.usageInfoMarkdown
          );
          // --- End Save and Attach Report ---

          console.log(`${SEPARATOR}`);
          console.log(createCenteredHeader("🤖 AI Debugging Complete 🤖"));
          console.log(`${BOTTOM_BORDER}\n`);

        } catch (processingError: unknown) {
          const errorMessage = processingError instanceof Error ? processingError.message : String(processingError);
          console.error(`\n❌ Critical error during failure processing: ${errorMessage}`, processingError);
          // Log error box
          console.log(`\n${TOP_BORDER}`);
          console.log(createCenteredHeader("❌ Context Capture/Processing Error ❌"));
          console.log(`${SEPARATOR}`);
          console.log(wrapTextInBox(errorMessage));
          console.log(`${BOTTOM_BORDER}\n`);
          // Attempt to attach a basic error report
          try {
            await testInfo.attach('ai-processing-error.txt', {
              body: `Error during AI analysis: ${errorMessage}\n\nStack trace: ${
                processingError instanceof Error ? processingError.stack : 'No stack trace available'
              }`,
              contentType: 'text/plain',
            });
          } catch (e) {
            console.error('Could not attach error details.');
          }
        }
      } else {
        // Log if test passed or page was closed
        if (testInfo.status !== 'failed' && testInfo.status !== 'timedOut') {
          // console.log(`Test "${testInfo.title}" passed. Skipping AI analysis.`);
        } else if (page.isClosed()) {
          console.warn(`⚠️ Page was closed for test "${testInfo.title}". Cannot capture context for AI analysis.`);
        } else if (!testInfo.error) {
          console.warn(`⚠️ No error object found for failed test "${testInfo.title}". Cannot perform AI analysis.`);
        }
      }
    }
  }
});

export { expect }; // Re-export expect