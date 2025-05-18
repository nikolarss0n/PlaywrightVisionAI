/**
 * Trace Reader Utility for Playwright Vision Reporter
 * Extracts data from Playwright traces for AI analysis
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as util from 'node:util';
import * as childProcess from 'node:child_process';
import { NetworkRequest } from '../modules/types';

// Convert fs and child_process methods to promises
const fsPromises = fs.promises;
const exec = util.promisify(childProcess.exec);

export interface TraceData {
  screenshots: string[];
  networkRequests: NetworkRequest[];
  html: string;
  errorMessage: string;
  stackTrace: string;
  testInfo: {
    title: string;
    file: string;
    projectName: string;
    duration: number;
  };
}

/**
 * Extract data from a Playwright trace file
 * @param tracePath Path to the Playwright trace file (.zip)
 * @param outputDir Directory to extract trace contents to
 */
export async function extractTraceData(tracePath: string, outputDir: string): Promise<TraceData> {
  console.log(`Extracting trace data from: ${tracePath}`);
  
  // Make sure the output directory exists
  if (!fs.existsSync(outputDir)) {
    await fsPromises.mkdir(outputDir, { recursive: true });
  }
  
  const traceData: TraceData = {
    screenshots: [],
    networkRequests: [],
    html: '',
    errorMessage: '',
    stackTrace: '',
    testInfo: {
      title: '',
      file: '',
      projectName: '',
      duration: 0
    }
  };
  
  try {
    // Extract the trace zip file
    const extractPath = path.join(outputDir, 'trace-extract');
    if (!fs.existsSync(extractPath)) {
      await fsPromises.mkdir(extractPath, { recursive: true });
    }
    
    // Unzip the trace file
    console.log(`Unzipping trace to: ${extractPath}`);
    await exec(`unzip -o "${tracePath}" -d "${extractPath}"`);
    
    // Look for different potential trace file formats
    let traceFiles = [
      path.join(extractPath, 'trace.trace'),
      path.join(extractPath, 'trace.playwright'),
      ...await findFiles(extractPath, '.trace'),
      ...await findFiles(extractPath, '.playwright')
    ];
    
    let traceProcessed = false;
    
    // Try to process each potential trace file
    for (const traceFile of traceFiles) {
      if (fs.existsSync(traceFile)) {
        console.log(`Found trace file: ${traceFile}`);
        try {
          const traceContent = await fsPromises.readFile(traceFile, 'utf-8');
          const traceLines = traceContent.split('\n').filter(line => line.trim());
          
          if (traceLines.length > 0) {
            // Process each line of the trace file
            for (const line of traceLines) {
              try {
                const event = JSON.parse(line);
                await processTraceEvent(event, traceData, extractPath);
              } catch (e) {
                console.warn(`Error processing trace line: ${e}`);
              }
            }
            traceProcessed = true;
            break;
          }
        } catch (e) {
          console.warn(`Error reading trace file ${traceFile}: ${e}`);
        }
      }
    }
    
    if (!traceProcessed) {
      // Alternative approach: Check for action traces in the trace directory
      const actionFiles = await findFiles(extractPath, '.trace-actions');
      for (const actionFile of actionFiles) {
        if (fs.existsSync(actionFile)) {
          console.log(`Found action trace file: ${actionFile}`);
          try {
            const actionContent = await fsPromises.readFile(actionFile, 'utf-8');
            const actionLines = actionContent.split('\n').filter(line => line.trim());
            
            if (actionLines.length > 0) {
              // Process each line of the action file
              for (const line of actionLines) {
                try {
                  const event = JSON.parse(line);
                  await processTraceEvent(event, traceData, extractPath);
                } catch (e) {
                  console.warn(`Error processing action line: ${e}`);
                }
              }
              traceProcessed = true;
              break;
            }
          } catch (e) {
            console.warn(`Error reading action file ${actionFile}: ${e}`);
          }
        }
      }
    }
    
    if (!traceProcessed) {
      console.warn('Could not find or process any trace files. Extracting screenshots only.');
    }
    
    // Extract screenshots from resources directory
    const resourcesDir = path.join(extractPath, 'resources');
    if (fs.existsSync(resourcesDir)) {
      const files = await fsPromises.readdir(resourcesDir);
      const screenshotFiles = files.filter(file => 
        file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')
      );
      
      // Copy screenshots to output directory
      for (const file of screenshotFiles) {
        const sourcePath = path.join(resourcesDir, file);
        const targetPath = path.join(outputDir, file);
        await fsPromises.copyFile(sourcePath, targetPath);
        traceData.screenshots.push(targetPath);
      }
      
      console.log(`Extracted ${traceData.screenshots.length} screenshots from resources directory`);
    }
    
    // Also look for screenshots in the root of the trace directory and subdirectories
    const allScreenshots = await findFiles(extractPath, '.png');
    for (const screenshot of allScreenshots) {
      if (!traceData.screenshots.includes(screenshot)) {
        const targetPath = path.join(outputDir, path.basename(screenshot));
        await fsPromises.copyFile(screenshot, targetPath);
        traceData.screenshots.push(targetPath);
      }
    }
    
    return traceData;
  } catch (error) {
    console.error(`Error extracting trace data: ${error}`);
    return traceData;
  }
}

/**
 * Helper function to find files with a certain extension in a directory and its subdirectories
 */
async function findFiles(dir: string, extension: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subDirFiles = await findFiles(fullPath, extension);
        files.push(...subDirFiles);
      } else if (entry.isFile() && entry.name.endsWith(extension)) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    console.warn(`Error searching for files in ${dir}: ${e}`);
  }
  
  return files;
}

/**
 * Process a single trace event
 */
async function processTraceEvent(event: any, traceData: TraceData, extractPath: string): Promise<void> {
  // Extract test information
  if (event.type === 'test-begin') {
    traceData.testInfo.title = event.title || '';
    traceData.testInfo.file = event.file || '';
    traceData.testInfo.projectName = event.project?.name || '';
  }
  
  // Extract test end information
  if (event.type === 'test-end') {
    traceData.testInfo.duration = event.duration || 0;
    
    // Extract error information if the test failed
    if (event.status === 'failed' && event.error) {
      traceData.errorMessage = event.error.message || '';
      traceData.stackTrace = event.error.stack || '';
    }
  }
  
  // Extract network requests
  if (event.type === 'resource') {
    const request: NetworkRequest = {
      url: event.url || '',
      method: event.method || 'GET',
      status: event.status || 0,
      timestamp: new Date(event.timestamp || Date.now()).toISOString(),
      resourceType: event.resourceType || 'other',
      requestHeaders: event.requestHeaders || {},
      responseHeaders: event.responseHeaders || {},
      requestPostData: event.requestPostData || null,
      responseBody: event.responseBody || ''
    };
    
    traceData.networkRequests.push(request);
  }
  
  // Extract HTML snapshots
  if (event.type === 'snapshot') {
    // Read the snapshot file referenced in the event
    const snapshotPath = path.join(extractPath, 'resources', `${event.snapshot}.html`);
    if (fs.existsSync(snapshotPath)) {
      const snapshotHtml = await fsPromises.readFile(snapshotPath, 'utf-8');
      // Use the most recent HTML snapshot (there might be multiple)
      traceData.html = snapshotHtml;
    }
  }
}

/**
 * Find trace files in a directory
 * @param dir Directory to search for trace files
 * @returns Array of trace file paths
 */
export async function findTraceFiles(dir: string): Promise<string[]> {
  const traceFiles: string[] = [];
  
  try {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subDirTraces = await findTraceFiles(fullPath);
        traceFiles.push(...subDirTraces);
      } else if (entry.isFile() && (entry.name.endsWith('.zip') || entry.name === 'trace.trace')) {
        traceFiles.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error searching for trace files: ${error}`);
  }
  
  return traceFiles;
}

/**
 * Convert a screenshot to base64
 * @param screenshotPath Path to the screenshot file
 * @returns Base64 encoded string
 */
export function screenshotToBase64(screenshotPath: string): string | undefined {
  try {
    const fileData = fs.readFileSync(screenshotPath);
    return fileData.toString('base64');
  } catch (error) {
    console.error(`Error converting screenshot to base64: ${error}`);
    return undefined;
  }
}