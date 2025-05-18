/**
 * Enhanced configuration loader for PlaywrightVisionAI
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Tries to find and load .env files from multiple possible locations
 */
export function loadConfig(): void {
  console.log('🔍 Searching for .env configuration...');
  
  // Possible locations for .env file (in order of preference)
  const searchPaths = [
    // Current working directory
    process.cwd(),
    // Project root directory (if different from cwd)
    path.resolve(__dirname, '../../'),
    // Parent directory (if running from examples)
    path.resolve(__dirname, '../../../'),
    // Detect if in node_modules and try to find project root
    path.resolve(__dirname, '../../../../../')
  ];

  let envLoaded = false;
  
  // Try loading from each location
  for (const basePath of searchPaths) {
    const envPath = path.join(basePath, '.env');
    
    if (fs.existsSync(envPath)) {
      console.log(`✅ Found .env file at: ${envPath}`);
      
      try {
        const result = dotenv.config({ path: envPath });
        
        if (result.error) {
          console.warn(`⚠️ Error loading .env from ${envPath}: ${result.error.message}`);
        } else {
          console.log(`✅ Successfully loaded environment variables from ${envPath}`);
          envLoaded = true;
          
          // Log which provider is configured
          const provider = process.env.DEFAULT_AI_PROVIDER;
          console.log(`🔧 Configured AI provider: ${provider || '(not set)'}`);
          
          // Specific provider key checks
          if (provider === 'claude' || provider === 'both') {
            const claudeKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
            console.log(`🔑 Claude API key: ${claudeKey ? 'Present' : 'Not found'}`);
          }
          
          if (provider === 'gemini' || provider === 'both') {
            const geminiKey = process.env.GEMINI_API_KEY;
            console.log(`🔑 Gemini API key: ${geminiKey ? 'Present' : 'Not found'}`);
          }
          
          break;
        }
      } catch (e) {
        console.warn(`⚠️ Error processing .env file at ${envPath}: ${e}`);
      }
    } else {
      console.log(`ℹ️ No .env file found at: ${envPath}`);
    }
  }
  
  if (!envLoaded) {
    console.warn('⚠️ No valid .env file found in any search location.');
    console.warn('ℹ️ Using environment variables directly from process.env (if any).');
    
    // Check if any API keys are set directly in environment
    const claudeKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    
    console.log(`🔑 Claude API key: ${claudeKey ? 'Present in env' : 'Not found'}`);
    console.log(`🔑 Gemini API key: ${geminiKey ? 'Present in env' : 'Not found'}`);
  }
}

/**
 * Create a copy of the example .env file if no .env file exists
 */
export function createExampleEnvFile(): void {
  const projectRoot = path.resolve(__dirname, '../../');
  const envPath = path.join(projectRoot, '.env');
  const examplePath = path.join(projectRoot, '.env.example');
  
  // Only create if .env doesn't exist but .env.example does
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    try {
      fs.copyFileSync(examplePath, envPath);
      console.log(`✅ Created new .env file from .env.example at: ${envPath}`);
      console.log('⚠️ Please edit this file to add your API keys before running tests.');
    } catch (e) {
      console.warn(`⚠️ Failed to create .env file: ${e}`);
    }
  }
}