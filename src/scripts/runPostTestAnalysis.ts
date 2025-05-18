/**
 * Script to run post-test analysis on completed tests
 * This should be run after all tests have completed to ensure video files are available
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runPostTestAnalysis } from '../modules/postTestAnalysis';
import { TestInfo } from '@playwright/test';
import { exec } from 'node:child_process';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Mock TestInfo interface for reconstructing test info from results
interface MockTestInfo {
  title: string;
  outputDir: string;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped';
  error?: Error;
  attachments: Array<{
    name: string;
    contentType: string;
    path?: string;
    body?: Buffer;
  }>;
}

/**
 * Finds and analyzes failed tests in the test-results directory
 */
async function analyzeFailedTests() {
  console.log('🔍 Looking for failed tests to analyze...');
  
  const testResultsDir = path.resolve(process.cwd(), 'test-results');
  if (!fs.existsSync(testResultsDir)) {
    console.error(`❌ Test results directory not found: ${testResultsDir}`);
    return;
  }
  
  // Find test result directories
  const testDirs = fs.readdirSync(testResultsDir)
    .filter(item => {
      const itemPath = path.join(testResultsDir, item);
      return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
    });
  
  console.log(`Found ${testDirs.length} test result directories.`);
  
  let analyzedCount = 0;
  
  for (const testDir of testDirs) {
    const testDirPath = path.join(testResultsDir, testDir);
    
    // Check if this is a failed test by looking for error attachments
    const attachmentsDir = path.join(testDirPath, 'attachments');
    if (!fs.existsSync(attachmentsDir)) {
      continue; // No attachments, probably not a failed test
    }
    
    // Look for error-related attachments
    const hasErrorAttachments = fs.existsSync(path.join(testDirPath, 'test-failed-1.png'));
    
    if (!hasErrorAttachments) {
      continue; // Not a failed test
    }
    
    console.log(`\n📁 Found failed test: ${testDir}`);
    
    // Reconstruct test info
    const mockTestInfo: MockTestInfo = {
      title: testDir.replace(/-/g, ' ').replace(/chromium$/, '').trim(),
      outputDir: testDirPath,
      status: 'failed',
      attachments: []
    };
    
    // Add attachments
    if (fs.existsSync(attachmentsDir)) {
      const attachmentFiles = fs.readdirSync(attachmentsDir);
      for (const file of attachmentFiles) {
        const filePath = path.join(attachmentsDir, file);
        let contentType = 'text/plain';
        
        if (file.endsWith('.png')) contentType = 'image/png';
        else if (file.endsWith('.html')) contentType = 'text/html';
        else if (file.endsWith('.webm')) contentType = 'video/webm';
        else if (file.endsWith('.mp4')) contentType = 'video/mp4';
        
        mockTestInfo.attachments.push({
          name: file.split('-')[0], // Use first part of filename as attachment name
          contentType,
          path: filePath
        });
      }
    }
    
    // Add screenshot attachment if it exists
    const screenshotPath = path.join(testDirPath, 'test-failed-1.png');
    if (fs.existsSync(screenshotPath)) {
      mockTestInfo.attachments.push({
        name: 'screenshot',
        contentType: 'image/png',
        path: screenshotPath
      });
    }
    
    // Add video attachment if it exists
    const videoPath = path.join(testDirPath, 'video.webm');
    if (fs.existsSync(videoPath)) {
      mockTestInfo.attachments.push({
        name: 'video',
        contentType: 'video/webm',
        path: videoPath
      });
    }
    
    // Create mock error
    const mockError = new Error('Test failed during execution');
    mockTestInfo.error = mockError;
    
    // Run post-test analysis
    try {
      const result = await runPostTestAnalysis(mockTestInfo as unknown as TestInfo, mockError);
      
      if (result.reportPath) {
        console.log(`📊 Analysis complete. Report saved to: ${result.reportPath}`);
        
        // Open the report in the default browser
        try {
          const platform = process.platform;
          if (platform === 'darwin') {
            // macOS
            exec(`open "${result.reportPath}"`);
          } else if (platform === 'win32') {
            // Windows
            exec(`start "" "${result.reportPath}"`);
          } else if (platform === 'linux') {
            // Linux
            exec(`xdg-open "${result.reportPath}"`);
          }
        } catch (error) {
          console.warn(`⚠️ Could not open report automatically: ${error}`);
        }
      }
      
      analyzedCount++;
    } catch (error) {
      console.error(`❌ Error analyzing test ${testDir}: ${error}`);
    }
  }
  
  console.log(`\n✅ Post-test analysis complete. Analyzed ${analyzedCount} failed tests.`);
}

// Run the analysis
analyzeFailedTests().catch(error => {
  console.error('❌ Fatal error during post-test analysis:', error);
  process.exit(1);
});
