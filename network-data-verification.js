// Simple script to verify network request data capture
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

async function verifyNetworkCapture() {
  console.log('Starting network data capture verification...');
  
  // Create output directory
  const outputDir = path.join(process.cwd(), 'network-verification');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Launch browser and create a new context
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Store captured network requests
  const networkRequests = [];
  
  // Set up network request tracking
  const requestMap = new Map();
  let requestCounter = 0;
  
  // Listen for all network requests
  page.on('request', request => {
    const uniqueId = `req_${++requestCounter}`;
    const timestamp = new Date().toISOString();
    
    // Track request details
    const resourceType = request.resourceType();
    const requestPostData = request.postData();
    
    requestMap.set(request.url(), {
      id: uniqueId,
      url: request.url(),
      method: request.method(),
      timestamp,
      resourceType,
      requestHeaders: request.headers(),
      requestPostData
    });
    
    console.log(`Request [${uniqueId}]: ${request.method()} ${request.url()} (${resourceType})`);
  });
  
  // Listen for responses
  page.on('response', async response => {
    const url = response.url();
    const requestData = requestMap.get(url);
    
    if (requestData) {
      try {
        // Try to get response body for text-based responses
        let responseBody;
        const contentType = response.headers()['content-type'] || '';
        
        if (
          contentType.includes('json') || 
          contentType.includes('text') || 
          contentType.includes('javascript') ||
          contentType.includes('xml')
        ) {
          try {
            responseBody = await response.text().catch(() => undefined);
          } catch (textError) {
            responseBody = `[Error getting response text: ${textError.message}]`;
          }
        }
        
        // Create full request+response object
        const fullRequestData = {
          ...requestData,
          status: response.status(),
          statusText: response.statusText(),
          responseHeaders: response.headers(),
          responseBody,
          timing: {
            captured: new Date().toISOString()
          }
        };
        
        networkRequests.push(fullRequestData);
        console.log(`Response [${requestData.id}]: ${response.status()} ${response.statusText()} ${contentType ? `(${contentType})` : ''}`);
      } catch (responseError) {
        // If we fail to process the response, still add basic info
        networkRequests.push({
          ...requestData,
          status: response.status(),
          statusText: response.statusText(),
          responseHeaders: response.headers(),
          error: `Error processing response: ${responseError.message}`
        });
        
        console.log(`Response Error [${requestData.id}]: ${responseError.message}`);
      }
      
      // Remove from map
      requestMap.delete(url);
    }
  });
  
  try {
    // Navigate to test page
    console.log('\nNavigating to test page...');
    await page.goto('https://jsonplaceholder.typicode.com/');
    await page.waitForLoadState('networkidle');
    
    // Make some test API calls
    console.log('\nMaking test API calls...');
    await page.evaluate(() => {
      // Log to browser console
      console.log('Making test API calls from browser...');
      
      // GET request
      fetch('https://jsonplaceholder.typicode.com/posts/1')
        .then(r => r.json())
        .then(d => console.log('GET response:', d));
      
      // POST request
      fetch('https://jsonplaceholder.typicode.com/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Network Test Post',
          body: 'Testing request data capture',
          userId: 123
        }),
        headers: {
          'Content-type': 'application/json; charset=UTF-8',
          'X-Test-Header': 'verification-test'
        }
      })
        .then(r => r.json())
        .then(d => console.log('POST response:', d));
      
      // PUT request
      fetch('https://jsonplaceholder.typicode.com/posts/1', {
        method: 'PUT',
        body: JSON.stringify({
          id: 1,
          title: 'Updated Title',
          body: 'Updated content for testing',
          userId: 456
        }),
        headers: {
          'Content-type': 'application/json; charset=UTF-8'
        }
      })
        .then(r => r.json())
        .then(d => console.log('PUT response:', d));
    });
    
    // Wait for requests to complete
    console.log('Waiting for requests to complete...');
    await page.waitForTimeout(3000);
    
    // Analyze captured data
    console.log('\n======= Network Request Capture Results =======');
    
    // Count by request type
    const requestTypes = {};
    for (const req of networkRequests) {
      requestTypes[req.resourceType] = (requestTypes[req.resourceType] || 0) + 1;
    }
    
    console.log(`Total requests captured: ${networkRequests.length}`);
    console.log('Request types:');
    for (const [type, count] of Object.entries(requestTypes)) {
      console.log(`  - ${type}: ${count}`);
    }
    
    // Count by HTTP method
    const requestMethods = {};
    for (const req of networkRequests) {
      requestMethods[req.method] = (requestMethods[req.method] || 0) + 1;
    }
    
    console.log('\nHTTP methods:');
    for (const [method, count] of Object.entries(requestMethods)) {
      console.log(`  - ${method}: ${count}`);
    }
    
    // Check for API calls with bodies
    const apiCalls = networkRequests.filter(req => 
      req.resourceType === 'xhr' || 
      req.resourceType === 'fetch' ||
      (req.responseHeaders?.['content-type'] &&
       req.responseHeaders['content-type'].includes('json'))
    );
    
    console.log(`\nAPI calls: ${apiCalls.length}`);
    
    // Check for captured request bodies
    const requestsWithBody = networkRequests.filter(req => req.requestPostData);
    console.log(`Requests with POST data: ${requestsWithBody.length}`);
    
    // Check for captured response bodies
    const responsesWithBody = networkRequests.filter(req => req.responseBody);
    console.log(`Responses with body: ${responsesWithBody.length}`);
    
    // Save full data to file for inspection
    const outputFile = path.join(outputDir, 'network-requests.json');
    fs.writeFileSync(
      outputFile, 
      JSON.stringify({
        timestamp: new Date().toISOString(),
        totalRequests: networkRequests.length,
        requestTypes,
        requestMethods,
        apiCalls: apiCalls.length,
        requestsWithBody: requestsWithBody.length,
        responsesWithBody: responsesWithBody.length,
        requests: networkRequests
      }, null, 2)
    );
    
    console.log(`\nDetailed request data saved to: ${outputFile}`);
    console.log('===============================================');
    
    // Optional: Write a simple HTML report for visual inspection
    const htmlOutput = path.join(outputDir, 'network-analysis-report.html');
    const html = generateHtmlReport(networkRequests);
    fs.writeFileSync(htmlOutput, html);
    console.log(`HTML report saved to: ${htmlOutput}`);
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }
}

function generateHtmlReport(requests) {
  // Simple HTML to display the requests
  const requestRows = requests.map((req, index) => {
    const responseBody = req.responseBody 
      ? (req.responseBody.length > 500 
          ? `${req.responseBody.substring(0, 500)}... (truncated)`
          : req.responseBody)
      : 'N/A';
      
    const requestData = req.requestPostData 
      ? (req.requestPostData.length > 500 
          ? `${req.requestPostData.substring(0, 500)}... (truncated)`
          : req.requestPostData)
      : 'N/A';
    
    return `
    <tr class="req-row">
      <td>${req.id || index}</td>
      <td>${req.method}</td>
      <td>${req.resourceType}</td>
      <td class="url-cell">${req.url}</td>
      <td>${req.status || 'N/A'}</td>
      <td>${req.responseHeaders?.['content-type'] || 'N/A'}</td>
      <td>
        <button onclick="toggleDetails('req-${index}')">View</button>
      </td>
    </tr>
    <tr id="req-${index}" class="details-row hidden">
      <td colspan="7">
        <div class="details-container">
          <div class="details-section">
            <h4>Request Headers</h4>
            <pre>${JSON.stringify(req.requestHeaders || {}, null, 2)}</pre>
          </div>
          
          <div class="details-section">
            <h4>Request Data</h4>
            <pre>${escapeHtml(requestData)}</pre>
          </div>
          
          <div class="details-section">
            <h4>Response Headers</h4>
            <pre>${JSON.stringify(req.responseHeaders || {}, null, 2)}</pre>
          </div>
          
          <div class="details-section">
            <h4>Response Body</h4>
            <pre>${escapeHtml(responseBody)}</pre>
          </div>
        </div>
      </td>
    </tr>
    `;
  }).join('');
  
  return `<!DOCTYPE html>
<html>
<head>
  <title>Network Request Verification</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; }
    th, td { padding: 10px; text-align: left; border: 1px solid #ddd; }
    th { background: #f2f2f2; }
    .url-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hidden { display: none; }
    .details-container { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .details-section { margin-bottom: 10px; }
    .details-section h4 { margin: 0 0 5px 0; }
    pre { background: #f8f8f8; padding: 10px; border-radius: 4px; overflow: auto; max-height: 200px; }
    button { padding: 8px 12px; cursor: pointer; }
    .req-row { background: white; }
    .req-row:nth-child(4n+1) { background: #f9f9f9; }
  </style>
</head>
<body>
  <h1>Network Request Verification</h1>
  <p>Total requests captured: ${requests.length}</p>
  
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Method</th>
        <th>Type</th>
        <th>URL</th>
        <th>Status</th>
        <th>Content-Type</th>
        <th>Details</th>
      </tr>
    </thead>
    <tbody>
      ${requestRows}
    </tbody>
  </table>
  
  <script>
    function toggleDetails(id) {
      const element = document.getElementById(id);
      if (element.classList.contains('hidden')) {
        element.classList.remove('hidden');
      } else {
        element.classList.add('hidden');
      }
    }
  </script>
</body>
</html>`;
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
  if (!unsafe) return 'N/A';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Run the verification
verifyNetworkCapture().catch(console.error);