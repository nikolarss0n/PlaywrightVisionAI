/**
 * Module for extracting frames from a video file
 * Used especially for Claude AI which doesn't support direct video analysis
 */
import fs from 'fs';
import path from 'path';
import { VideoFrame } from './types';

// Try to import the video processing dependencies
let extractFrames: any;
let getVideoDurationInSeconds: (path: string) => Promise<number>;
let ffmpegPath: string | null = null;
let ffprobePath: { path: string } | null = null;

// Wrap dependencies in try/catch for better error handling
try {
  extractFrames = require('ffmpeg-extract-frames');
  const gvd = require('get-video-duration');
  getVideoDurationInSeconds = gvd.getVideoDurationInSeconds;
  ffmpegPath = require('ffmpeg-static');
  ffprobePath = require('ffprobe-static');
  
  // Set path to ffmpeg and ffprobe binaries
  if (ffmpegPath) {
    process.env.FFMPEG_PATH = ffmpegPath;
  }
  if (ffprobePath && ffprobePath.path) {
    process.env.FFPROBE_PATH = ffprobePath.path;
  }
  
  console.log('✅ Video frame extraction dependencies loaded successfully');
  console.log(`FFMPEG_PATH set to: ${process.env.FFMPEG_PATH}`);
  console.log(`FFPROBE_PATH set to: ${process.env.FFPROBE_PATH}`);
} catch (error) {
  console.warn('⚠️ Video frame extraction dependencies not available. Frame extraction will be disabled.');
  console.warn(error);
  
  // Stub functions for graceful fallback
  extractFrames = async () => {};
  getVideoDurationInSeconds = async () => 0;
}

/**
 * Settings for frame extraction from video
 */
export interface FrameExtractionSettings {
  /**
   * Maximum number of frames to extract (default: 5)
   */
  maxFrames?: number;
  /**
   * Interval in seconds between frames. Set to 0 for key moments.
   */
  interval?: number;
  /**
   * Output directory for frame images. Defaults to temp directory.
   */
  outputDir?: string;
  /**
   * Format of extracted frames (default: jpg)
   */
  format?: string;
}

/**
 * Extract key frames from a video file
 * @param videoPath Path to the video file
 * @param options Options for frame extraction
 * @returns Array of video frame objects
 */
export async function extractKeyFrames(
  videoPath: string,
  options: FrameExtractionSettings = {}
): Promise<VideoFrame[]> {
  try {
    console.log(`🎬 Extracting key frames from video: ${videoPath}`);
    
    // Check if video extraction dependencies are available
    if (!extractFrames || typeof extractFrames !== 'function') {
      console.warn('⚠️ Video frame extraction is disabled due to missing dependencies');
      return [];
    }
    
    // Ensure video file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }
    
    // Set default options
    const maxFrames = options.maxFrames || 5;
    const format = options.format || 'jpg';
    const outputDir = options.outputDir || getTemporaryDir();
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Get video duration
    console.log(`⏱️ Getting video duration...`);
    const duration = await getVideoDurationInSeconds(videoPath);
    console.log(`⏱️ Video duration: ${duration.toFixed(2)} seconds`);
    
    // Calculate frame positions
    const framePositions = calculateFramePositions(duration, maxFrames, options.interval);
    console.log(`🎞️ Will extract ${framePositions.length} frames at positions: ${framePositions.map(p => p.toFixed(2)).join(', ')}`);
    
    // Extract frames
    const frames: VideoFrame[] = [];
    
    for (let i = 0; i < framePositions.length; i++) {
      const position = framePositions[i];
      const timestamp = Math.floor(position * 1000); // Convert to milliseconds
      const outputPath = path.join(outputDir, `frame-${i}-${timestamp}.${format}`);
      
      console.log(`🖼️ Extracting frame at position ${position.toFixed(2)}s to ${outputPath}`);
      
      try {
        await extractFrames({
          input: videoPath,
          output: outputPath,
          offsets: [timestamp]
        });
        
        // Convert to base64 for API calls
        const imageBuffer = fs.readFileSync(outputPath);
        const base64 = imageBuffer.toString('base64');
        
        frames.push({
          path: outputPath,
          position,
          base64,
          mimeType: `image/${format}`
        });
      } catch (err) {
        console.error(`❌ Failed to extract frame at position ${position}s:`, err);
      }
    }
    
    console.log(`✅ Successfully extracted ${frames.length} frames from video`);
    return frames;
  } catch (error) {
    console.error(`❌ Error extracting frames:`, error);
    return [];
  }
}

/**
 * Extract a frame at a specific position in the video
 * @param videoPath Path to the video file
 * @param position Position in seconds to extract the frame
 * @param options Options for frame extraction
 * @returns The extracted video frame
 */
export async function extractFrameAtPosition(
  videoPath: string,
  position: number,
  options: FrameExtractionSettings = {}
): Promise<VideoFrame | null> {
  try {
    console.log(`🎬 Extracting frame at position ${position}s from ${videoPath}`);
    
    // Check if video extraction dependencies are available
    if (!extractFrames || typeof extractFrames !== 'function') {
      console.warn('⚠️ Video frame extraction is disabled due to missing dependencies');
      return null;
    }
    
    // Ensure video file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }
    
    // Set default options
    const format = options.format || 'jpg';
    const outputDir = options.outputDir || getTemporaryDir();
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Extract the frame
    const timestamp = Math.floor(position * 1000); // Convert to milliseconds
    const outputPath = path.join(outputDir, `frame-${timestamp}.${format}`);
    
    await extractFrames({
      input: videoPath,
      output: outputPath,
      offsets: [timestamp]
    });
    
    // Convert to base64 for API calls
    const imageBuffer = fs.readFileSync(outputPath);
    const base64 = imageBuffer.toString('base64');
    
    return {
      path: outputPath,
      position,
      base64,
      mimeType: `image/${format}`
    };
  } catch (error) {
    console.error(`❌ Error extracting frame:`, error);
    return null;
  }
}

/**
 * Calculate positions for frame extraction
 * @param duration Video duration in seconds
 * @param maxFrames Maximum number of frames to extract
 * @param interval Interval between frames in seconds (0 for key moments)
 * @returns Array of positions in seconds
 */
function calculateFramePositions(duration: number, maxFrames: number, interval?: number): number[] {
  if (interval && interval > 0) {
    // Extract frames at regular intervals
    const positions: number[] = [];
    let currentPosition = 0;
    
    while (currentPosition < duration && positions.length < maxFrames) {
      positions.push(currentPosition);
      currentPosition += interval;
    }
    
    return positions;
  } else {
    // Extract frames at key moments (start, 25%, 50%, 75%, end, etc.)
    const positions: number[] = [];
    
    // Always include the start (after a short delay to avoid black frames)
    positions.push(0.5);
    
    if (maxFrames >= 3) {
      // Include the middle of the video
      positions.push(duration / 2);
    }
    
    if (maxFrames >= 4) {
      // Include a frame at 75% of the video
      positions.push(duration * 0.75);
    }
    
    if (maxFrames >= 5) {
      // Include a frame at 25% of the video
      positions.push(duration * 0.25);
    }
    
    // Always include the end (slightly before to avoid black frames)
    positions.push(Math.max(0, duration - 0.5));
    
    // For more frames, add additional positions
    if (maxFrames > 5) {
      const remainingFrames = maxFrames - positions.length;
      const segmentCount = remainingFrames + 1;
      const segmentSize = duration / segmentCount;
      
      for (let i = 1; i <= remainingFrames; i++) {
        positions.push(i * segmentSize);
      }
    }
    
    // Sort positions chronologically
    return positions.sort((a, b) => a - b).slice(0, maxFrames);
  }
}

/**
 * Get a temporary directory for frame extraction
 * @returns Path to a temporary directory
 */
function getTemporaryDir(): string {
  const tempDir = path.join(process.cwd(), 'temp', 'video-frames');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}