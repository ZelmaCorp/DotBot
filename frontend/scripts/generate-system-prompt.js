#!/usr/bin/env node

/**
 * Generate System Prompt Script
 * 
 * Run from terminal: npm run generate-prompt
 * or: node scripts/generate-system-prompt.js
 * 
 * NOTE: This outputs a simplified version. For the full system prompt with
 * all knowledge base data, use the browser console method (see instructions below).
 */

const fs = require('fs');
const path = require('path');

console.log('📝 System Prompt Generator\n');
console.log('='.repeat(60));
console.log('OPTION 1: Browser Console (Recommended for Full Prompt)\n');
console.log('1. Start dev server: npm start');
console.log('2. Open browser console (F12)');
console.log('3. Run this code:\n');
console.log('   // In browser console:');
console.log('   const { logSystemPrompt } = await import("./src/prompts/system/index.ts");');
console.log('   logSystemPrompt();\n');
console.log('OR add to your React component temporarily:\n');
console.log('   import { logSystemPrompt } from "@/prompts/system";');
console.log('   useEffect(() => { logSystemPrompt(); }, []);\n');
console.log('='.repeat(60));
console.log('OPTION 2: Simplified Text Version (Current Output)\n');

// Simplified version (base prompt only)
const basePrompt = `You are DotBot, a specialized AI assistant for the Polkadot ecosystem. You help users interact with Polkadot through natural language commands.

Your primary role is to:
1. Understand user intent from natural language
2. Identify which agent(s) and function(s) are needed
3. Construct proper function calls with correct parameters
4. Build an Execution Array for sequential operations
5. Guide users through the execution process

Core Principles:
- Always verify user intent before executing operations
- Request missing required parameters (amounts, addresses, etc.)
- Explain what will happen before execution
- Ensure all operations are user-approved
- Handle errors gracefully with clear explanations

You have access to specialized agent classes, each with specific functions for Polkadot operations.

NOTE: This is a simplified version. The full system prompt includes:
- Polkadot knowledge base (parachains, DEXes, fees, XCM patterns, etc.)
- Agent definitions (when agents are implemented)
- Execution array instructions
- Context information

Use the browser console method above to get the complete prompt with all knowledge base data.
`;

console.log(basePrompt);
console.log('\n' + '='.repeat(60));
console.log('📄 Saving simplified version to: system-prompt-simple.txt\n');

// Write to file
const outputPath = path.join(__dirname, '../system-prompt-simple.txt');
fs.writeFileSync(outputPath, basePrompt);
console.log(`✅ Saved to: ${outputPath}\n`);
console.log('💡 For the FULL system prompt, use Option 1 (Browser Console)\n');

