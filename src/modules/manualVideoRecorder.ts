/**
 * Module for manual video recording during test execution
 */
import { Page, BrowserContext, TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';

interface VideoRecorderOptions {
  /** Output file path for the video */
  outputPath?: string;
  /** Frame rate for the recording (default: 30) */
  fps?: number;
  /** Video width (default: 1280) */
  width?: number;
  /** Video height (default: 720) */
  height?: number;
  /** Video codec (default: h264) */
  codec?: string;
}

interface VideoRecorder {
  /** Start recording */
  start: () => Promise<void>;
  /** Stop recording */
  stop: () => Promise<string>;
  /** Get the path to the recorded video */
  getVideoPath: () => string;
}

/**
 * Creates a manual video recorder for capturing test execution
 * This uses FFmpeg to record the screen
 * @param options Video recorder options
 * @returns VideoRecorder object
 */
export function createManualVideoRecorder(options: VideoRecorderOptions = {}): VideoRecorder {
  // Default options
  const fps = options.fps || 30;
  const width = options.width || 1280;
  const height = options.height || 720;
  const codec = options.codec || 'h264';
  
  // Generate output path if not provided
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const outputDir = path.join(process.cwd(), 'test-videos');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = options.outputPath || path.join(outputDir, `test-recording-${timestamp}.mp4`);
  
  // FFmpeg process
  let ffmpegProcess: any = null;
  
  return {
    start: async () => {
      // Determine the screen recording command based on OS
      const platform = os.platform();
      let ffmpegArgs: string[] = [];
      
      if (platform === 'darwin') {
        // macOS
        ffmpegArgs = [
          '-f', 'avfoundation',
          '-framerate', fps.toString(),
          '-i', '1:none', // '1' is the screen index on macOS
          '-vf', `scale=${width}:${height}`,
          '-c:v', codec,
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',
          '-y', // Overwrite output file
          outputPath
        ];
      } else if (platform === 'win32') {
        // Windows
        ffmpegArgs = [
          '-f', 'gdigrab',
          '-framerate', fps.toString(),
          '-i', 'desktop',
          '-vf', `scale=${width}:${height}`,
          '-c:v', codec,
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',
          '-y',
          outputPath
        ];
      } else if (platform === 'linux') {
        // Linux
        ffmpegArgs = [
          '-f', 'x11grab',
          '-framerate', fps.toString(),
          '-i', ':0.0',
          '-vf', `scale=${width}:${height}`,
          '-c:v', codec,
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',
          '-y',
          outputPath
        ];
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
      
      try {
        console.log(`🎥 Starting video recording to ${outputPath}`);
        ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
        
        // Log any errors
        ffmpegProcess.stderr.on('data', (data: Buffer) => {
          // FFmpeg logs to stderr by default, so we'll only log actual errors
          const message = data.toString();
          if (message.includes('Error') || message.includes('error')) {
            console.error(`❌ FFmpeg error: ${message}`);
          }
        });
        
        // Wait a moment to ensure recording has started
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Failed to start video recording: ${error}`);
        throw error;
      }
    },
    
    stop: async () => {
      if (ffmpegProcess) {
        console.log('🎬 Stopping video recording...');
        
        // Send SIGTERM to gracefully stop FFmpeg
        ffmpegProcess.kill('SIGTERM');
        
        // Wait for the process to exit
        await new Promise<void>((resolve) => {
          ffmpegProcess.on('exit', () => {
            console.log(`✅ Video saved to ${outputPath}`);
            resolve();
          });
          
          // Fallback if process doesn't exit within 5 seconds
          setTimeout(() => {
            if (ffmpegProcess) {
              ffmpegProcess.kill('SIGKILL');
              console.warn('⚠️ Forced FFmpeg to stop');
              resolve();
            }
          }, 5000);
        });
        
        ffmpegProcess = null;
      }
      
      return outputPath;
    },
    
    getVideoPath: () => outputPath
  };
}

/**
 * Converts a video file to base64
 * @param videoPath Path to the video file
 * @returns Base64 encoded video or undefined if conversion fails
 */
export function videoToBase64(videoPath: string): string | undefined {
  try {
    if (!fs.existsSync(videoPath)) {
      console.warn(`⚠️ Video file not found: ${videoPath}`);
      return undefined;
    }
    
    // Read the video file and convert to base64
    const videoBuffer = fs.readFileSync(videoPath);
    const videoBase64 = videoBuffer.toString('base64');
    console.log(`✅ Video converted to base64 (${Math.round(videoBase64.length / 1024)} KB).`);
    return videoBase64;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Error converting video to base64: ${errorMessage}`);
    return undefined;
  }
}

/**
 * Attaches a video to the test results
 * @param testInfo Playwright TestInfo object
 * @param videoPath Path to the video file
 */
export async function attachVideoToTest(testInfo: TestInfo, videoPath: string): Promise<void> {
  try {
    if (!fs.existsSync(videoPath)) {
      console.warn(`⚠️ Video file not found: ${videoPath}`);
      return;
    }
    
    await testInfo.attach('video', {
      path: videoPath,
      contentType: 'video/mp4',
    });
    
    console.log(`✅ Video attached to test results: ${videoPath}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Error attaching video to test: ${errorMessage}`);
  }
}
