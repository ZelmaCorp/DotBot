#!/usr/bin/env ts-node

/**
 * Generate System Prompt Script (TypeScript version)
 * 
 * Requires: npm install -D ts-node typescript
 * Run: npx ts-node scripts/generate-system-prompt.ts
 * Or: npm run generate-prompt:ts
 */

// This would work if ts-node is installed
// For now, we'll provide a simpler browser-based solution

console.log(`
📝 System Prompt Generator

To generate the full system prompt, you have two options:

1. Browser Console (Recommended):
   - Start your dev server: npm start
   - Open browser console
   - Run: 
     import { logSystemPrompt } from './src/prompts/system';
     logSystemPrompt();

2. Add to your code temporarily:
   - Import in any component: import { logSystemPrompt } from '@/prompts/system';
   - Call logSystemPrompt() in useEffect or on button click
   - Check browser console

The system prompt includes:
- Base system prompt
- Polkadot knowledge base (parachains, DEXes, fees, XCM patterns)
- Agent definitions (when agents are added)
- Execution array instructions
- Context information (if provided)

For a quick preview, see: frontend/src/prompts/system/base.ts
`);

