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
import { extractSelectorFromError } from './errorUtils'; // Assuming './errorUtils.ts'
import * as fs from 'node:fs';

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

// Helper function to escape HTML characters (remains the same)
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
    // Start tracing before using the context
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true
    });
    
    await use(context);
    
    // After the test runs, stop tracing and save to a file
    if (testInfo.status !== 'passed') {
      await context.tracing.stop({
        path: testInfo.outputPath('trace.zip')
      });
    } else {
      await context.tracing.stop();
    }
  },

  // Define an afterEach hook
  async page({ page }, use, testInfo: TestInfo) {
    // Store captured network requests
    const networkRequests: Array<{
      url: string;
      method: string;
      status?: number;
      timestamp: string;
      requestHeaders?: Record<string, string>;
      responseHeaders?: Record<string, string>;
    }> = [];
    
    // Store request-response pairs for correlation
    const requestMap = new Map<string, {
      url: string;
      method: string;
      timestamp: string;
      requestHeaders: Record<string, string>;
    }>();
    
    // Generate a unique ID counter
    let requestCounter = 0;
    
    // Listen for network requests
    page.on('request', request => {
      const uniqueId = `req_${++requestCounter}`;
      const timestamp = new Date().toISOString();
      
      // Only track important network requests (not images, fonts, etc.)
      if (
        request.resourceType() === 'xhr' ||
        request.resourceType() === 'fetch' ||
        request.resourceType() === 'document'
      ) {
        requestMap.set(request.url(), {
          url: request.url(),
          method: request.method(),
          timestamp,
          requestHeaders: request.headers()
        });
      }
    });
    
    // Listen for responses
    page.on('response', response => {
      const url = response.url();
      const requestData = requestMap.get(url);
      
      if (requestData) {
        networkRequests.push({
          ...requestData,
          status: response.status(),
          responseHeaders: response.headers()
        });
        
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
            // Limit to last 20 requests if there are too many
            const relevantRequests = networkRequests.slice(-20);
            
            // Format nicely for AI analysis
            const formattedRequests = relevantRequests.map(req => ({
              url: req.url,
              method: req.method,
              status: req.status || 'No status',
              timestamp: req.timestamp,
              requestHeaders: req.requestHeaders ?
                Object.fromEntries(
                  Object.entries(req.requestHeaders)
                    .filter(([key]) => ['content-type', 'authorization', 'accept'].includes(key.toLowerCase()))
                ) : {},
              responseHeaders: req.responseHeaders ?
                Object.fromEntries(
                  Object.entries(req.responseHeaders)
                    .filter(([key]) => ['content-type'].includes(key.toLowerCase()))
                ) : {}
            }));
            
            networkRequestsData = JSON.stringify(formattedRequests, null, 2);
            console.log(`✅ Captured ${formattedRequests.length} network requests from test execution.`);
          } else {
            // Try to get network requests from trace
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

          // --- Generate Final HTML Report ---
          const reportTitle = `AI Debug Analysis: ${escapeHtml(testInfo.title)}`;
          const backgroundImageUrlCss = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('https://preview.redd.it/macos-sonoma-wallpapers-5120x2160-v0-j9vwvbq8h5wb1.jpg?width=5120&format=pjpg&auto=webp&s=943e6f75b62ea11c987d13b3ba7091abecd48ab6')`; // Example URL - Replace if needed

          const glassmorphismHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportTitle}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* Reset box model for consistent layout */
        * {
            box-sizing: border-box;
        }

        /* --- Fix for full-height background --- */
        html {
            position: relative; /* Establish positioning context for ::before */
            min-height: 100%;   /* Ensure html takes full height */
        }

        html::before { /* Apply background to html pseudo-element */
            content: '';
            position: absolute; /* Position relative to <html> */
            top: 0; left: 0; right: 0; bottom: 0; /* Cover <html> */
            z-index: -1;

            background-image: ${backgroundImageUrlCss};
            background-size: cover, cover;
            background-position: center center, center center;
            background-attachment: fixed;

            filter: blur(10px);
            -webkit-filter: blur(10px);
            transform: scale(1.05);
        }
        /* --- End Fix --- */


        /* --- Core Styles --- */
        body {
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            box-sizing: border-box;
            position: relative;
            overflow-x: hidden;
            background-color: #1a202c;
        }

        .glass-effect {
            background: rgba(0, 0, 0, 0.55);
            backdrop-filter: blur(16px) saturate(150%);
            -webkit-backdrop-filter: blur(16px) saturate(150%);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.35);
            position: relative;
            z-index: 1;
            color: #e5e7eb;
        }

        /* --- Styles for rendered Markdown --- */
        .ai-content-area h3 { font-size: 1.1rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; color: #f9fafb; }
        .ai-content-area p { margin-bottom: 0.75rem; line-height: 1.6; }
        .ai-content-area code { background-color: rgba(0, 0, 0, 0.4); border-radius: 4px; padding: 3px 6px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 0.9em; border: 1px solid rgba(255, 255, 255, 0.3); color: #93c5fd; display: inline-block; }
        .ai-content-area pre { background-color: rgba(0,0,0,0.4); padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; overflow-x: auto;}
        .ai-content-area pre code { display: block; white-space: pre; padding: 0; border: none; background: none; }
        .ai-content-area strong { font-weight: 600; color: #dbeafe; }
        .ai-content-area ul, .ai-content-area ol { margin-left: 1.5rem; margin-bottom: 1rem; list-style: revert; }
        .ai-content-area li { margin-bottom: 0.25rem; }
        .ai-content-area hr { border-color: rgba(255, 255, 255, 0.2); margin-top: 1rem; margin-bottom: 1rem; border-top-width: 1px;}
        .ai-content-area table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
        .ai-content-area th, .ai-content-area td { border: 1px solid rgba(255, 255, 255, 0.3); padding: 0.5rem; text-align: left; }
        .ai-content-area th { background-color: rgba(255, 255, 255, 0.1); font-weight: 600; }
        .ai-content-area details { background-color: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 0.5rem; margin-bottom: 1rem;}
        .ai-content-area summary { cursor: pointer; font-weight: 500; }


        /* --- Heading Styles --- */
        h2, h3 {
            text-align: left !important;
            position: relative !important;
            font-family: 'Inter', sans-serif !important;
            color: white !important;
        }

        /* Professional section styling */
        .glass-effect {
            padding: 1.75rem 2rem !important;
        }

        /* Heading styles */
        .glass-effect h2,
        .glass-effect h3 {
            padding: 0 0 0.75rem 0 !important;
            margin: 0 0 1.25rem 0 !important;
            font-weight: bold !important;
            letter-spacing: 0.01em !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
        }

        /* Content padding */
        .glass-effect p,
        .glass-effect div:not(.ai-content-area) {
            padding: 0 0 0.5rem 0.5rem !important;
            margin: 0 !important;
        }

        /* Special case for the first paragraph after a heading */
        .glass-effect h2 + p,
        .glass-effect h3 + p {
            margin-top: 0.5rem !important;
        }

        /* AI content proper padding */
        .ai-content-area {
            padding: 0 0 0 0.3rem !important;
            margin-top: 0.5rem !important;
        }

        /* Remove these conflicting rules */

        /* --- Icon Styles --- */
        @font-face { font-family: 'LucideIcons'; src: url(https://cdn.jsdelivr.net/npm/lucide-static@0.473.0/font/lucide.ttf) format('truetype'); }
        .lucide {
            font-family: 'LucideIcons';
            font-size: 1.2em;
            line-height: 1;
            vertical-align: middle;
            margin-right: 0.25em;
            display: inline-block;
            width: 1.2em;
            text-align: center;
        }
        .lucide-clipboard-list::before { content: "\\e888"; color: #a5b4fc; }
        .lucide-lightbulb::before { content: "\\eb1f"; color: #fbbf24; }
        .lucide-alert-triangle::before { content: "\\e6c7"; color: #f87171; }
        .lucide-brain-circuit::before { content: "\\ed94"; color: #86efac; }
        .lucide-bar-chart-big::before { content: "\\e7e8"; color: #facc15; }


        /* --- Other Helper Styles --- */
        code.inline-code {
            border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; padding: 2px 5px;
            font-size: 0.9em; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
            background-color: rgba(0,0,0,0.3); color: #93c5fd;
        }
        code.error-block-code {
             display: block; background-color: rgba(153, 27, 27, 0.3); border: 1px solid rgba(220, 38, 38, 0.5);
             padding: 0.75rem; border-radius: 0.375rem; color: #fecaca; font-size: 0.75rem;
             font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
             overflow-x: auto; white-space: pre-wrap; word-break: break-all;
        }
        details > summary { cursor: pointer; color: #d1d5db; }
        details > summary:hover { color: #f9fafb; }
        details > pre { margin-top: 0.25rem; padding: 0.5rem; background-color: rgba(0, 0, 0, 0.4); border-radius: 0.375rem; font-size: 0.75rem; color: #d1d5db; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
        details > pre > code { background-color: transparent; border: none; padding: 0; color: inherit; display: block; }

    </style>
    <script>
        tailwind.config = { theme: { extend: { fontFamily: { sans: ['Inter', 'sans-serif'] } } } }
    </script>
</head>
<body>
    <main class="flex flex-col items-center space-y-8 w-full min-h-screen p-4 md:p-8">

        <div class="glass-effect rounded-2xl max-w-3xl w-full">
            <h2 class="text-2xl md:text-3xl font-bold text-white mb-2">Test Run Details</h2>
             <p><strong>Test:</strong> ${escapeHtml(testInfo.title)}</p>
             <p><strong>Status:</strong> <strong class="font-semibold ${testInfo.status === 'failed' ? 'text-red-300' : 'text-orange-300'}">${escapeHtml(testInfo.status)}</strong></p>
             <p><strong>Duration:</strong> ${testInfo.duration}ms</p>
             ${failingSelector ? `<p><strong>Failing Selector:</strong> <code class="inline-code">${escapeHtml(failingSelector)}</code></p>` : ''}
             ${testCode ? `
             <div class="mt-4">
               <p><strong>Test Code:</strong></p>
               <pre class="bg-gray-800 text-gray-200 p-3 rounded-md text-sm overflow-x-auto mt-2"><code>${escapeHtml(testCode)}</code></pre>
             </div>
             ` : ''}
        </div>

         <div class="glass-effect rounded-2xl max-w-3xl w-full">
            <h3 class="text-lg md:text-xl font-semibold text-gray-50 mb-3">Failure Details</h3>
            <p class="text-sm md:text-base leading-relaxed text-gray-200 mb-3">
                 The test failed${failingSelector ? ` possibly while interacting with the element targeted by <code class="inline-code">${escapeHtml(failingSelector)}</code>` : ''}. See the error message and stack trace below.
            </p>
            <div class="mt-4 text-sm space-y-3">
                <p><strong class="font-medium text-gray-50">Error Message:</strong>
                    <code class="error-block-code">${escapeHtml(errorMsg)}</code>
                </p>
                ${stackTrace ? `<details class="mt-2">
                        <summary>Show Stack Trace</summary>
                        <pre><code>${escapeHtml(stackTrace)}</code></pre>
                    </details>` : ''}
            </div>
        </div>

        ${networkRequests.length > 0 ? `
        <div class="glass-effect rounded-2xl max-w-3xl w-full">
           <h3 class="text-lg md:text-xl font-semibold text-gray-50 mb-3">Network Requests</h3>
           <p class="text-sm md:text-base leading-relaxed text-gray-200 mb-3">
               The following network requests were captured during test execution.
           </p>
           <div class="overflow-x-auto">
               <table class="w-full text-sm text-left text-gray-200">
                   <thead class="text-xs uppercase bg-gray-800 bg-opacity-50 text-gray-300">
                       <tr>
                           <th class="px-4 py-2">Method</th>
                           <th class="px-4 py-2">URL</th>
                           <th class="px-4 py-2">Status</th>
                           <th class="px-4 py-2">Content-Type</th>
                       </tr>
                   </thead>
                   <tbody>
                       ${networkRequests.map(req => `
                       <tr class="bg-gray-800 bg-opacity-20 border-b border-gray-700">
                           <td class="px-4 py-2 font-medium ${req.method === 'GET' ? 'text-blue-300' : req.method === 'POST' ? 'text-green-300' : req.method === 'PUT' ? 'text-yellow-300' : req.method === 'DELETE' ? 'text-red-300' : 'text-gray-300'}">${escapeHtml(req.method)}</td>
                           <td class="px-4 py-2 font-mono text-xs overflow-hidden overflow-ellipsis" style="max-width: 200px;">${escapeHtml(req.url)}</td>
                           <td class="px-4 py-2 ${(req.status && req.status >= 200 && req.status < 300) ? 'text-green-300' : (req.status && req.status >= 400) ? 'text-red-300' : 'text-gray-300'}">${req.status || 'N/A'}</td>
                           <td class="px-4 py-2 font-mono text-xs">${escapeHtml(req.responseHeaders?.['content-type'] || 'N/A')}</td>
                       </tr>
                       `).join('')}
                   </tbody>
               </table>
           </div>
           <details class="mt-4">
               <summary class="cursor-pointer text-gray-300 hover:text-white">View Raw Network Data</summary>
               <pre class="mt-2 bg-gray-800 bg-opacity-50 p-3 rounded text-xs overflow-x-auto">${escapeHtml(JSON.stringify(networkRequests, null, 2))}</pre>
           </details>
        </div>
        ` : ''}

         <div class="glass-effect rounded-2xl max-w-3xl w-full">
           <h3 class="text-lg md:text-xl font-semibold text-gray-50 mb-4">AI Debugging Analysis</h3>
            <div class="ai-content-area text-sm md:text-base leading-relaxed text-gray-200">
                ${aiAnalysisHtml}
            </div>
        </div>

        ${usageInfoHtml ? `
        <div class="glass-effect rounded-2xl max-w-3xl w-full">
             <h3 class="text-lg md:text-xl font-semibold text-gray-50 mb-4">AI Usage & Estimated Cost</h3>
             <div class="ai-content-area text-sm">
                 ${usageInfoHtml}
             </div>
        </div>
        ` : ''}

    </main>
</body>
</html>
`; // --- End HTML Generation ---

          // --- Attach the FINAL HTML Report ---
          try {
            await testInfo.attach('ai-debug-analysis.html', {
              body: glassmorphismHtml,
              contentType: 'text/html',
            });
            console.log(`✅ Successfully attached 'ai-debug-analysis.html' report.`);
          } catch (attachError: unknown) {
            const errorMessage = attachError instanceof Error ? attachError.message : String(attachError);
            console.error(`\n❌ Error attaching HTML report: ${errorMessage}`, attachError);
          }

          // --- Log AI analysis completion to console, but don't modify error stack ---
          console.log(`\n${SEPARATOR}\n${createCenteredHeader("💡 AI Debugging Complete 💡")}\n${SEPARATOR}`);
          console.log("AI analysis results attached to test report.");
          console.log("View HTML report and markdown attachment for details.");

          // --- Optional: Attach raw markdown as separate text file ---
          try {
            const rawAiContent = aiAnalysisResult?.errorMarkdown ?? aiAnalysisResult?.analysisMarkdown ?? "No AI content.";
            await testInfo.attach('ai-suggestions-raw.md', {
              body: `# AI Debugging Analysis\n\n${rawAiContent}\n\n---\n\n# Usage\n\n${aiAnalysisResult?.usageInfoMarkdown ?? "N/A"}`,
              contentType: 'text/markdown',
            });
            console.log(`✅ Successfully attached 'ai-suggestions-raw.md'.`);
          } catch (attachError: unknown) {
            const errorMessage = attachError instanceof Error ? attachError.message : String(attachError);
            console.warn(`⚠️ Could not attach AI suggestions as markdown file: ${errorMessage}`);
          }

        } catch (captureError: unknown) {
          // --- Log Overall Capture/Processing Error ---
          const errorMessage = captureError instanceof Error ? captureError.message : String(captureError);
          console.error(`\n❌ Critical error during failure processing: ${errorMessage}`, captureError);
          const captureErrorBox = `
${TOP_BORDER}
${createCenteredHeader("❌ Context Capture/Processing Error ❌")}
${SEPARATOR}
${wrapTextInBox("Failed to capture context, generate report, or call AI.")}
${wrapTextInBox(`Error: ${errorMessage}`)}
${BOTTOM_BORDER}
`;
          console.error(captureErrorBox);
          // Log error but don't modify stack trace
          console.error(`Context capture or AI processing failed: ${errorMessage}`);
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
      } else if (page.isClosed()) {
        // --- Log Page Closed Warning --- (Same as before)
        console.warn(`\n${TOP_BORDER}`);
        console.warn(createCenteredHeader("⚠️ Page Closed Warning ⚠️"));
        console.warn(`${SEPARATOR}`);
        console.warn(wrapTextInBox(`Page was closed before context could be captured for AI analysis. Test: ${testInfo.title}`));
        console.warn(`${BOTTOM_BORDER}`);
        // Log warning but don't modify error stack
        try {
          await testInfo.attach('ai-analysis-skipped.txt', {
            body: 'Page was closed before context could be captured for AI analysis.',
            contentType: 'text/plain',
          });
        } catch (e) {
          console.error('Could not attach warning details.');
        }
      } else if (!testInfo.error) {
        // --- Log No Error Object Warning --- (Same as before)
        console.warn(`\n${TOP_BORDER}`);
        console.warn(createCenteredHeader("⚠️ No Error Info Warning ⚠️"));
        console.warn(`${SEPARATOR}`);
        console.warn(wrapTextInBox(`Test status is '${testInfo.status}' but no error object was found. Cannot perform AI analysis. Test: ${testInfo.title}`));
        console.warn(`${BOTTOM_BORDER}`);
      }
    }
  }
});

// Re-export expect
export { expect } from '@playwright/test';