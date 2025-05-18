/**
 * Simple video recorder module for easy integration
 * Provides a simplified interface for manual video recording
 */
import { TestInfo } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';

// Global recorder instance for easy access
let globalRecorder: SimpleVideoRecorder | null = null;

/**
 * Simple video recorder class
 */
export class SimpleVideoRecorder {
  private process: any = null;
  private outputPath: string;
  private isRecording: boolean = false;
  private startTime: number = 0;

  /**
   * Creates a new simple video recorder
   * @param options Options for the recorder
   */
  constructor(options: {
    outputDir?: string;
    filename?: string;
    fps?: number;
    width?: number;
    height?: number;
  } = {}) {
    // Generate output path
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputDir = options.outputDir || path.join(process.cwd(), 'test-videos');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filename = options.filename || `test-recording-${timestamp}.mp4`;
    this.outputPath = path.join(outputDir, filename);
    
    // Store as global instance for easy access
    globalRecorder = this;
    
    console.log(`🎥 Video recorder initialized. Will save to: ${this.outputPath}`);
  }

  /**
   * Starts recording
   * @returns Promise that resolves when recording has started
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      console.log('⚠️ Video recording already in progress');
      return;
    }
    
    // Determine the screen recording command based on OS
    const platform = os.platform();
    const fps = 15; // Default to 15 fps for better performance
    const width = 1280;
    const height = 720;
    let ffmpegArgs: string[] = [];
    
    try {
      if (platform === 'darwin') {
        // macOS
        ffmpegArgs = [
          '-f', 'avfoundation',
          '-framerate', fps.toString(),
          '-i', '1:none', // '1' is the screen index on macOS
          '-vf', `scale=${width}:${height}`,
          '-c:v', 'h264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',
          '-y', // Overwrite output file
          this.outputPath
        ];
      } else if (platform === 'win32') {
        // Windows
        ffmpegArgs = [
          '-f', 'gdigrab',
          '-framerate', fps.toString(),
          '-i', 'desktop',
          '-vf', `scale=${width}:${height}`,
          '-c:v', 'h264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',
          '-y',
          this.outputPath
        ];
      } else if (platform === 'linux') {
        // Linux
        ffmpegArgs = [
          '-f', 'x11grab',
          '-framerate', fps.toString(),
          '-i', ':0.0',
          '-vf', `scale=${width}:${height}`,
          '-c:v', 'h264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',
          '-y',
          this.outputPath
        ];
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
      
      console.log(`🎬 Starting video recording (${width}x${height} @ ${fps}fps)...`);
      this.process = spawn('ffmpeg', ffmpegArgs);
      
      // Log any errors
      this.process.stderr.on('data', (data: Buffer) => {
        const message = data.toString();
        if (message.includes('Error') || message.includes('error')) {
          console.error(`❌ FFmpeg error: ${message}`);
        }
      });
      
      this.isRecording = true;
      this.startTime = Date.now();
      
      // Wait a moment to ensure recording has started
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✅ Video recording started successfully');
    } catch (error) {
      console.error(`❌ Failed to start video recording: ${error}`);
      console.log('💡 Make sure FFmpeg is installed on your system:');
      console.log('   - macOS: brew install ffmpeg');
      console.log('   - Windows: choco install ffmpeg');
      console.log('   - Linux: apt-get install ffmpeg');
    }
  }

  /**
   * Stops recording
   * @returns Promise that resolves with the path to the recorded video
   */
  async stop(): Promise<string> {
    if (!this.isRecording || !this.process) {
      console.log('⚠️ No video recording in progress');
      return this.outputPath;
    }
    
    console.log('🛑 Stopping video recording...');
    
    try {
      // Send SIGTERM to gracefully stop FFmpeg
      this.process.kill('SIGTERM');
      
      // Wait for the process to exit
      await new Promise<void>((resolve) => {
        this.process.on('exit', () => {
          const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
          console.log(`✅ Video recording stopped after ${duration}s`);
          console.log(`📁 Video saved to: ${this.outputPath}`);
          resolve();
        });
        
        // Fallback if process doesn't exit within 5 seconds
        setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
            console.warn('⚠️ Forced FFmpeg to stop');
            resolve();
          }
        }, 5000);
      });
      
      this.process = null;
      this.isRecording = false;
      
      // Check if the file exists and has content
      if (fs.existsSync(this.outputPath)) {
        const stats = fs.statSync(this.outputPath);
        if (stats.size > 0) {
          console.log(`📊 Video file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        } else {
          console.warn('⚠️ Video file is empty');
        }
      } else {
        console.warn('⚠️ Video file was not created');
      }
      
      return this.outputPath;
    } catch (error) {
      console.error(`❌ Error stopping video recording: ${error}`);
      this.isRecording = false;
      this.process = null;
      return this.outputPath;
    }
  }

  /**
   * Gets the path to the recorded video
   * @returns Path to the video file
   */
  getVideoPath(): string {
    return this.outputPath;
  }

  /**
   * Checks if recording is in progress
   * @returns True if recording, false otherwise
   */
  isActive(): boolean {
    return this.isRecording;
  }
}

/**
 * Gets the global recorder instance
 * @returns The global recorder instance or null if not initialized
 */
export function getGlobalRecorder(): SimpleVideoRecorder | null {
  return globalRecorder;
}

/**
 * Creates a new global recorder instance
 * @param options Options for the recorder
 * @returns The new recorder instance
 */
export function createGlobalRecorder(options: {
  outputDir?: string;
  filename?: string;
  fps?: number;
  width?: number;
  height?: number;
} = {}): SimpleVideoRecorder {
  return new SimpleVideoRecorder(options);
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
