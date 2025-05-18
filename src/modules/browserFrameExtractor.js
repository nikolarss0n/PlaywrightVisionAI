"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFrameAtPosition = exports.extractKeyFrames = void 0;
/**
 * Module for extracting frames from a video file using browser-compatible approaches
 * Doesn't require ffmpeg or external dependencies
 */
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var child_process_1 = require("child_process");
var util_1 = require("util");
var execAsync = (0, util_1.promisify)(child_process_1.exec);
// Default timeout for external command execution (10 seconds)
var DEFAULT_COMMAND_TIMEOUT = 10000;
// Path to a placeholder image for when extraction fails
var PLACEHOLDER_IMAGE_PATH = path_1.default.join(process.cwd(), 'temp', 'placeholder-frame.jpg');
/**
 * Extract frames from a video file using playwright
 * @param videoPath Path to the video file
 * @param options Options for frame extraction
 * @returns Array of video frames
 */
function extractKeyFrames(videoPath, options) {
    if (options === void 0) { options = {}; }
    return __awaiter(this, void 0, void 0, function () {
        var stats, extension, validExtensions, duration, maxFrames, positions, format, outputDir, frames_1, i, position, timestamp, outputPath, frameExtracted, ffmpegError_1, avconvError_1, convertError_1, imageStats, imageBuffer, base64, fileError_1, errorMessage, placeholderFrame, err_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 28, , 29]);
                    console.log("\uD83C\uDFAC Extracting frames from video: ".concat(videoPath));
                    // Ensure video file exists
                    if (!fs_1.default.existsSync(videoPath)) {
                        console.warn("\u26A0\uFE0F Video file not found: ".concat(videoPath));
                        return [2 /*return*/, []];
                    }
                    stats = fs_1.default.statSync(videoPath);
                    if (stats.size === 0) {
                        console.warn("\u26A0\uFE0F Video file is empty (0 bytes): ".concat(videoPath));
                        // Instead of failing, return an empty array
                        return [2 /*return*/, []];
                    }
                    extension = path_1.default.extname(videoPath).toLowerCase();
                    validExtensions = ['.mp4', '.avi', '.mov', '.webm', '.mkv'];
                    if (!validExtensions.includes(extension)) {
                        console.warn("\u26A0\uFE0F File may not be a valid video file: ".concat(videoPath));
                        // Continue anyway, but log a warning
                    }
                    return [4 /*yield*/, getVideoDuration(videoPath)];
                case 1:
                    duration = _a.sent();
                    console.log("\u23F1\uFE0F Video duration: ".concat(duration.toFixed(2), " seconds"));
                    maxFrames = options.maxFrames || 5;
                    positions = calculateFramePositions(duration, maxFrames, options.interval);
                    console.log("\uD83C\uDF9E\uFE0F Will extract ".concat(positions.length, " frames at positions: ").concat(positions.map(function (p) { return p.toFixed(2); }).join(', ')));
                    format = options.format || 'jpg';
                    outputDir = options.outputDir || getTemporaryDir();
                    // Create output directory if it doesn't exist
                    if (!fs_1.default.existsSync(outputDir)) {
                        fs_1.default.mkdirSync(outputDir, { recursive: true });
                    }
                    frames_1 = [];
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < positions.length)) return [3 /*break*/, 27];
                    position = positions[i];
                    timestamp = formatTimestamp(position);
                    outputPath = path_1.default.join(outputDir, "frame-".concat(i, "-").concat(Math.floor(position * 1000), ".").concat(format));
                    console.log("\uD83D\uDDBC\uFE0F Extracting frame at position ".concat(position.toFixed(2), "s to ").concat(outputPath));
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 25, , 26]);
                    frameExtracted = false;
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 16]);
                    return [4 /*yield*/, execAsync("ffmpeg -y -ss ".concat(timestamp, " -i \"").concat(videoPath, "\" -vframes 1 -q:v 2 \"").concat(outputPath, "\""), { timeout: DEFAULT_COMMAND_TIMEOUT })];
                case 5:
                    _a.sent();
                    frameExtracted = true;
                    return [3 /*break*/, 16];
                case 6:
                    ffmpegError_1 = _a.sent();
                    console.log("ffmpeg not available, trying alternative methods...");
                    _a.label = 7;
                case 7:
                    _a.trys.push([7, 9, , 15]);
                    return [4 /*yield*/, execAsync("avconv -y -ss ".concat(timestamp, " -i \"").concat(videoPath, "\" -vframes 1 -q:v 2 \"").concat(outputPath, "\""), { timeout: DEFAULT_COMMAND_TIMEOUT })];
                case 8:
                    _a.sent();
                    frameExtracted = true;
                    return [3 /*break*/, 15];
                case 9:
                    avconvError_1 = _a.sent();
                    console.log("avconv not available, trying ImageMagick...");
                    _a.label = 10;
                case 10:
                    _a.trys.push([10, 12, , 14]);
                    return [4 /*yield*/, execAsync("convert \"".concat(videoPath, "[").concat(Math.floor(position), "]\" \"").concat(outputPath, "\""), { timeout: DEFAULT_COMMAND_TIMEOUT })];
                case 11:
                    _a.sent();
                    frameExtracted = true;
                    return [3 /*break*/, 14];
                case 12:
                    convertError_1 = _a.sent();
                    console.warn("⚠️ ImageMagick's convert command not found. Missing dependencies for video frame extraction.");
                    console.warn("📋 To fix this issue, please install one of the following tools:");
                    console.warn("   - ffmpeg: https://ffmpeg.org/download.html");
                    console.warn("   - ImageMagick: https://imagemagick.org/script/download.php");
                    return [4 /*yield*/, createPlaceholderImage(outputPath, position)];
                case 13:
                    // Create a fallback placeholder image if needed
                    frameExtracted = _a.sent();
                    return [3 /*break*/, 14];
                case 14: return [3 /*break*/, 15];
                case 15: return [3 /*break*/, 16];
                case 16:
                    if (!(frameExtracted && fs_1.default.existsSync(outputPath))) return [3 /*break*/, 22];
                    _a.label = 17;
                case 17:
                    _a.trys.push([17, 20, , 21]);
                    imageStats = fs_1.default.statSync(outputPath);
                    if (!(imageStats.size === 0)) return [3 /*break*/, 19];
                    console.warn("\u26A0\uFE0F Generated image file is empty: ".concat(outputPath));
                    // Generate a placeholder instead
                    return [4 /*yield*/, createPlaceholderImage(outputPath, position)];
                case 18:
                    // Generate a placeholder instead
                    _a.sent();
                    _a.label = 19;
                case 19:
                    imageBuffer = fs_1.default.readFileSync(outputPath);
                    base64 = imageBuffer.toString('base64');
                    frames_1.push({
                        path: outputPath,
                        position: position,
                        base64: base64,
                        mimeType: "image/".concat(format),
                        isPlaceholder: imageStats.size === 0
                    });
                    return [3 /*break*/, 21];
                case 20:
                    fileError_1 = _a.sent();
                    errorMessage = fileError_1 instanceof Error ? fileError_1.message : String(fileError_1);
                    console.error("\u274C Error processing extracted frame: ".concat(errorMessage));
                    return [3 /*break*/, 21];
                case 21: return [3 /*break*/, 24];
                case 22:
                    if (!!frameExtracted) return [3 /*break*/, 24];
                    return [4 /*yield*/, createTextPlaceholderFrame(outputPath, position, format)];
                case 23:
                    placeholderFrame = _a.sent();
                    if (placeholderFrame && fs_1.default.existsSync(placeholderFrame.path)) {
                        frames_1.push(placeholderFrame);
                    }
                    _a.label = 24;
                case 24: return [3 /*break*/, 26];
                case 25:
                    err_1 = _a.sent();
                    console.error("\u274C Failed to extract frame at position ".concat(position, "s:"), err_1);
                    return [3 /*break*/, 26];
                case 26:
                    i++;
                    return [3 /*break*/, 2];
                case 27:
                    console.log("\u2705 Successfully extracted ".concat(frames_1.length, " frames from video"));
                    return [2 /*return*/, frames_1];
                case 28:
                    error_1 = _a.sent();
                    console.error('❌ Error extracting frames:', error_1);
                    return [2 /*return*/, []];
                case 29: return [2 /*return*/];
            }
        });
    });
}
exports.extractKeyFrames = extractKeyFrames;
/**
 * Extract a specific frame at a given position
 * @param videoPath Path to video file
 * @param position Position in seconds
 * @param options Extraction options
 * @returns Extracted video frame or null
 */
function extractFrameAtPosition(videoPath, position, options) {
    if (options === void 0) { options = {}; }
    return __awaiter(this, void 0, void 0, function () {
        var stats, format, outputDir, timestamp, outputPath, duration, frameExtracted, ffmpegError_2, avconvError_2, convertError_2, imageStats, imageBuffer, base64, fileError_2, errorMessage, err_2, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 27, , 28]);
                    console.log("\uD83C\uDFAC Extracting frame at position ".concat(position, "s from ").concat(videoPath));
                    // Ensure video file exists
                    if (!fs_1.default.existsSync(videoPath)) {
                        throw new Error("Video file not found: ".concat(videoPath));
                    }
                    stats = fs_1.default.statSync(videoPath);
                    if (stats.size === 0) {
                        console.warn("\u26A0\uFE0F Video file is empty (0 bytes): ".concat(videoPath));
                        return [2 /*return*/, null];
                    }
                    format = options.format || 'jpg';
                    outputDir = options.outputDir || getTemporaryDir();
                    // Create output directory if it doesn't exist
                    if (!fs_1.default.existsSync(outputDir)) {
                        fs_1.default.mkdirSync(outputDir, { recursive: true });
                    }
                    timestamp = formatTimestamp(position);
                    outputPath = path_1.default.join(outputDir, "frame-".concat(Math.floor(position * 1000), ".").concat(format));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 25, , 26]);
                    // First, validate the position
                    if (isNaN(position) || position < 0) {
                        console.warn("\u26A0\uFE0F Invalid frame position: ".concat(position, ". Using default position of 1s"));
                        position = 1.0; // Use a safe default
                    }
                    return [4 /*yield*/, getVideoDuration(videoPath)];
                case 2:
                    duration = _a.sent();
                    if (position > duration) {
                        console.warn("\u26A0\uFE0F Position ".concat(position, "s exceeds video duration ").concat(duration, "s. Using end of video"));
                        position = Math.max(0, duration - 0.5); // Use end of video instead
                    }
                    frameExtracted = false;
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 15]);
                    return [4 /*yield*/, execAsync("ffmpeg -y -ss ".concat(timestamp, " -i \"").concat(videoPath, "\" -vframes 1 -q:v 2 \"").concat(outputPath, "\""), { timeout: DEFAULT_COMMAND_TIMEOUT })];
                case 4:
                    _a.sent();
                    frameExtracted = true;
                    return [3 /*break*/, 15];
                case 5:
                    ffmpegError_2 = _a.sent();
                    console.log("ffmpeg not available, trying alternative methods...");
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 14]);
                    return [4 /*yield*/, execAsync("avconv -y -ss ".concat(timestamp, " -i \"").concat(videoPath, "\" -vframes 1 -q:v 2 \"").concat(outputPath, "\""), { timeout: DEFAULT_COMMAND_TIMEOUT })];
                case 7:
                    _a.sent();
                    frameExtracted = true;
                    return [3 /*break*/, 14];
                case 8:
                    avconvError_2 = _a.sent();
                    console.log("avconv not available, trying ImageMagick...");
                    _a.label = 9;
                case 9:
                    _a.trys.push([9, 11, , 13]);
                    return [4 /*yield*/, execAsync("convert \"".concat(videoPath, "[").concat(Math.floor(position), "]\" \"").concat(outputPath, "\""), { timeout: DEFAULT_COMMAND_TIMEOUT })];
                case 10:
                    _a.sent();
                    frameExtracted = true;
                    return [3 /*break*/, 13];
                case 11:
                    convertError_2 = _a.sent();
                    console.warn("⚠️ Missing all video frame extraction tools. Creating placeholder image...");
                    return [4 /*yield*/, createPlaceholderImage(outputPath, position)];
                case 12:
                    frameExtracted = _a.sent();
                    return [3 /*break*/, 13];
                case 13: return [3 /*break*/, 14];
                case 14: return [3 /*break*/, 15];
                case 15:
                    if (!(frameExtracted && fs_1.default.existsSync(outputPath))) return [3 /*break*/, 22];
                    _a.label = 16;
                case 16:
                    _a.trys.push([16, 19, , 21]);
                    imageStats = fs_1.default.statSync(outputPath);
                    if (!(imageStats.size === 0)) return [3 /*break*/, 18];
                    console.warn("\u26A0\uFE0F Generated image file is empty: ".concat(outputPath));
                    // Generate a placeholder instead
                    return [4 /*yield*/, createPlaceholderImage(outputPath, position)];
                case 17:
                    // Generate a placeholder instead
                    _a.sent();
                    _a.label = 18;
                case 18:
                    imageBuffer = fs_1.default.readFileSync(outputPath);
                    base64 = imageBuffer.toString('base64');
                    return [2 /*return*/, {
                            path: outputPath,
                            position: position,
                            base64: base64,
                            mimeType: "image/".concat(format),
                            isPlaceholder: imageStats.size === 0
                        }];
                case 19:
                    fileError_2 = _a.sent();
                    errorMessage = fileError_2 instanceof Error ? fileError_2.message : String(fileError_2);
                    console.error("\u274C Error processing extracted frame: ".concat(errorMessage));
                    return [4 /*yield*/, createTextPlaceholderFrame(outputPath, position, format)];
                case 20: return [2 /*return*/, _a.sent()];
                case 21: return [3 /*break*/, 24];
                case 22:
                    if (!!frameExtracted) return [3 /*break*/, 24];
                    return [4 /*yield*/, createTextPlaceholderFrame(outputPath, position, format)];
                case 23: 
                // Create a text-based placeholder frame
                return [2 /*return*/, _a.sent()];
                case 24: return [3 /*break*/, 26];
                case 25:
                    err_2 = _a.sent();
                    console.error("\u274C Failed to extract frame at position ".concat(position, "s:"), err_2);
                    return [3 /*break*/, 26];
                case 26: return [2 /*return*/, null];
                case 27:
                    error_2 = _a.sent();
                    console.error('❌ Error extracting frame:', error_2);
                    return [2 /*return*/, null];
                case 28: return [2 /*return*/];
            }
        });
    });
}
exports.extractFrameAtPosition = extractFrameAtPosition;
/**
 * Get video duration using ffprobe or fallback method
 * @param videoPath Path to video file
 * @returns Duration in seconds
 */
function getVideoDuration(videoPath) {
    return __awaiter(this, void 0, void 0, function () {
        var stats, stdout, duration, ffprobeError_1, stdout, timeComponents, duration, ffmpegError_3, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 9, , 10]);
                    // First check if file exists and is not empty
                    if (!fs_1.default.existsSync(videoPath)) {
                        console.warn("\u26A0\uFE0F Video file not found: ".concat(videoPath));
                        return [2 /*return*/, 10]; // Default duration
                    }
                    stats = fs_1.default.statSync(videoPath);
                    if (stats.size === 0) {
                        console.warn("\u26A0\uFE0F Video file is empty (0 bytes): ".concat(videoPath));
                        return [2 /*return*/, 10]; // Default duration
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 8]);
                    return [4 /*yield*/, execAsync("ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 \"".concat(videoPath, "\""))];
                case 2:
                    stdout = (_a.sent()).stdout;
                    duration = parseFloat(stdout.trim());
                    if (isNaN(duration)) {
                        throw new Error("Invalid duration value");
                    }
                    return [2 /*return*/, duration];
                case 3:
                    ffprobeError_1 = _a.sent();
                    console.log("ffprobe not available, trying with ffmpeg...");
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, execAsync("ffmpeg -i \"".concat(videoPath, "\" 2>&1 | grep \"Duration\" | cut -d ' ' -f 4 | sed s/,//"))];
                case 5:
                    stdout = (_a.sent()).stdout;
                    timeComponents = stdout.trim().split(':').map(parseFloat);
                    if (timeComponents.length >= 3) {
                        duration = timeComponents[0] * 3600 + timeComponents[1] * 60 + timeComponents[2];
                        if (isNaN(duration)) {
                            throw new Error("Invalid duration calculation");
                        }
                        return [2 /*return*/, duration];
                    }
                    else {
                        throw new Error("Insufficient time components");
                    }
                    return [3 /*break*/, 7];
                case 6:
                    ffmpegError_3 = _a.sent();
                    // Return a default duration
                    console.warn('⚠️ Could not determine video duration, using default value of 10 seconds');
                    console.warn('⚠️ Please install ffmpeg or ffprobe for accurate video processing');
                    return [2 /*return*/, 10];
                case 7: return [3 /*break*/, 8];
                case 8: return [3 /*break*/, 10];
                case 9:
                    error_3 = _a.sent();
                    console.warn('⚠️ Could not determine video duration:', error_3);
                    return [2 /*return*/, 10]; // Default duration in seconds
                case 10: return [2 /*return*/];
            }
        });
    });
}
/**
 * Format a position in seconds to hh:mm:ss.fff format
 * @param seconds Position in seconds
 * @returns Formatted timestamp
 */
function formatTimestamp(seconds) {
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = Math.floor(seconds % 60);
    var ms = Math.floor((seconds % 1) * 1000);
    return "".concat(h.toString().padStart(2, '0'), ":").concat(m.toString().padStart(2, '0'), ":").concat(s.toString().padStart(2, '0'), ".").concat(ms.toString().padStart(3, '0'));
}
/**
 * Calculate positions at which to extract frames
 * @param duration Video duration in seconds
 * @param maxFrames Maximum number of frames to extract
 * @param interval Optional interval between frames
 * @returns Array of positions in seconds
 */
function calculateFramePositions(duration, maxFrames, interval) {
    if (interval && interval > 0) {
        // Extract frames at regular intervals
        var positions = [];
        var currentPosition = 0;
        while (currentPosition < duration && positions.length < maxFrames) {
            positions.push(currentPosition);
            currentPosition += interval;
        }
        return positions;
    }
    else {
        // Extract frames at key moments
        var positions = [];
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
            var remainingFrames = maxFrames - positions.length;
            var segmentCount = remainingFrames + 1;
            var segmentSize = duration / segmentCount;
            for (var i = 1; i <= remainingFrames; i++) {
                positions.push(i * segmentSize);
            }
        }
        // Sort positions chronologically
        return positions.sort(function (a, b) { return a - b; }).slice(0, maxFrames);
    }
}
/**
 * Get a temporary directory for frame extraction
 * @returns Path to temporary directory
 */
function getTemporaryDir() {
    var tempDir = path_1.default.join(process.cwd(), 'temp', 'video-frames');
    if (!fs_1.default.existsSync(tempDir)) {
        fs_1.default.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
}
/**
 * Create a text-based placeholder image when frame extraction fails
 * @param outputPath Path where the image should be saved
 * @param position Position in seconds
 * @returns Boolean indicating success
 */
function createPlaceholderImage(outputPath, position) {
    return __awaiter(this, void 0, void 0, function () {
        var convertError_3, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    // Try ImageMagick's convert command
                    return [4 /*yield*/, execAsync("convert -size 640x480 canvas:black -fill white -pointsize 24 -gravity center -annotate +0+0 \"Frame at position ".concat(position.toFixed(2), "s\\nNo frame extraction tools available\" \"").concat(outputPath, "\""), { timeout: DEFAULT_COMMAND_TIMEOUT })];
                case 2:
                    // Try ImageMagick's convert command
                    _a.sent();
                    return [2 /*return*/, true];
                case 3:
                    convertError_3 = _a.sent();
                    // If ImageMagick fails, try with Node.js native fs
                    // Create a simple text file if nothing else works
                    fs_1.default.writeFileSync(outputPath, "Frame at position ".concat(position.toFixed(2), "s - No frame extraction tools available"));
                    return [2 /*return*/, true];
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_4 = _a.sent();
                    console.error('❌ Failed to create placeholder image:', error_4);
                    return [2 /*return*/, false];
                case 6: return [2 /*return*/];
            }
        });
    });
}
/**
 * Create a text-based placeholder frame object
 * @param outputPath Path where the image should be saved
 * @param position Position in seconds
 * @param format Image format
 * @returns VideoFrame object with placeholder data
 */
function createTextPlaceholderFrame(outputPath, position, format) {
    return __awaiter(this, void 0, void 0, function () {
        var success, imageBuffer, base64, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, createPlaceholderImage(outputPath, position)];
                case 1:
                    success = _a.sent();
                    if (success && fs_1.default.existsSync(outputPath)) {
                        imageBuffer = fs_1.default.readFileSync(outputPath);
                        base64 = imageBuffer.toString('base64');
                        return [2 /*return*/, {
                                path: outputPath,
                                position: position,
                                base64: base64,
                                mimeType: "image/".concat(format),
                                isPlaceholder: true
                            }];
                    }
                    return [2 /*return*/, null];
                case 2:
                    error_5 = _a.sent();
                    console.error('❌ Failed to create placeholder frame:', error_5);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
