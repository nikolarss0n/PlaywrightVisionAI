/**
 * Module for post-test analysis
 * Runs AI analysis after all tests have completed to ensure video files are available
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TestInfo } from '@playwright/test';
import { callDebuggingAI } from './aiCaller';
import { videoToBase64 } from './videoRecorder';
import { extractTestCode } from './contextGatherer';
import { generateHtmlReport, saveAndAttachReport } from './reportGenerator';
import { marked } from 'marked';
import { formatNetworkRequestsForAi } from './networkFormatter';
import { NetworkRequest } from './types';

/**
 * Runs post-test analysis on a completed test
 * @param testInfo The test info object
 * @param error The error that caused the test to fail
 * @param networkRequests Any captured network requests
 */
export async function runPostTestAnalysis(
  testInfo: TestInfo,
  error: Error,
  networkRequests: NetworkRequest[] = []
): Promise<{ reportPath?: string }> {
  console.log(`\n🔍 Running post-test analysis for: ${testInfo.title}`);

  try {
    // Extract basic test information
    const errorMsg = error.message || 'Unknown error';
    const stackTrace = error.stack;
    const title = testInfo.title;

    // Extract test code
    const testCode = extractTestCode(testInfo);
    if (testCode) {
      console.log("✅ Test code extracted.");
    }

    // Capture HTML from attachments
    let html = '';
    for (const attachment of testInfo.attachments) {
      if (attachment.name === 'html' && attachment.path) {
        try {
          html = fs.readFileSync(attachment.path, 'utf-8');
          console.log("✅ HTML content loaded from attachment.");
          break;
        } catch (e) {
          console.warn(`⚠️ Error loading HTML attachment: ${e}`);
        }
      }
    }

    // Capture screenshot from attachments
    let screenshotBase64: string | undefined;
    for (const attachment of testInfo.attachments) {
      if (attachment.name === 'screenshot' && attachment.path) {
        try {
          const screenshotBuffer = fs.readFileSync(attachment.path);
          screenshotBase64 = screenshotBuffer.toString('base64');
          console.log("✅ Screenshot loaded from attachment.");
          break;
        } catch (e) {
          console.warn(`⚠️ Error loading screenshot attachment: ${e}`);
        }
      }
    }

    // Find and process video file
    let videoPath: string | undefined;
    let videoBase64: string | undefined;

    // Look for video in the test output directory
    const videoInOutputDir = path.join(testInfo.outputDir, 'video.webm');
    if (fs.existsSync(videoInOutputDir) && fs.statSync(videoInOutputDir).size > 0) {
      videoPath = videoInOutputDir;
      console.log(`✅ Found video in test output directory: ${videoPath} (${Math.round(fs.statSync(videoPath).size / 1024)} KB)`);
    } else {
      // Try the common pattern for Playwright videos
      const testResultsDir = path.resolve(testInfo.outputDir, '..');
      const testDirPattern = testInfo.title?.toLowerCase().replace(/\s+/g, '-').substring(0, 20);

      if (testDirPattern) {
        const possibleDirs = fs.readdirSync(testResultsDir).filter(dir =>
          dir.includes(testDirPattern) && fs.statSync(path.join(testResultsDir, dir)).isDirectory()
        );

        for (const dir of possibleDirs) {
          const possibleVideoPath = path.join(testResultsDir, dir, 'video.webm');
          if (fs.existsSync(possibleVideoPath) && fs.statSync(possibleVideoPath).size > 0) {
            videoPath = possibleVideoPath;
            console.log(`✅ Found video in test results directory: ${videoPath} (${Math.round(fs.statSync(videoPath).size / 1024)} KB)`);
            break;
          }
        }
      }

      // If still not found, try a more exhaustive search
      if (!videoPath) {
        const findVideoFiles = (dir: string): string[] => {
          let results: string[] = [];
          try {
            const items = fs.readdirSync(dir);
            for (const item of items) {
              const itemPath = path.join(dir, item);
              try {
                const stats = fs.statSync(itemPath);
                if (stats.isDirectory()) {
                  results = results.concat(findVideoFiles(itemPath));
                } else if ((item === 'video.webm' || item.endsWith('.mp4')) && stats.size > 0) {
                  results.push(itemPath);
                }
              } catch (e) {
                // Skip files we can't access
              }
            }
          } catch (e) {
            // Skip directories we can't access
          }
          return results;
        };

        const videoFiles = findVideoFiles(testResultsDir);
        if (videoFiles.length > 0) {
          // Sort by modification time (newest first)
          videoFiles.sort((a, b) => {
            return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
          });

          videoPath = videoFiles[0];
          console.log(`✅ Found video file: ${videoPath} (${Math.round(fs.statSync(videoPath).size / 1024)} KB)`);
        }
      }
    }

    // Convert video to base64 if found
    if (videoPath) {
      console.log(`🎬 Converting video to base64: ${videoPath}`);
      videoBase64 = videoToBase64(videoPath);

      if (videoBase64) {
        console.log(`✅ Video converted to base64 (${Math.round(videoBase64.length / 1024)} KB)`);
      } else {
        console.warn("⚠️ Failed to convert video to base64");
      }
    } else {
      console.log("⚠️ No video file found for analysis");
    }

    // Format network requests for AI
    const formattedNetworkRequests = formatNetworkRequestsForAi(networkRequests);

    // Join network requests into a single string for AI input
    const networkRequestsString = formattedNetworkRequests.length > 0
      ? formattedNetworkRequests.join('\n\n')
      : undefined;

    // Prepare AI input
    const aiInput = {
      html,
      screenshotBase64,
      videoBase64,
      videoPath,
      errorMsg,
      stackTrace,
      failingSelector: undefined,
      testTitle: title,
      testCode,
      networkRequests: networkRequestsString
    };

    // Call AI for analysis
    console.log("🧠 Calling AI for post-test analysis...");

    // Log if video is available but not included in AI input
    if (videoPath && !videoBase64) {
      console.log("ℹ️ Video available but not included in AI input (requires base64 encoding).");
    }

    const aiStartTime = Date.now();
    const aiAnalysisResult = await callDebuggingAI(aiInput);
    const aiEndTime = Date.now();
    console.log(`✅ AI analysis completed in ${aiEndTime - aiStartTime}ms.`);

    // Prepare AI Content for HTML
    let aiAnalysisHtml = '<p>AI analysis returned no content.</p>';
    let usageInfoHtml = '';

    if (aiAnalysisResult?.errorMarkdown) {
      console.error("AI Analysis Error:", aiAnalysisResult.errorMarkdown);
      aiAnalysisHtml = marked.parse(aiAnalysisResult.errorMarkdown) as string;
    } else if (aiAnalysisResult?.analysisMarkdown) {
      aiAnalysisHtml = marked.parse(aiAnalysisResult.analysisMarkdown) as string;
    }

    // Prepare Usage Info HTML
    if (aiAnalysisResult?.usageInfoMarkdown) {
      usageInfoHtml = marked.parse(aiAnalysisResult.usageInfoMarkdown) as string;
    }

    // Generate and Save HTML Report
    const htmlReport = generateHtmlReport({
      testInfo,
      failingSelector: undefined,
      testCode,
      errorMsg,
      stackTrace,
      networkRequests,
      aiAnalysisHtml,
      usageInfoHtml,
      screenshotBase64,
      videoPath,
      videoBase64
    });

    // Save and attach the report
    const reportPath = await saveAndAttachReport(
      testInfo,
      htmlReport,
      aiAnalysisResult?.analysisMarkdown || undefined,
      aiAnalysisResult?.usageInfoMarkdown || undefined
    );

    console.log(`✅ Post-test analysis complete. Report saved to: ${reportPath}`);
    return { reportPath };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error during post-test analysis: ${errorMessage}`);
    return {};
  }
}
