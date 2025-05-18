/**
 * Script to verify the AI provider configuration
 */
import { loadConfig } from '../modules/configLoader';

// Load and verify configuration
console.log('🔍 Verifying PlaywrightVisionAI configuration...');
loadConfig();

// Check provider configuration
const provider = process.env.DEFAULT_AI_PROVIDER;
console.log(`\n📊 Configuration Summary:`);
console.log(`---------------------`);
console.log(`Selected Provider: ${provider || '(not set)'}`);

// Check API keys
const claudeKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

console.log(`Claude API Key: ${claudeKey ? '✅ Available' : '❌ Not found'}`);
console.log(`Gemini API Key: ${geminiKey ? '✅ Available' : '❌ Not found'}`);

// Check model names
console.log(`Claude Model: ${process.env.CLAUDE_MODEL || 'default (claude-3-opus-20240229)'}`);
console.log(`Gemini Model: ${process.env.GEMINI_MODEL_NAME || 'default (gemini-1.5-pro-latest)'}`);

// Verify configuration is correct
if (provider === 'claude' && !claudeKey) {
  console.error('❌ ERROR: Claude selected as provider but ANTHROPIC_API_KEY is not set');
  process.exit(1);
} else if (provider === 'gemini' && !geminiKey) {
  console.error('❌ ERROR: Gemini selected as provider but GEMINI_API_KEY is not set');
  process.exit(1);
} else if (provider === 'both' && (!claudeKey || !geminiKey)) {
  console.error('❌ ERROR: Both providers selected but one or more API keys are missing');
  process.exit(1);
} else if (!provider) {
  console.error('❌ ERROR: No AI provider selected in DEFAULT_AI_PROVIDER');
  process.exit(1);
} else {
  console.log(`\n✅ Configuration looks good for ${provider} provider!`);
}

// Suggest next steps
if (provider === 'both') {
  console.log(`\n⚠️ Warning: Using 'both' providers may lead to quota issues.`);
  console.log(`Consider switching to a single provider by setting DEFAULT_AI_PROVIDER=claude or DEFAULT_AI_PROVIDER=gemini`);
}