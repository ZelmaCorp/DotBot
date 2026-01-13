/**
 * Agent Definition Template
 * 
 * Use this template when adding new agents to the system.
 * Copy this structure and fill in the details for your new agent.
 */

import { AgentDefinition } from './types';

/**
 * Template for creating new agent definitions
 * 
 * INSTRUCTIONS:
 * 1. Copy this entire template
 * 2. Replace "TemplateAgent" with your agent's class name
 * 3. Fill in all the details
 * 4. Add it to the agent registry (agents/index.ts)
 */
export const TEMPLATE_AGENT: AgentDefinition = {
  className: 'TemplateAgent',
  displayName: 'Template Agent',
  purpose: 'Brief one-line purpose of this agent',
  description: `Detailed description of what this agent does,
    what operations it supports, and when it should be used.
    Be comprehensive but concise.`,
  
  functions: [
    {
      name: 'functionName',
      description: 'What this function does in one sentence',
      detailedDescription: `Detailed explanation of the function's behavior,
        what it does, how it works, and any important considerations.`,
      parameters: [
        {
          name: 'paramName',
          type: 'string | number | Address | etc.',
          required: true,
          description: 'What this parameter represents',
          examples: ['example1', 'example2'],
          constraints: 'Any validation rules or constraints',
        },
        // Add more parameters as needed
      ],
      returns: {
        type: 'extrinsic', // or 'data', 'confirmation', 'mixed'
        description: 'What this function returns',
      },
      examples: [
        'Example usage scenario 1',
        'Example usage scenario 2',
      ],
      requiresConfirmation: true,
      relatedFunctions: ['otherFunction1', 'otherFunction2'],
    },
    // Add more functions as needed
  ],
  
  useCases: [
    'When to use this agent - scenario 1',
    'When to use this agent - scenario 2',
    'When to use this agent - scenario 3',
  ],
  
  prerequisites: [
    'What needs to be set up before using this agent',
    'Required wallet connection, network, etc.',
  ],
  
  networks: ['polkadot', 'kusama'], // or ['all']
  
  limitations: [
    'What this agent explicitly cannot do',
    'Limitations or constraints',
    'Operations that are not supported',
  ],
  
  dependencies: [
    // Other agent classNames this agent depends on
    // 'OtherAgentClassName',
  ],
  
  compatibleAgents: [
    // Agent classNames that work well together with this one
    // 'CompatibleAgentClassName',
  ],
  
  categories: [
    // Tags/categories for organizing agents
    // 'transfers', 'governance', 'staking', etc.
  ],
};

