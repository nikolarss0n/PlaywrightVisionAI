/**
 * Module for capturing network requests
 */
import { Page, TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import { NetworkRequest } from './types';

/**
 * Sets up network request capturing for a page
 */
export function setupNetworkCapture(page: Page): {
  networkRequests: NetworkRequest[];
  teardown: () => void;
} {
  const networkRequests: NetworkRequest[] = [];
  const requestMap = new Map<string, {
    url: string;
    method: string;
    timestamp: string;
    resourceType: string;
    requestHeaders: Record<string, string>;
    requestPostData?: string;
  }>();
  let requestCounter = 0;
  
  // Store request event listener for cleanup
  const requestListener = (request: any) => {
    const uniqueId = `req_${++requestCounter}`;
    const timestamp = new Date().toISOString();
    
    // Store all request types but prioritize API calls
    const resourceType = request.resourceType();
    let requestPostData;
    
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
      requestPostData
    });
  };
  
  // Store response event listener for cleanup
  const responseListener = async (response: any) => {
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
  };
  
  // Set up the event listeners
  page.on('request', requestListener);
  page.on('response', responseListener);
  
  // Return the array and a teardown function
  return {
    networkRequests,
    teardown: () => {
      page.off('request', requestListener);
      page.off('response', responseListener);
    }
  };
}

/**
 * Sets up automatic network capture for a test framework
 * This creates a cleaner, more elegant integration with minimal boilerplate
 * @param testObject The test object to enhance with network capture
 * @returns The enhanced test object
 */
export function setupAutomaticNetworkCapture(testObject: any): any {
  // Storage for captured network requests and teardown functions
  const testNetworkRequests = new Map<string, NetworkRequest[]>();
  const testNetworkCaptureTeardowns = new Map<string, Function>();

  // Add beforeEach hook to start capturing network requests
  testObject.beforeEach(async ({ page, context, customPage }: any, testInfo: any) => {
    // Use either the custom page, standard page, or get a page from context
    const pageToUse = customPage || page || (context ? await context.newPage() : null);
    
    if (pageToUse) {
      // Set up network capture for this test
      const { networkRequests, teardown } = setupNetworkCapture(pageToUse);
      
      // Store references for this test
      testNetworkRequests.set(testInfo.testId, networkRequests);
      testNetworkCaptureTeardowns.set(testInfo.testId, teardown);
    }
  });

  // Add afterEach hook to clean up and access captured requests
  testObject.afterEach(async ({}: any, testInfo: any) => {
    // Clean up event listeners
    const teardown = testNetworkCaptureTeardowns.get(testInfo.testId);
    if (teardown) {
      teardown();
      testNetworkCaptureTeardowns.delete(testInfo.testId);
    }
    
    // Store the network requests in testInfo for later access
    // This allows other afterEach hooks to access the captured requests
    if (testNetworkRequests.has(testInfo.testId)) {
      const requests = testNetworkRequests.get(testInfo.testId);
      // @ts-ignore: Adding a custom property to testInfo
      testInfo._capturedNetworkRequests = requests;
      
      // Clean up
      testNetworkRequests.delete(testInfo.testId);
    }
  });
  
  return testObject;
}

/**
 * Gets captured network requests from a TestInfo object
 * @param testInfo The TestInfo object potentially containing captured requests
 * @returns Array of captured network requests or empty array
 */
export function getCapturedNetworkRequests(testInfo: any): NetworkRequest[] {
  // @ts-ignore: Accessing custom property from testInfo
  return testInfo._capturedNetworkRequests || [];
}

/**
 * Formats network requests for AI analysis
 */
export function formatNetworkRequestsForAi(networkRequests: NetworkRequest[]): string {
  if (networkRequests.length === 0) {
    return "No network requests captured.";
  }
  
  // Filter only the most important requests for the AI analysis
  const apiRequestsOnly = networkRequests.filter(req => 
    req.resourceType === 'xhr' || 
    req.resourceType === 'fetch' || 
    (req.responseHeaders?.['content-type']?.includes('json') || 
     req.responseHeaders?.['content-type']?.includes('application/javascript'))
  );
  
  // Use all requests if no API requests were found
  const relevantRequests = apiRequestsOnly.length > 0 
    ? apiRequestsOnly.slice(-20)  // Limit to last 20 API requests 
    : networkRequests.slice(-20); // If no API requests, use last 20 of any type
  
  // Format nicely for AI analysis with detailed data when available
  const formattedRequests = relevantRequests.map(req => {
    // Start with basic info
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
          // Try to parse as JSON first
          const parsedData = JSON.parse(req.requestPostData);
          requestInfo.requestBody = parsedData;
        } catch (e) {
          // If not valid JSON, use as string but limit length
          requestInfo.requestData = req.requestPostData.substring(0, 500) + 
            (req.requestPostData.length > 500 ? '... (truncated)' : '');
        }
      }
      
      if (req.responseBody) {
        try {
          // Try to parse as JSON first
          const parsedData = JSON.parse(req.responseBody);
          requestInfo.responseBody = parsedData;
        } catch (e) {
          // If not valid JSON, use as string but limit length
          requestInfo.responseData = req.responseBody.substring(0, 500) + 
            (req.responseBody.length > 500 ? '... (truncated)' : '');
        }
      }
    }
    
    return requestInfo;
  });
  
  return JSON.stringify(formattedRequests, null, 2);
}

/**
 * Tries to extract network requests from test attachments
 */
export function extractNetworkRequestsFromAttachments(testInfo: TestInfo): string | undefined {
  try {
    // Check for request logs in test attachments first
    const requestsLog = testInfo.attachments.filter(a => a.name.includes('request'));
    if (requestsLog.length > 0) {
      console.log("✅ Network requests found in test attachments.");
      
      // Try to read the content of the attachment logs
      try {
        const requestAttachments = [];
        for (const attachment of requestsLog) {
          if (attachment.path) {
            try {
              const content = fs.readFileSync(attachment.path, 'utf8');
              requestAttachments.push(content);
            } catch (err) {
              // Skip if file can't be read
            }
          }
        }
        
        if (requestAttachments.length > 0) {
          return requestAttachments.join('\n\n');
        } else {
          return `Test contained ${requestsLog.length} network request logs, but content could not be read.`;
        }
      } catch (readError) {
        return `Test contained ${requestsLog.length} network request logs, but an error occurred reading them.`;
      }
    }
    
    // If no request logs, try to extract data from HAR files
    const harPath = testInfo.outputPath('trace.har');
    if (fs.existsSync(harPath)) {
      try {
        const harContent = fs.readFileSync(harPath, 'utf8');
        const harData = JSON.parse(harContent);
        if (harData.log?.entries) {
          const lastRequests = harData.log.entries.slice(-20); // Get last 20 entries
          console.log(`✅ Extracted ${lastRequests.length} requests from HAR file.`);
          return JSON.stringify(lastRequests, null, 2);
        }
      } catch (harError) {
        console.warn(`⚠️ Error parsing HAR file: ${harError instanceof Error ? harError.message : String(harError)}`);
      }
    }
    
    // Last resort: check if any trace info is available
    const traceFiles = testInfo.attachments.filter(a => a.name.includes('trace') || a.contentType === 'application/zip');
    if (traceFiles.length > 0) {
      return `Test contains ${traceFiles.length} trace files which may contain network requests. Use Playwright Trace Viewer to examine them.`;
    }
    
    return "No network requests captured from attachments. Use live network capture instead.";
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error extracting network requests from attachments: ${message}`;
  }
}