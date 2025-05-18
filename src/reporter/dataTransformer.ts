/**
 * Data Transformer for Playwright Vision Reporter
 * Converts trace data to AI-friendly format
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TraceData } from './traceReader';
import { AiAnalysisInput, NetworkRequest } from '../modules/types';

/**
 * Extract test code from a source file
 */
export function extractTestCode(filePath: string, title: string): string | undefined {
  try {
    if (!fs.existsSync(filePath)) {
      return undefined;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Look for the test with the given title
    const testRegex = new RegExp(`test\\(['"]${escapeRegExp(title)}['"]`);
    const arrowFnTestRegex = new RegExp(`test\\s*[('"]${escapeRegExp(title)}['")](\\s*,\\s*async)?\\s*\\(`);

    let testStartLine = -1;
    let braceCount = 0;
    let inTest = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!inTest) {
        if (testRegex.test(line) || arrowFnTestRegex.test(line)) {
          testStartLine = i;
          inTest = true;
          // Count opening braces on this line
          braceCount += (line.match(/\{/g) || []).length;
          braceCount -= (line.match(/\}/g) || []).length;
        }
      } else {
        // Update brace count
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;

        // If braces are balanced, we've found the end of the test
        if (braceCount === 0) {
          // Extract the test code
          return lines.slice(testStartLine, i + 1).join('\n');
        }
      }
    }

    return undefined;
  } catch (error) {
    console.error(`Error extracting test code: ${error}`);
    return undefined;
  }
}

/**
 * Helper function to escape special characters in regex
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert trace data to AI analysis input format
 */
export function traceDataToAiInput(
  traceData: TraceData,
  screenshotBase64?: string
): AiAnalysisInput {
  // Extract failing selector from error message if possible
  let failingSelector: string | undefined;
  const selectorRegex = /(getByRole|getByText|getByLabel|getByPlaceholder|getByTestId|querySelector|locator|getByTitle)\(['"]([^'"]+)['"]/;
  const match = traceData.errorMessage.match(selectorRegex);
  if (match) {
    failingSelector = match[2];
  }

  // Format the AI input
  const aiInput: AiAnalysisInput = {
    html: traceData.html,
    screenshotBase64,
    errorMsg: traceData.errorMessage,
    stackTrace: traceData.stackTrace,
    failingSelector,
    testTitle: traceData.testInfo.title,
    testCode: undefined, // Will be set if the file is found
    networkRequests: formatNetworkRequests(traceData.networkRequests)
  };

  return aiInput;
}

/**
 * Format network requests for AI analysis
 */
function formatNetworkRequests(requests: NetworkRequest[]): string {
  if (requests.length === 0) {
    return '';
  }

  // Sort requests by timestamp
  const sortedRequests = [...requests].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
  });

  // Format requests for AI input (limit to the most recent 20 requests)
  const recentRequests = sortedRequests.slice(-20);
  return recentRequests.map((req, index) => {
    const status = req.status ? `${req.status}` : 'Unknown';
    const statusClass = req.status ? (req.status >= 400 ? 'Error' : req.status >= 300 ? 'Redirect' : 'Success') : 'Unknown';
    
    let output = `${index + 1}. ${req.method} ${req.url} - ${status} (${statusClass})`;
    
    if (req.resourceType) {
      output += `\n   Type: ${req.resourceType}`;
    }
    
    if (req.requestHeaders && Object.keys(req.requestHeaders).length > 0) {
      output += `\n   Headers: ${JSON.stringify(req.requestHeaders)}`;
    }
    
    if (req.requestPostData) {
      output += `\n   Request Body: ${req.requestPostData}`;
    }
    
    if (req.responseBody) {
      // Truncate very long responses
      const body = req.responseBody.length > 500 
        ? `${req.responseBody.substring(0, 500)}... [truncated]`
        : req.responseBody;
      
      output += `\n   Response: ${body}`;
    }
    
    return output;
  }).join('\n\n');
}