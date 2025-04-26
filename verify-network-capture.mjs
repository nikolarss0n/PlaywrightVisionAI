// ES Module script to verify network capture
import { chromium } from '@playwright/test';
import { setupAiDebugging, runAiDebuggingAnalysis } from './dist/index.js';
import fs from 'fs';
import path from 'path';

// Create output directory for the test
const outputDir = path.join(process.cwd(), 'test-output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function runVerificationTest() {
  console.log('Starting verification test for network request capture...');
  
  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // First make a regular page request
    await page.goto('https://jsonplaceholder.typicode.com/');
    await page.waitForLoadState('networkidle');
    console.log('✅ Loaded main page');
    
    // Make some XHR/fetch requests with different methods
    await page.evaluate(() => {
      console.log('Beginning network request tests...');
      
      // GET request
      fetch('https://jsonplaceholder.typicode.com/posts/1')
        .then(r => r.json())
        .then(data => console.log('GET response:', data));
      
      // POST request
      fetch('https://jsonplaceholder.typicode.com/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Network Test Post',
          body: 'This is a verification test for network request capture',
          userId: 123,
        }),
        headers: {
          'Content-type': 'application/json; charset=UTF-8',
          'X-Test-Header': 'network-verification',
        },
      })
        .then(r => r.json())
        .then(data => console.log('POST response:', data));
      
      // PUT request
      fetch('https://jsonplaceholder.typicode.com/posts/1', {
        method: 'PUT',
        body: JSON.stringify({
          id: 1,
          title: 'Updated Test Title',
          body: 'Updated test body text for verification',
          userId: 456,
        }),
        headers: {
          'Content-type': 'application/json; charset=UTF-8',
        },
      })
        .then(r => r.json())
        .then(data => console.log('PUT response:', data));
      
      console.log('All test requests sent!');
    });
    
    // Wait for network requests to complete
    console.log('Waiting for network requests to complete...');
    await page.waitForTimeout(3000);
    
    // Create a fake test info object
    const testInfo = {
      title: 'Network Request Capture Verification',
      file: path.join(process.cwd(), 'verify-network-capture.mjs'),
      outputDir,
      outputPath: (fileName) => path.join(outputDir, fileName),
      attachments: [],
      attach: async (name, options) => {
        if (options.path) {
          // Copy file to output directory
          const content = fs.readFileSync(options.path);
          const outputPath = path.join(outputDir, name);
          fs.writeFileSync(outputPath, content);
          console.log(`Attached ${name} from ${options.path}`);
        } else if (options.body) {
          // Write content to file
          const outputPath = path.join(outputDir, name);
          fs.writeFileSync(outputPath, options.body);
          console.log(`Created attachment: ${outputPath}`);
        }
        testInfo.attachments.push({
          name,
          contentType: options.contentType || 'application/octet-stream',
          path: path.join(outputDir, name)
        });
      },
      status: 'failed',
      duration: 3000,
      error: new Error('EXPECTED FAILURE: This test fails intentionally to generate the AI debug report with network requests')
    };
    
    // Run the AI debugging analysis manually
    console.log('Running AI debugging analysis...');
    await runAiDebuggingAnalysis(page, testInfo, testInfo.error);
    
    console.log(`\n✅ Verification test complete! Check the debug reports in ${outputDir}`);
    
  } catch (error) {
    console.error('Error during verification test:', error);
  } finally {
    await context.close();
    await browser.close();
  }
}

runVerificationTest().catch(console.error);