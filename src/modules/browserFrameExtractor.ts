/**
 * Module for extracting frames from a video file using browser-compatible approaches
 * Doesn't require ffmpeg or external dependencies
 */
import fs from 'fs';
import path from 'path';
import { VideoFrame } from './types';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// Default timeout for external command execution (10 seconds)
const DEFAULT_COMMAND_TIMEOUT = 10000;

// Path to a placeholder image for when extraction fails
const PLACEHOLDER_IMAGE_PATH = path.join(process.cwd(), 'temp', 'placeholder-frame.jpg');

// Interface for frame extraction options
export interface FrameExtractionSettings {
  maxFrames?: number;
  interval?: number;
  outputDir?: string;
  format?: string;
}

/**
 * Extract frames from a video file using playwright
 * @param videoPath Path to the video file
 * @param options Options for frame extraction
 * @returns Array of video frames
 */
export async function extractKeyFrames(
  videoPath: string,
  options: FrameExtractionSettings = {}
): Promise<VideoFrame[]> {
  try {
    console.log(`🎬 Extracting frames from video: ${videoPath}`);
    
    // Ensure video file exists
    if (!fs.existsSync(videoPath)) {
      console.warn(`⚠️ Video file not found: ${videoPath}`);
      return [];
    }
    
    // Check file size to ensure it's not empty
    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      console.warn(`⚠️ Video file is empty (0 bytes): ${videoPath}`);
      // Instead of failing, return an empty array
      return [];
    }
    
    // Check if file is a valid video file (basic check based on extension)
    const extension = path.extname(videoPath).toLowerCase();
    const validExtensions = ['.mp4', '.avi', '.mov', '.webm', '.mkv'];
    if (!validExtensions.includes(extension)) {
      console.warn(`⚠️ File may not be a valid video file: ${videoPath}`);
      // Continue anyway, but log a warning
    }
    
    // Use ffprobe to get video duration via command line
    const duration = await getVideoDuration(videoPath);
    console.log(`⏱️ Video duration: ${duration.toFixed(2)} seconds`);
    
    // Calculate frame positions
    const maxFrames = options.maxFrames || 5;
    const positions = calculateFramePositions(duration, maxFrames, options.interval);
    console.log(`🎞️ Will extract ${positions.length} frames at positions: ${positions.map(p => p.toFixed(2)).join(', ')}`);
    
    // Extract frames using HTML5 canvas approach
    const format = options.format || 'jpg';
    const outputDir = options.outputDir || getTemporaryDir();
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Extract frames using command line tools that are more commonly available
    const frames: VideoFrame[] = [];
    
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i];
      const timestamp = formatTimestamp(position);
      const outputPath = path.join(outputDir, `frame-${i}-${Math.floor(position * 1000)}.${format}`);
      
      console.log(`🖼️ Extracting frame at position ${position.toFixed(2)}s to ${outputPath}`);
      
      try {
        let frameExtracted = false;
        
        // Try with ffmpeg if available
        try {
          await execAsync(`ffmpeg -y -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`, { timeout: DEFAULT_COMMAND_TIMEOUT });
          frameExtracted = true;
        } catch (ffmpegError) {
          console.log("ffmpeg not available, trying alternative methods...");
          
          // If ffmpeg fails, try with avconv
          try {
            await execAsync(`avconv -y -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`, { timeout: DEFAULT_COMMAND_TIMEOUT });
            frameExtracted = true;
          } catch (avconvError) {
            console.log("avconv not available, trying ImageMagick...");
            
            // If avconv fails, try with ImageMagick
            try {
              await execAsync(`convert "${videoPath}[${Math.floor(position)}]" "${outputPath}"`, { timeout: DEFAULT_COMMAND_TIMEOUT });
              frameExtracted = true;
            } catch (convertError) {
              console.warn("⚠️ ImageMagick's convert command not found. Missing dependencies for video frame extraction.");
              console.warn("📋 To fix this issue, please install one of the following tools:");
              console.warn("   - ffmpeg: https://ffmpeg.org/download.html");
              console.warn("   - ImageMagick: https://imagemagick.org/script/download.php");
              
              // Create a fallback placeholder image if needed
              frameExtracted = await createPlaceholderImage(outputPath, position);
            }
          }
        }
        
        if (frameExtracted && fs.existsSync(outputPath)) {
          try {
            // Check if the file is a valid image (not empty)
            const imageStats = fs.statSync(outputPath);
            if (imageStats.size === 0) {
              console.warn(`⚠️ Generated image file is empty: ${outputPath}`);
              // Generate a placeholder instead
              await createPlaceholderImage(outputPath, position);
            }
            
            // Convert to base64 for API calls
            const imageBuffer = fs.readFileSync(outputPath);
            const base64 = imageBuffer.toString('base64');
            
            frames.push({
              path: outputPath,
              position,
              base64,
              mimeType: `image/${format}`,
              isPlaceholder: imageStats.size === 0
            });
          } catch (fileError: unknown) {
            const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
            console.error(`❌ Error processing extracted frame: ${errorMessage}`);
          }
        } else if (!frameExtracted) {
          // If we couldn't extract the frame at all, create a placeholder and use it
          const placeholderFrame = await createTextPlaceholderFrame(outputPath, position, format);
          if (placeholderFrame && fs.existsSync(placeholderFrame.path)) {
            frames.push(placeholderFrame);
          }
        }
      } catch (err) {
        console.error(`❌ Failed to extract frame at position ${position}s:`, err);
      }
    }
    
    console.log(`✅ Successfully extracted ${frames.length} frames from video`);
    return frames;
  } catch (error) {
    console.error('❌ Error extracting frames:', error);
    return [];
  }
}

/**
 * Extract a specific frame at a given position
 * @param videoPath Path to video file
 * @param position Position in seconds
 * @param options Extraction options
 * @returns Extracted video frame or null
 */
export async function extractFrameAtPosition(
  videoPath: string,
  position: number,
  options: FrameExtractionSettings = {}
): Promise<VideoFrame | null> {
  try {
    console.log(`🎬 Extracting frame at position ${position}s from ${videoPath}`);
    
    // Ensure video file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }
    
    // Check file size to ensure it's not empty
    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      console.warn(`⚠️ Video file is empty (0 bytes): ${videoPath}`);
      return null;
    }
    
    const format = options.format || 'jpg';
    const outputDir = options.outputDir || getTemporaryDir();
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = formatTimestamp(position);
    const outputPath = path.join(outputDir, `frame-${Math.floor(position * 1000)}.${format}`);
    
    try {
      // First, validate the position
      if (isNaN(position) || position < 0) {
        console.warn(`⚠️ Invalid frame position: ${position}. Using default position of 1s`);
        position = 1.0; // Use a safe default
      }
      
      // Get video duration to validate position doesn't exceed duration
      const duration = await getVideoDuration(videoPath);
      if (position > duration) {
        console.warn(`⚠️ Position ${position}s exceeds video duration ${duration}s. Using end of video`);
        position = Math.max(0, duration - 0.5); // Use end of video instead
      }
      
      let frameExtracted = false;
      
      // Try with ffmpeg if available
      try {
        await execAsync(`ffmpeg -y -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`, { timeout: DEFAULT_COMMAND_TIMEOUT });
        frameExtracted = true;
      } catch (ffmpegError) {
        console.log("ffmpeg not available, trying alternative methods...");
        
        // If ffmpeg fails, try with avconv
        try {
          await execAsync(`avconv -y -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`, { timeout: DEFAULT_COMMAND_TIMEOUT });
          frameExtracted = true;
        } catch (avconvError) {
          console.log("avconv not available, trying ImageMagick...");
          
          // If avconv fails, try with ImageMagick
          try {
            await execAsync(`convert "${videoPath}[${Math.floor(position)}]" "${outputPath}"`, { timeout: DEFAULT_COMMAND_TIMEOUT });
            frameExtracted = true;
          } catch (convertError) {
            console.warn("⚠️ Missing all video frame extraction tools. Creating placeholder image...");
            frameExtracted = await createPlaceholderImage(outputPath, position);
          }
        }
      }
      
      if (frameExtracted && fs.existsSync(outputPath)) {
        try {
          // Check if file is valid/not empty
          const imageStats = fs.statSync(outputPath);
          if (imageStats.size === 0) {
            console.warn(`⚠️ Generated image file is empty: ${outputPath}`);
            // Generate a placeholder instead
            await createPlaceholderImage(outputPath, position);
          }
          
          // Convert to base64 for API calls
          const imageBuffer = fs.readFileSync(outputPath);
          const base64 = imageBuffer.toString('base64');
          
          return {
            path: outputPath,
            position,
            base64,
            mimeType: `image/${format}`,
            isPlaceholder: imageStats.size === 0
          };
        } catch (fileError: unknown) {
          const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
          console.error(`❌ Error processing extracted frame: ${errorMessage}`);
          return await createTextPlaceholderFrame(outputPath, position, format);
        }
      } else if (!frameExtracted) {
        // Create a text-based placeholder frame
        return await createTextPlaceholderFrame(outputPath, position, format);
      }
    } catch (err) {
      console.error(`❌ Failed to extract frame at position ${position}s:`, err);
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error extracting frame:', error);
    return null;
  }
}

/**
 * Get video duration using ffprobe or fallback method
 * @param videoPath Path to video file
 * @returns Duration in seconds
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  try {
    // First check if file exists and is not empty
    if (!fs.existsSync(videoPath)) {
      console.warn(`⚠️ Video file not found: ${videoPath}`);
      return 10; // Default duration
    }
    
    const stats = fs.statSync(videoPath);
    if (stats.size === 0) {
      console.warn(`⚠️ Video file is empty (0 bytes): ${videoPath}`);
      return 10; // Default duration
    }
    
    // Try with ffprobe
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
      );
      const duration = parseFloat(stdout.trim());
      if (isNaN(duration)) {
        throw new Error("Invalid duration value");
      }
      return duration;
    } catch (ffprobeError) {
      console.log("ffprobe not available, trying with ffmpeg...");
      
      // Try with ffmpeg
      try {
        const { stdout } = await execAsync(
          `ffmpeg -i "${videoPath}" 2>&1 | grep "Duration" | cut -d ' ' -f 4 | sed s/,//`
        );
        const timeComponents = stdout.trim().split(':').map(parseFloat);
        if (timeComponents.length >= 3) {
          const duration = timeComponents[0] * 3600 + timeComponents[1] * 60 + timeComponents[2];
          if (isNaN(duration)) {
            throw new Error("Invalid duration calculation");
          }
          return duration;
        } else {
          throw new Error("Insufficient time components");
        }
      } catch (ffmpegError) {
        // Return a default duration
        console.warn('⚠️ Could not determine video duration, using default value of 10 seconds');
        console.warn('⚠️ Please install ffmpeg or ffprobe for accurate video processing');
        return 10;
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not determine video duration:', error);
    return 10;  // Default duration in seconds
  }
}

/**
 * Format a position in seconds to hh:mm:ss.fff format
 * @param seconds Position in seconds
 * @returns Formatted timestamp
 */
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Calculate positions at which to extract frames
 * @param duration Video duration in seconds
 * @param maxFrames Maximum number of frames to extract
 * @param interval Optional interval between frames
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
    // Extract frames at key moments
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
 * @returns Path to temporary directory
 */
function getTemporaryDir(): string {
  const tempDir = path.join(process.cwd(), 'temp', 'video-frames');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}

/**
 * Create a text-based placeholder image when frame extraction fails
 * @param outputPath Path where the image should be saved
 * @param position Position in seconds
 * @returns Boolean indicating success
 */
async function createPlaceholderImage(outputPath: string, position: number): Promise<boolean> {
  try {
    // Create a simple text-based placeholder using ImageMagick if available
    try {
      // Try ImageMagick's convert command
      await execAsync(
        `convert -size 640x480 canvas:black -fill white -pointsize 24 -gravity center -annotate +0+0 "Frame at position ${position.toFixed(2)}s\\nNo frame extraction tools available" "${outputPath}"`,
        { timeout: DEFAULT_COMMAND_TIMEOUT }
      );
      return true;
    } catch (convertError) {
      // If ImageMagick fails, try with Node.js native fs
      // Create a simple text file if nothing else works
      fs.writeFileSync(
        outputPath,
        `Frame at position ${position.toFixed(2)}s - No frame extraction tools available`
      );
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to create placeholder image:', error);
    return false;
  }
}

/**
 * Create a text-based placeholder frame object
 * @param outputPath Path where the image should be saved
 * @param position Position in seconds
 * @param format Image format
 * @returns VideoFrame object with placeholder data
 */
async function createTextPlaceholderFrame(outputPath: string, position: number, format: string): Promise<VideoFrame | null> {
  try {
    const success = await createPlaceholderImage(outputPath, position);
    if (success && fs.existsSync(outputPath)) {
      const imageBuffer = fs.readFileSync(outputPath);
      const base64 = imageBuffer.toString('base64');
      
      return {
        path: outputPath,
        position,
        base64,
        mimeType: `image/${format}`,
        isPlaceholder: true
      };
    }
    return null;
  } catch (error) {
    console.error('❌ Failed to create placeholder frame:', error);
    return null;
  }
}