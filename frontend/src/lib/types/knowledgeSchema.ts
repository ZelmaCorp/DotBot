/**
 * Knowledge Schema Generation
 * 
 * Generates schema descriptions of available knowledge for inclusion in system prompts.
 * This allows the AI to know what knowledge is available and how to request it.
 */

import type { PolkadotKnowledge } from '../prompts/system/knowledge/types';
import { STATIC_KNOWLEDGE_BASE } from '../prompts/system/knowledge/dotKnowledge';
import { WESTEND_KNOWLEDGE_BASE } from '../prompts/system/knowledge/westendKnowledge';

/**
 * Knowledge domain schema
 */
export interface KnowledgeDomainSchema {
  name: string;
  description: string;
  fields: KnowledgeFieldSchema[];
}

/**
 * Knowledge field schema
 */
export interface KnowledgeFieldSchema {
  name: string;
  type: string;
  description: string;
  isArray?: boolean;
  fields?: KnowledgeFieldSchema[];  // For nested objects
}

/**
 * Generate schema for PolkadotKnowledge structure
 */
export function generatePolkadotKnowledgeSchema(): KnowledgeDomainSchema {
  return {
    name: 'dotKnowledge',
    description: 'Polkadot ecosystem knowledge (parachains, DEXes, tokens, XCM patterns)',
    fields: [
      {
        name: 'parachains',
        type: 'ParachainInfo[]',
        description: 'List of all Polkadot parachains with token details, XCM support, and RPC endpoints',
        isArray: true,
      },
      {
        name: 'dexes',
        type: 'DEXInfo[]',
        description: 'Decentralized exchanges available in the ecosystem (HydraDX, Acala, etc.)',
        isArray: true,
      },
      {
        name: 'fees',
        type: 'FeeStructure[]',
        description: 'Fee structures for different chains and operations',
        isArray: true,
      },
      {
        name: 'xcmPatterns',
        type: 'XCMPattern[]',
        description: 'Common XCM transfer patterns and examples',
        isArray: true,
      },
      {
        name: 'operationPatterns',
        type: 'OperationPattern[]',
        description: 'Common operation patterns (transfers, swaps, staking)',
        isArray: true,
      },
      {
        name: 'ecosystemChanges',
        type: 'EcosystemChange[]',
        description: 'Recent ecosystem changes (e.g., Asset Hub migration)',
        isArray: true,
      },
      {
        name: 'safetyGuidelines',
        type: 'SafetyGuidelines',
        description: 'Safety guidelines for transactions and operations',
      },
    ],
  };
}

/**
 * Generate schema for Westend knowledge
 */
export function generateWestendKnowledgeSchema(): KnowledgeDomainSchema {
  return {
    name: 'westendKnowledge',
    description: 'Westend testnet ecosystem knowledge (test parachains, testnet-specific info)',
    fields: [
      {
        name: 'parachains',
        type: 'ParachainInfo[]',
        description: 'List of Westend test parachains',
        isArray: true,
      },
      {
        name: 'dexes',
        type: 'DEXInfo[]',
        description: 'Test DEXes on Westend',
        isArray: true,
      },
      {
        name: 'fees',
        type: 'FeeStructure[]',
        description: 'Fee structures on testnet (may differ from mainnet)',
        isArray: true,
      },
      // ... similar structure to Polkadot
    ],
  };
}

/**
 * Format knowledge schema for system prompt
 * 
 * Generates a human-readable description of available knowledge that can be
 * included in the system prompt.
 */
export function formatKnowledgeSchemaForPrompt(): string {
  const schemas = [
    generatePolkadotKnowledgeSchema(),
    generateWestendKnowledgeSchema(),
  ];

  let output = '## Available Knowledge Domains\n\n';
  output += 'You can request specific knowledge using the following format:\n';
  output += '`GET <domain>.<field>[optional_filter]`\n\n';
  output += 'Examples:\n';
  output += '- `GET dotKnowledge.dexes` - Get all DEXes\n';
  output += '- `GET dotKnowledge.parachains` - Get all parachains\n';
  output += '- `GET dotKnowledge.parachains[name=Moonbeam]` - Get specific parachain\n\n';

  for (const schema of schemas) {
    output += `### ${schema.name}\n`;
    output += `${schema.description}\n\n`;
    output += 'Available fields:\n';
    
    for (const field of schema.fields) {
      const arrayIndicator = field.isArray ? '[]' : '';
      output += `- **${field.name}** (${field.type}${arrayIndicator}): ${field.description}\n`;
    }
    
    output += '\n';
  }

  output += '---\n\n';
  output += '**Note**: Knowledge requests are currently under development. ';
  output += 'For now, all knowledge is provided upfront in the system prompt.\n\n';

  return output;
}

/**
 * Generate statistics about knowledge size
 */
export function getKnowledgeStats() {
  return {
    polkadot: {
      parachains: STATIC_KNOWLEDGE_BASE.parachains.length,
      dexes: STATIC_KNOWLEDGE_BASE.dexes?.length || 0,
      xcmPatterns: STATIC_KNOWLEDGE_BASE.xcmPatterns?.length || 0,
    },
    westend: {
      parachains: WESTEND_KNOWLEDGE_BASE.parachains.length,
      dexes: WESTEND_KNOWLEDGE_BASE.dexes?.length || 0,
      xcmPatterns: WESTEND_KNOWLEDGE_BASE.xcmPatterns?.length || 0,
    },
  };
}

/**
 * Query knowledge by path
 * 
 * Helper function to retrieve knowledge by dot-notation path.
 * This will be used by the knowledge request handler.
 */
export function queryKnowledge(
  domain: string,
  path: string[],
  filter?: Record<string, any>
): any {
  // Select knowledge base
  let knowledge: PolkadotKnowledge;
  
  switch (domain) {
    case 'dotKnowledge':
      knowledge = STATIC_KNOWLEDGE_BASE;
      break;
    case 'westendKnowledge':
      knowledge = WESTEND_KNOWLEDGE_BASE;
      break;
    // case 'kusamaKnowledge':
    //   knowledge = KUSAMA_KNOWLEDGE_BASE;  // TODO: When implemented
    //   break;
    default:
      throw new Error(`Unknown knowledge domain: ${domain}`);
  }

  // Navigate path
  let result: any = knowledge;
  for (const segment of path) {
    if (result && typeof result === 'object' && segment in result) {
      result = result[segment as keyof typeof result];
    } else {
      throw new Error(`Invalid path: ${path.join('.')}`);
    }
  }

  // Apply filter if provided
  if (filter && Array.isArray(result)) {
    result = result.filter((item: any) => {
      for (const [key, value] of Object.entries(filter)) {
        if (item[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  return result;
}

