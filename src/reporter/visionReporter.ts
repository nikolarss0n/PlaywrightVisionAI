/**
 * Playwright Vision Reporter
 * A reporter that analyzes test failures with AI and generates beautiful reports
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Reporter, FullConfig, Suite, TestCase, TestResult, TestError } from '@playwright/test/reporter';
import { extractTraceData, findTraceFiles, screenshotToBase64, TraceData } from './traceReader';
import { runAiDebuggingAnalysis } from '../modules/core';
import { NetworkRequest } from '../modules/types';
import { loadConfig } from '../modules/configLoader';

// Reporter options
export interface VisionReporterOptions {
  outputDir?: string;
  aiProvider?: 'claude' | 'gemini' | 'both';
  openReportAutomatically?: boolean;
  maxScreenshots?: number;
}

// Default options
const DEFAULT_OPTIONS: VisionReporterOptions = {
  outputDir: 'playwright-vision-reports',
  aiProvider: 'claude',
  openReportAutomatically: true,
  maxScreenshots: 5
};

/**
 * Playwright Vision Reporter implementation
 */
export class VisionReporter implements Reporter {
  private config!: FullConfig;
  private options: VisionReporterOptions;
  private reportDir: string;
  private failedTests: Map<string, {
    testCase: TestCase;
    result: TestResult;
    error?: TestError;
  }> = new Map();

  constructor(options: VisionReporterOptions = {}) {
    // Load environment variables from .env files
    loadConfig();
    
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.reportDir = this.options.outputDir!;
  }

  /**
   * Called once at the beginning of the test run
   */
  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;

    // Create the report directory
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }

    console.log(`Playwright Vision Reporter initialized. Reports will be saved to: ${this.reportDir}`);
  }

  /**
   * Called when test ends, regardless of status
   */
  onTestEnd(test: TestCase, result: TestResult) {
    // Track failed tests for later analysis
    if (result.status === 'failed' && result.error) {
      this.failedTests.set(test.id, { testCase: test, result, error: result.error });
    }
  }

  /**
   * Called after all tests have completed
   */
  async onEnd(result: { status: 'passed' | 'failed' | 'timedout' | 'interrupted' }) {
    if (this.failedTests.size === 0) {
      console.log('No failed tests to analyze.');
      return { status: 'passed' } as const;
    }

    console.log(`Analyzing ${this.failedTests.size} failed tests...`);

    // Process traces and run AI analysis
    for (const [testId, { testCase, result, error }] of this.failedTests.entries()) {
      await this.processFailedTest(testCase, result, error);
    }

    return { status: this.failedTests.size > 0 ? 'failed' : 'passed' } as const;
  }

  /**
   * Process a failed test
   */
  private async processFailedTest(testCase: TestCase, result: TestResult, error?: TestError) {
    console.log(`Processing failed test: ${testCase.title}`);

    try {
      // Create a directory for this test
      const testDir = path.join(this.reportDir, this.sanitizeFilename(testCase.title));
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // Find trace files for this test
      let traceFiles: string[] = [];

      // Check for trace files specified in attachments
      for (const attachment of result.attachments) {
        if (attachment.name === 'trace' && attachment.path) {
          traceFiles.push(attachment.path);
        }
      }

      // If no trace files found in attachments, search in the results directory
      if (traceFiles.length === 0) {
        const testResultsDir = (this.config as any).outputDir || 'test-results';
        traceFiles = await findTraceFiles(testResultsDir);
        
        // Filter trace files based on test name
        const testNameParts = testCase.title.toLowerCase().split(' ').filter(p => p.length > 3);
        traceFiles = traceFiles.filter(file => {
          const filename = path.basename(file).toLowerCase();
          return testNameParts.some(part => filename.includes(part));
        });
      }

      if (traceFiles.length === 0) {
        console.warn(`No trace files found for test: ${testCase.title}`);
        return;
      }

      console.log(`Found ${traceFiles.length} trace files for test: ${testCase.title}`);

      // Extract data from the trace file (use the first one for now)
      const traceData = await extractTraceData(traceFiles[0], testDir);

      // Convert the extracted data to the format expected by the AI analysis
      await this.runAiAnalysis(testCase, result, error, traceData, testDir);

    } catch (err) {
      console.error(`Error processing failed test ${testCase.title}:`, err);
    }
  }

  /**
   * Run AI analysis on the extracted trace data
   */
  private async runAiAnalysis(
    testCase: TestCase,
    testResult: TestResult,
    error: TestError | undefined,
    traceData: TraceData,
    outputDir: string
  ) {
    try {
      // Create mock TestInfo object
      const mockTestInfo: any = {
        title: testCase.title,
        file: testCase.location.file,
        project: { name: testCase.parent.project()?.name || 'Unknown' },
        duration: testResult.duration,
        status: testResult.status,
        error: error,
        outputDir,
        attach: async (name: string, options: { path?: string, body?: string, contentType: string }) => {
          if (options.path) {
            const filename = path.basename(options.path);
            const targetPath = path.join(outputDir, filename);
            fs.copyFileSync(options.path, targetPath);
            return { name, path: targetPath, contentType: options.contentType };
          } else if (options.body) {
            const filename = `${name}-${Date.now()}.${this.getExtensionFromContentType(options.contentType)}`;
            const targetPath = path.join(outputDir, filename);
            fs.writeFileSync(targetPath, options.body);
            return { name, path: targetPath, contentType: options.contentType };
          }
          return { name, contentType: options.contentType };
        },
        attachments: []
      };

      // Create mock Page object with minimal functionality
      const mockPage: any = {
        url: () => 'mock-url',
        screenshot: async () => {
          if (traceData.screenshots.length > 0) {
            return fs.readFileSync(traceData.screenshots[traceData.screenshots.length - 1]);
          }
          return Buffer.from('');
        },
        content: async () => traceData.html,
        evaluate: async () => null,
        waitForTimeout: async () => {},
        waitForSelector: async () => null,
        locator: () => ({
          screenshot: async () => {
            if (traceData.screenshots.length > 0) {
              return fs.readFileSync(traceData.screenshots[traceData.screenshots.length - 1]);
            }
            return Buffer.from('');
          }
        })
      };

      // Convert extracted data for AI analysis
      // Ensure network requests are properly formatted with all required fields
      const networkRequests: NetworkRequest[] = traceData.networkRequests.map(req => ({
        url: req.url || '',
        method: req.method || 'GET',
        status: req.status || 0,
        timestamp: req.timestamp || new Date().toISOString(),
        resourceType: req.resourceType || 'other',
        requestHeaders: req.requestHeaders || {},
        responseHeaders: req.responseHeaders || {},
        requestPostData: req.requestPostData || null,
        responseBody: req.responseBody || ''
      }));
      const errorObj = error || { message: traceData.errorMessage, stack: traceData.stackTrace };

      // Get the latest screenshot for analysis
      let screenshotBase64: string | undefined;
      if (traceData.screenshots.length > 0) {
        const latestScreenshot = traceData.screenshots[traceData.screenshots.length - 1];
        screenshotBase64 = screenshotToBase64(latestScreenshot);
      }

      // Run AI analysis with the converted data
      console.log('Running AI analysis on trace data...');
      
      // Create a wrapper for runAiDebuggingAnalysis that doesn't use the built-in network capture
      const runAnalysisWithoutNetworkCapture = async (page: any, testInfo: any, error: any, networkRequests: any) => {
        try {
          // Import the modules we need
          const { callDebuggingAI } = require('../modules/aiCaller');
          const { extractErrorInfo, extractTestCode } = require('../modules/contextGatherer');
          const { formatNetworkRequestsForAi } = require('../modules/networkCapture');
          const { generateHtmlReport, saveAndAttachReport } = require('../modules/reportGenerator');
          const { marked } = require('marked');
          
          // Check for API keys before proceeding
          const claudeApiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
          const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
          
          // Validate API keys based on the selected provider
          const aiProvider = process.env.DEFAULT_AI_PROVIDER || this.options.aiProvider || 'claude';
          
          if ((aiProvider === 'claude' || aiProvider === 'both') && !claudeApiKey) {
            console.warn('⚠️ Claude API key is missing. Set ANTHROPIC_API_KEY or CLAUDE_API_KEY in your environment.');
            if (aiProvider === 'both' && geminiApiKey) {
              console.log('Using Gemini as fallback since Claude API key is missing.');
            } else if (aiProvider === 'claude') {
              return this.generateFallbackReport(testInfo, error, page, screenshotBase64, 'Claude API key is missing');
            }
          }
          
          if ((aiProvider === 'gemini' || aiProvider === 'both') && !geminiApiKey) {
            console.warn('⚠️ Gemini API key is missing. Set GEMINI_API_KEY or GOOGLE_API_KEY in your environment.');
            if (aiProvider === 'both' && claudeApiKey) {
              console.log('Using Claude as fallback since Gemini API key is missing.');
            } else if (aiProvider === 'gemini') {
              return this.generateFallbackReport(testInfo, error, page, screenshotBase64, 'Gemini API key is missing');
            }
          }
          
          // If both API keys are missing and we need at least one
          if ((aiProvider === 'both' && !claudeApiKey && !geminiApiKey) || 
              (aiProvider === 'claude' && !claudeApiKey) || 
              (aiProvider === 'gemini' && !geminiApiKey)) {
            return this.generateFallbackReport(testInfo, error, page, screenshotBase64, 'Required API keys are missing');
          }
          
          // Extract basic information
          const { errorMsg, stackTrace, failingSelector } = extractErrorInfo(error);
          
          // Get HTML and screenshot
          const html = await page.content();
          if (!screenshotBase64) {
            try {
              const screenshotBuffer = await page.screenshot();
              if (screenshotBuffer) {
                screenshotBase64 = screenshotBuffer.toString('base64');
              }
            } catch (e) {
              console.warn(`Failed to capture screenshot: ${e}`);
            }
          }
          
          // Format network requests - ensure we handle trace-extracted requests properly
          let formattedNetworkRequests = 'No network requests captured.';
          try {
            if (Array.isArray(networkRequests) && networkRequests.length > 0) {
              // Transform network requests into the expected format if needed
              const processedRequests = networkRequests.map(req => ({
                url: req.url || '',
                method: req.method || 'GET',
                status: typeof req.status === 'number' ? req.status : 0,
                timestamp: req.timestamp || new Date().toISOString(),
                resourceType: req.resourceType || 'other',
                requestHeaders: req.requestHeaders || {},
                responseHeaders: req.responseHeaders || {},
                requestPostData: req.requestPostData || null,
                responseBody: req.responseBody || ''
              }));
              formattedNetworkRequests = formatNetworkRequestsForAi(processedRequests);
            }
          } catch (e) {
            console.warn(`Error formatting network requests: ${e}. Using default format.`);
            
            // Fallback to basic formatting
            if (Array.isArray(networkRequests) && networkRequests.length > 0) {
              formattedNetworkRequests = networkRequests
                .slice(-20)
                .map((req, idx) => `${idx+1}. ${req.method || 'GET'} ${req.url || ''}`)
                .join('\n');
            }
          }
          
          // Prepare AI input
          const aiInput = {
            html,
            screenshotBase64,
            errorMsg,
            stackTrace,
            failingSelector,
            testTitle: testInfo.title,
            testCode: extractTestCode(testInfo),
            networkRequests: formattedNetworkRequests
          };
          
          // Call AI
          const aiResult = await callDebuggingAI(aiInput);
          
          // Process AI response
          let aiAnalysisHtml = '<p>AI analysis returned no content.</p>';
          let usageInfoHtml = '';
          
          if (aiResult?.errorMarkdown) {
            aiAnalysisHtml = marked.parse(aiResult.errorMarkdown);
          } else if (aiResult?.analysisMarkdown) {
            aiAnalysisHtml = marked.parse(aiResult.analysisMarkdown);
          }
          
          if (aiResult?.usageInfoMarkdown) {
            usageInfoHtml = marked.parse(aiResult.usageInfoMarkdown);
          }
          
          // Format network requests for display
          const networkRequestsList = [];
          if (aiInput.networkRequests && typeof aiInput.networkRequests === 'string' && aiInput.networkRequests.trim()) {
            networkRequestsList.push(aiInput.networkRequests);
          } else {
            networkRequestsList.push('No network requests captured');
          }
          
          // Generate report
          const htmlReport = generateHtmlReport({
            testInfo,
            failingSelector,
            testCode: aiInput.testCode,
            errorMsg: typeof errorMsg === 'string' ? errorMsg : 'Unknown error',
            stackTrace: typeof stackTrace === 'string' ? stackTrace : 'No stack trace available',
            networkRequests: networkRequestsList,
            aiAnalysisHtml,
            usageInfoHtml,
            screenshotBase64
          });
          
          // Save and attach report
          const reportPath = await saveAndAttachReport(
            testInfo,
            htmlReport,
            aiResult?.analysisMarkdown,
            aiResult?.usageInfoMarkdown
          );
          
          return { reportPath };
        } catch (e: any) {
          console.error('Error in AI analysis:', e);
          // Generate a fallback report on error
          return this.generateFallbackReport(testInfo, error, page, screenshotBase64, 
            `AI analysis failed: ${e.message || 'Unknown error'}`);
        }
      };
      
      const analysisResult = await runAnalysisWithoutNetworkCapture(
        mockPage,
        mockTestInfo,
        errorObj,
        networkRequests
      );

      if (analysisResult.reportPath) {
        console.log(`AI analysis report generated: ${analysisResult.reportPath}`);

        // Optionally open the report
        if (this.options.openReportAutomatically) {
          this.openReportInBrowser(analysisResult.reportPath);
        }
      } else {
        console.warn('AI analysis completed but no report was generated.');
      }
    } catch (err) {
      console.error('Error running AI analysis:', err);
    }
  }
  
  /**
   * Generate a fallback report when AI analysis fails
   */
  private async generateFallbackReport(
    testInfo: any, 
    error: any, 
    page: any, 
    screenshotBase64: string | undefined,
    errorReason: string
  ) {
    try {
      const { extractErrorInfo, extractTestCode } = require('../modules/contextGatherer');
      const { generateHtmlReport, saveAndAttachReport } = require('../modules/reportGenerator');
      const { marked } = require('marked');
      
      // Extract basic information
      const { errorMsg, stackTrace, failingSelector } = extractErrorInfo(error);
      
      // Create a simple fallback analysis - avoid using any objects directly
      let title = '';
      try { title = String(testInfo.title || 'Unknown test'); } catch(e) { title = 'Unknown test'; }
      
      let errorMessage = '';
      try { 
        if (typeof errorMsg === 'string') {
          errorMessage = errorMsg;
        } else if (error && typeof error.message === 'string') {
          errorMessage = error.message;
        } else {
          errorMessage = 'No error message available';
        }
      } catch(e) { errorMessage = 'No error message available'; }
      
      let selectorText = '';
      try {
        if (typeof failingSelector === 'string') {
          selectorText = failingSelector;
        } else {
          selectorText = 'No selector identified';
        }
      } catch(e) { selectorText = 'No selector identified'; }
      
      // Stack trace handling
      let stackTraceText = '';
      try {
        if (typeof stackTrace === 'string') {
          stackTraceText = stackTrace;
        } else if (error && typeof error.stack === 'string') {
          stackTraceText = error.stack;
        } else {
          stackTraceText = 'No stack trace available';
        }
      } catch(e) { stackTraceText = 'No stack trace available'; }
      
      // Using plain string concatenation to avoid template literal issues with objects
      const fallbackAnalysis = 
`# ⚠️ AI Analysis Not Available

## Error Reason
${errorReason}

## Test Failure Information
- **Test Title**: ${title}
- **Error Message**: ${errorMessage}
- **Failing Selector**: ${selectorText}

## Stack Trace
\`\`\`
${stackTraceText}
\`\`\`

## Troubleshooting Tips
1. Make sure you have set up your API keys correctly in your environment
2. For Claude: Set ANTHROPIC_API_KEY in your environment  
3. For Gemini: Set GEMINI_API_KEY in your environment
4. Check your network connection and API rate limits
5. Try running the analysis again after resolving these issues

## Manual Analysis Steps
1. Look at the screenshot to identify any visual issues
2. Check the error message and stack trace for clues
3. Review the test code for potential issues
4. Verify that selectors are correct and elements exist on the page
`;

      // Generate simple AI unavailable analysis with orange headings to match other tabs
      let aiAnalysisHtml = `
<div class="ai-analysis">
  <h1 style="margin-top: 2rem; margin-bottom: 1.5rem; color: var(--error-color, #e54444);">⚠️ AI Analysis Not Available</h1>

  <div style="margin-bottom: 2rem;">
    <h2 style="margin-top: 2rem; margin-bottom: 1rem; padding-bottom: 0.5rem; color: var(--orange-color, #f28c18);">Error Reason</h2>
    <p style="margin-bottom: 1rem;">${errorReason}</p>
  </div>

  <div style="margin-bottom: 2rem;">
    <h2 style="margin-top: 2rem; margin-bottom: 1rem; padding-bottom: 0.5rem; color: var(--orange-color, #f28c18);">Test Failure Information</h2>
    <ul style="padding-left: 2rem; margin-bottom: 1rem;">
      <li style="margin-bottom: 0.5rem;"><b>Test Title</b>: ${title}</li>
      <li style="margin-bottom: 0.5rem;"><b>Error Message</b>: ${errorMessage}</li>
      <li style="margin-bottom: 0.5rem;"><b>Failing Selector</b>: ${selectorText}</li>
    </ul>
  </div>

  <div style="margin-bottom: 2rem;">
    <h2 style="margin-top: 2rem; margin-bottom: 1rem; padding-bottom: 0.5rem; color: var(--orange-color, #f28c18);">Stack Trace</h2>
    <pre style="padding: 1rem; border-radius: 5px; overflow: auto;"><code>${stackTraceText}</code></pre>
  </div>

  <div style="margin-bottom: 2rem;">
    <h2 style="margin-top: 2rem; margin-bottom: 1rem; padding-bottom: 0.5rem; color: var(--orange-color, #f28c18);">Troubleshooting Tips</h2>
    <ol style="padding-left: 2rem; margin-bottom: 1rem;">
      <li style="margin-bottom: 0.5rem;">Make sure you have set up your API keys correctly in your environment</li>
      <li style="margin-bottom: 0.5rem;">For Claude: Set ANTHROPIC_API_KEY in your environment</li>
      <li style="margin-bottom: 0.5rem;">For Gemini: Set GEMINI_API_KEY in your environment</li>
      <li style="margin-bottom: 0.5rem;">Check your network connection and API rate limits</li>
      <li style="margin-bottom: 0.5rem;">Try running the analysis again after resolving these issues</li>
    </ol>
  </div>

  <div style="margin-bottom: 2rem;">
    <h2 style="margin-top: 2rem; margin-bottom: 1rem; padding-bottom: 0.5rem; color: var(--orange-color, #f28c18);">Manual Analysis Steps</h2>
    <ol style="padding-left: 2rem; margin-bottom: 1rem;">
      <li style="margin-bottom: 0.5rem;">Look at the screenshot to identify any visual issues</li>
      <li style="margin-bottom: 0.5rem;">Check the error message and stack trace for clues</li>
      <li style="margin-bottom: 0.5rem;">Review the test code for potential issues</li>
      <li style="margin-bottom: 0.5rem;">Verify that selectors are correct and elements exist on the page</li>
    </ol>
  </div>
</div>
`;
      
      // Format network data for display (improved version)
      let formattedNetworkRequests = '';
      
      // First try to extract network requests from traceData if available
      try {
        // Check if we have networkRequests in traceData passed from the caller
        if (error && typeof error === 'object' && 'traceData' in error && 
            error.traceData && Array.isArray(error.traceData.networkRequests) && 
            error.traceData.networkRequests.length > 0) {
          
          // Format trace-sourced network requests
          formattedNetworkRequests = error.traceData.networkRequests
            .slice(-10)
            .map((req: any, i: number) => 
              `${i+1}. ${req.method || 'GET'} ${req.url || ''} (${req.status || 'Unknown status'})`)
            .join('\n');
        } 
        // Fallback to extracting from HTML if available
        else if (page && typeof page.content === 'function') {
          const content = await page.content();
          
          // Extract basic URLs from HTML href and src attributes
          const urlRegex = /(href|src)=["']([^"']+)["']/g;
          const urls = new Set<string>();
          let match;
          while ((match = urlRegex.exec(content)) !== null) {
            urls.add(match[2]);
          }
          
          if (urls.size > 0) {
            formattedNetworkRequests = Array.from(urls)
              .filter(url => url.startsWith('http'))
              .map((url, i) => `${i+1}. GET ${url}`)
              .join('\n');
          }
        }
      } catch (err) {
        console.warn('Could not extract network requests:', err);
      }
      
      // If we still have no network data, provide a placeholder
      if (!formattedNetworkRequests) {
        formattedNetworkRequests = 'No network requests detected';
      }
      
      // Safely extract test code
      let testCodeText = '';
      try {
        const extractedCode = extractTestCode(testInfo);
        testCodeText = typeof extractedCode === 'string' ? extractedCode : 'No test code available';
      } catch (e) {
        testCodeText = 'No test code available';
      }
      
      // Network requests from HTML content
      let networkRequestsList = [];
      try {
        if (formattedNetworkRequests && typeof formattedNetworkRequests === 'string') {
          networkRequestsList = [formattedNetworkRequests];
        } else {
          networkRequestsList = ['No network requests captured'];
        }
      } catch (e) {
        networkRequestsList = ['No network requests captured'];
      }
      
      // Generate the HTML report with string values only
      const htmlReport = generateHtmlReport({
        testInfo: {
          title: title,
          file: testInfo?.file || 'Unknown file',
          project: { name: testInfo?.project?.name || 'Unknown project' },
          outputDir: testInfo?.outputDir || ''
        },
        failingSelector: selectorText,
        testCode: testCodeText,
        errorMsg: errorMessage,
        stackTrace: stackTraceText,
        networkRequests: networkRequestsList,
        aiAnalysisHtml,
        usageInfoHtml: '',
        screenshotBase64
      });
      
      // Save and attach report
      const reportPath = await saveAndAttachReport(
        testInfo,
        htmlReport,
        fallbackAnalysis,
        ''
      );
      
      return { reportPath };
    } catch (e: any) {
      console.error('Error generating fallback report:', e);
      return {};
    }
  }

  /**
   * Open the report in the default browser
   */
  private openReportInBrowser(reportPath: string) {
    try {
      const platform = os.platform();
      
      if (platform === 'darwin') {
        // macOS
        require('child_process').exec(`open "${reportPath}"`);
      } else if (platform === 'win32') {
        // Windows
        require('child_process').exec(`start "" "${reportPath}"`);
      } else if (platform === 'linux') {
        // Linux
        require('child_process').exec(`xdg-open "${reportPath}"`);
      }
    } catch (err) {
      console.warn(`Could not open report automatically: ${err}`);
    }
  }

  /**
   * Helper function to sanitize filenames
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-z0-9]/gi, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
  }

  /**
   * Helper function to get file extension from content type
   */
  private getExtensionFromContentType(contentType: string): string {
    const types: Record<string, string> = {
      'text/html': 'html',
      'text/plain': 'txt',
      'text/markdown': 'md',
      'application/json': 'json',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif'
    };
    
    return types[contentType] || 'txt';
  }
}