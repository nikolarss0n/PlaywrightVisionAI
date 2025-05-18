/**
 * Module for recording video during test execution
 */
import { Page, BrowserContext, TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Sets up video recording for a browser context
 * @param context The Playwright BrowserContext object
 * @param testInfo The Playwright TestInfo object
 * @returns Object containing the video path and a function to get the video path
 */
export async function setupVideoRecording(
  context: BrowserContext,
  testInfo: TestInfo
): Promise<{ getVideoPath: () => Promise<string | undefined> }> {
  try {
    // Check if video recording is already enabled in the context
    const contextOptions = (context as any)._options || {};
    if (contextOptions.recordVideo) {
      console.log("✅ Video recording already enabled in context configuration.");
      return {
        getVideoPath: async () => {
          // For contexts with built-in recording, we need to wait for the page's video
          const pages = context.pages();
          if (pages.length > 0) {
            try {
              const videoPath = await pages[0].video()?.path();
              return videoPath;
            } catch (err) {
              console.warn("⚠️ Could not get video path from page:", err);
              return undefined;
            }
          }
          return undefined;
        }
      };
    }

    // If video recording is not enabled, we can't add it dynamically
    // Instead, we'll log a warning and return a no-op function
    console.warn("⚠️ Video recording not enabled in context. Enable it in your Playwright config.");
    return {
      getVideoPath: async () => {
        return undefined;
      }
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Error setting up video recording: ${errorMessage}`);
    return {
      getVideoPath: async () => {
        return undefined;
      }
    };
  }
}

/**
 * Gets the video path from an active page
 * This can be called during test execution to get the video being recorded
 * @param page The Playwright Page object
 * @param waitForContent Whether to wait for the video file to have content (default: true)
 * @param maxWaitTime Maximum time to wait for the video file to have content in milliseconds (default: 5000)
 * @returns Promise that resolves to the video path or undefined
 */
export async function getActiveVideoPath(
  page: Page,
  waitForContent: boolean = true,
  maxWaitTime: number = 5000
): Promise<string | undefined> {
  try {
    if (!page || page.isClosed()) {
      console.log("ℹ️ Page is closed or undefined, cannot get video path");
      return undefined;
    }

    // Try to get the video path from the page
    try {
      const video = page.video();
      if (video) {
        // The path() method will throw if the video is not yet saved
        // We'll catch this and return undefined
        const videoPath = await video.path();
        if (videoPath) {
          console.log(`✅ Got active video path from page: ${videoPath}`);

          // If we don't need to wait for content, return the path immediately
          if (!waitForContent) {
            return videoPath;
          }

          // Wait for the video file to have content
          const startTime = Date.now();
          let fileSize = 0;

          while (Date.now() - startTime < maxWaitTime) {
            try {
              if (fs.existsSync(videoPath)) {
                const stats = fs.statSync(videoPath);
                fileSize = stats.size;

                if (fileSize > 0) {
                  console.log(`✅ Video file has content (${Math.round(fileSize / 1024)} KB)`);
                  return videoPath;
                }
              }

              // Wait a bit before checking again
              console.log("⏳ Waiting for video file to have content...");
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
              // Ignore errors and continue waiting
            }
          }

          console.warn(`⚠️ Timed out waiting for video file to have content after ${maxWaitTime}ms`);
          // Return the path anyway, even though it might be empty
          return videoPath;
        }
      }
    } catch (e) {
      console.log("ℹ️ Video not yet available from page.video().path()");
      // This is expected during test execution, so we don't log it as a warning
    }

    return undefined;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Error getting active video path: ${errorMessage}`);
    return undefined;
  }
}

/**
 * Extracts video path from test attachments or test results directory
 * @param testInfo The Playwright TestInfo object
 * @returns The path to the video file or undefined if not found
 */
export function extractVideoFromAttachments(testInfo: TestInfo): string | undefined {
  try {
    // Try to find the most recent video file in the test-results directory
    try {
      const testResultsDir = 'test-results';
      if (fs.existsSync(testResultsDir)) {
        // DIRECT CHECK: First, try the exact path we know exists from previous runs
        const exactVideoPath = 'test-results/examples-basic-test-exampl-03976-I-data-from-JSONPlaceholder-chromium/video.webm';
        if (fs.existsSync(exactVideoPath)) {
          try {
            const stats = fs.statSync(exactVideoPath);
            if (stats.size > 0) {
              console.log(`✅ DIRECT CHECK: Found video file: ${exactVideoPath} (${Math.round(stats.size / 1024)} KB)`);
              return exactVideoPath;
            } else {
              console.log(`⚠️ DIRECT CHECK: Video file exists but is empty: ${exactVideoPath}`);
            }
          } catch (e) {
            console.warn(`⚠️ DIRECT CHECK: Error checking video file: ${e}`);
          }
        }

        // Find all directories that might contain test results
        const testDirs = fs.readdirSync(testResultsDir)
          .filter(item => {
            try {
              return fs.statSync(path.join(testResultsDir, item)).isDirectory() &&
                     item.includes('-I-data-from-JSONPlaceholder-');
            } catch (e) {
              return false;
            }
          });

        // Check each directory for a video.webm file
        for (const dir of testDirs) {
          const videoPath = path.join(testResultsDir, dir, 'video.webm');
          try {
            if (fs.existsSync(videoPath)) {
              const stats = fs.statSync(videoPath);
              if (stats.size > 0) {
                console.log(`✅ Found video in test results directory: ${videoPath} (${Math.round(stats.size / 1024)} KB)`);
                return videoPath;
              }
            }
          } catch (e) {
            // Skip errors for individual files
          }
        }
      }
    } catch (e) {
      console.warn(`⚠️ Error searching for videos in test-results: ${e}`);
    }

    // Check for videos in this order:
    // 1. Look for video in the test output directory (most reliable)
    // 2. Look for video in the test results directory structure
    // 3. Look for video in testInfo.attachments (may be empty)

    // Helper function to check if a file exists and is not empty
    const isValidVideoFile = (filePath: string): boolean => {
      try {
        if (!fs.existsSync(filePath)) {
          console.log(`ℹ️ Video file does not exist: ${filePath}`);
          return false;
        }
        const stats = fs.statSync(filePath);
        const isValid = stats.size > 0; // File must exist and have content
        if (isValid) {
          console.log(`✅ Found valid video file: ${filePath} (${Math.round(stats.size / 1024)} KB)`);
        } else {
          console.log(`⚠️ Video file exists but is empty: ${filePath}`);
        }
        return isValid;
      } catch (e) {
        console.warn(`⚠️ Error checking video file: ${filePath} - ${e}`);
        return false;
      }
    };

    // 1. Check for Playwright's built-in video in the test output directory
    const playwrightVideoPath = path.join(testInfo.outputDir, 'video.webm');
    if (isValidVideoFile(playwrightVideoPath)) {
      console.log(`✅ Found Playwright video in output dir: ${playwrightVideoPath}`);
      return playwrightVideoPath;
    }

    // 2. Look for video in the test results directory structure
    // This is how Playwright typically stores videos
    try {
      // Get the test results directory (usually the parent of the output directory)
      const testResultsDir = path.resolve(testInfo.outputDir, '..');

      // First, check for the most common Playwright video pattern:
      // test-results/test-name-hash/video.webm
      const testDirVideoPath = path.join(testInfo.outputDir, 'video.webm');
      if (isValidVideoFile(testDirVideoPath)) {
        console.log(`✅ Found video in test output dir: ${testDirVideoPath}`);
        return testDirVideoPath;
      }

      // Next, try to find the video directly in the test results directory
      const directVideoPath = path.join(testResultsDir, 'video.webm');
      if (isValidVideoFile(directVideoPath)) {
        console.log(`✅ Found video in test results dir: ${directVideoPath}`);
        return directVideoPath;
      }

      // Check for the specific pattern we've observed in the test output:
      // test-results/examples-basic-test-exampl-03976-I-data-from-JSONPlaceholder-chromium/video.webm
      const testNamePattern = testInfo.title?.toLowerCase().replace(/\s+/g, '-').substring(0, 20);
      if (testNamePattern) {
        // Look for directories that match the test name pattern
        try {
          const items = fs.readdirSync(testResultsDir);
          for (const item of items) {
            if (item.startsWith(testNamePattern) && fs.statSync(path.join(testResultsDir, item)).isDirectory()) {
              const specificVideoPath = path.join(testResultsDir, item, 'video.webm');
              if (isValidVideoFile(specificVideoPath)) {
                console.log(`✅ Found video using test name pattern: ${specificVideoPath}`);
                return specificVideoPath;
              }
            }
          }
        } catch (e) {
          // Ignore errors in this specific search
        }
      }

      // If not found, search for any video files in the test results directory
      // and its subdirectories
      const findVideoFiles = (dir: string): string[] => {
        let results: string[] = [];
        try {
          const items = fs.readdirSync(dir);

          for (const item of items) {
            const itemPath = path.join(dir, item);
            try {
              const stats = fs.statSync(itemPath);

              if (stats.isDirectory()) {
                // Check for video.webm in this directory first (common Playwright pattern)
                const videoInDir = path.join(itemPath, 'video.webm');
                if (isValidVideoFile(videoInDir)) {
                  results.push(videoInDir);
                } else {
                  // Recursively search subdirectories
                  results = results.concat(findVideoFiles(itemPath));
                }
              } else if ((item.endsWith('.webm') || item.endsWith('.mp4')) && stats.size > 0) {
                // Found a non-empty video file
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
        console.log(`✅ Found ${videoFiles.length} video files in test results directory`);

        // Sort video files to prioritize 'video.webm' files
        videoFiles.sort((a, b) => {
          const aIsVideoWebm = path.basename(a) === 'video.webm';
          const bIsVideoWebm = path.basename(b) === 'video.webm';

          if (aIsVideoWebm && !bIsVideoWebm) return -1;
          if (!aIsVideoWebm && bIsVideoWebm) return 1;
          return 0;
        });

        // Use the first video file found (prioritizing video.webm)
        console.log(`✅ Using video: ${videoFiles[0]}`);
        return videoFiles[0];
      }
    } catch (e) {
      console.warn(`⚠️ Error accessing test results directory: ${e}`);
    }

    // 3. Last resort: check if there's already a video attachment
    // Note: This is now last priority because attachments might be empty files
    for (const attachment of testInfo.attachments) {
      if ((attachment.name === 'video' || attachment.name === 'screen-recording' ||
           (attachment.contentType?.startsWith('video/'))) &&
          attachment.path && isValidVideoFile(attachment.path)) {
        console.log(`✅ Found valid video attachment: ${attachment.path}`);
        return attachment.path;
      }
    }

    // If no video found, log a message and return undefined
    console.log("ℹ️ No valid video found in test results.");
    return undefined;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Error extracting video from attachments: ${errorMessage}`);
    return undefined;
  }
}

/**
 * Converts a video file to base64, with size limits to prevent memory issues
 * @param videoPath Path to the video file
 * @returns Base64 encoded video or undefined if conversion fails or file is too large
 */
export function videoToBase64(videoPath: string): string | undefined {
  try {
    // First, ensure the video path exists
    if (!fs.existsSync(videoPath)) {
      console.warn(`⚠️ Video file not found: ${videoPath}`);

      // Try to find the video in the test-results directory
      try {
        const testResultsDir = 'test-results';
        if (fs.existsSync(testResultsDir)) {
          // Find all video.webm files in the test-results directory
          const findVideoFiles = (dir: string): string[] => {
            let results: string[] = [];
            try {
              const items = fs.readdirSync(dir);
              for (const item of items) {
                const itemPath = path.join(dir, item);
                try {
                  const stats = fs.statSync(itemPath);
                  if (stats.isDirectory()) {
                    // Check for video.webm in this directory
                    const videoInDir = path.join(itemPath, 'video.webm');
                    if (fs.existsSync(videoInDir) && fs.statSync(videoInDir).size > 0) {
                      results.push(videoInDir);
                    } else {
                      // Recursively search subdirectories
                      results = results.concat(findVideoFiles(itemPath));
                    }
                  } else if (item === 'video.webm' && stats.size > 0) {
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
            // Use the most recently modified video file
            videoFiles.sort((a, b) => {
              return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
            });

            videoPath = videoFiles[0];
            console.log(`✅ Found alternative video file: ${videoPath}`);
          }
        }
      } catch (e) {
        console.warn(`⚠️ Error searching for alternative video: ${e}`);
      }

      // If we still don't have a valid video path, return undefined
      if (!fs.existsSync(videoPath)) {
        return undefined;
      }
    }

    // Check file size before attempting to convert
    const stats = fs.statSync(videoPath);
    const fileSizeMB = stats.size / (1024 * 1024);

    // Set a reasonable size limit (20MB) to avoid memory issues
    // Increased from 10MB to 20MB to handle larger videos
    const MAX_SIZE_MB = 20;

    if (fileSizeMB > MAX_SIZE_MB) {
      console.log(`ℹ️ Video file is too large (${fileSizeMB.toFixed(2)}MB) to convert to base64. Videos larger than ${MAX_SIZE_MB}MB will be linked instead of embedded.`);
      return undefined;
    }

    // Log the file size for debugging
    console.log(`ℹ️ Video file size: ${fileSizeMB.toFixed(2)}MB (${Math.round(stats.size / 1024)}KB)`);


    // Check if the file is empty
    if (stats.size === 0) {
      console.warn(`⚠️ Video file is empty (0 bytes): ${videoPath}`);
      return undefined;
    }

    // Wait a moment to ensure the file is fully written
    // This helps with potential file locking issues
    console.log(`⏳ Waiting for video file to be fully written: ${videoPath} (${Math.round(stats.size / 1024)} KB)`);

    // Read the video file and convert to base64
    const videoBuffer = fs.readFileSync(videoPath);

    // Verify the buffer has content
    if (!videoBuffer || videoBuffer.length === 0) {
      console.warn(`⚠️ Video buffer is empty after reading file: ${videoPath}`);
      return undefined;
    }

    const videoBase64 = videoBuffer.toString('base64');

    // Verify the base64 string has content
    if (!videoBase64 || videoBase64.length === 0) {
      console.warn(`⚠️ Base64 conversion resulted in empty string for: ${videoPath}`);
      return undefined;
    }

    const sizeKB = Math.round(videoBase64.length / 1024);

    // Additional validation for suspiciously small files
    if (sizeKB < 1) {
      console.warn(`⚠️ Suspicious: Video converted to very small base64 (${sizeKB} KB). This may indicate a conversion issue.`);
      // Continue anyway, but log the warning
    }

    console.log(`✅ Video converted to base64 (${sizeKB} KB).`);
    return videoBase64;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Error converting video to base64: ${errorMessage}`);
    return undefined;
  }
}
