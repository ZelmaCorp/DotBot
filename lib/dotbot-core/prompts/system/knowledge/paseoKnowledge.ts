/**
 * Paseo Knowledge Base
 *
 * Minimal knowledge about the Paseo testnet ecosystem (community-run testnet).
 * - Native token: PAS (10 decimals), SS58 format 42
 * - Parachains: Paseo Relay, Paseo Asset Hub (PassetHub, Para ID 1000)
 * - Tokens have no real-world value
 */

import type {
  ParachainInfo,
  PolkadotKnowledge,
  XCMPattern,
  OperationPattern,
} from './types';

export const PASEO_KNOWLEDGE_BASE: PolkadotKnowledge = {
  parachains: [
    {
      id: 0,
      name: 'Paseo Relay Chain',
      nativeToken: 'PAS',
      tokenDetails: [{ symbol: 'PAS', decimals: 10, isNative: true }],
      xcmSupported: true,
      xcmVersion: 3,
      rpcEndpoint: 'wss://paseo.rpc.amforc.com:443',
      notes:
        'Paseo Relay Chain. Community-run testnet for parachain development and testing. Supports balances, staking, and XCM.',
    },
    {
      id: 1000,
      name: 'Paseo Asset Hub (PassetHub)',
      nativeToken: 'PAS',
      tokenDetails: [
        {
          symbol: 'PAS',
          decimals: 10,
          isNative: false,
          note: 'Mirror asset from Paseo Relay Chain',
        },
      ],
      xcmSupported: true,
      xcmVersion: 3,
      rpcEndpoint: 'wss://pas-rpc.stakeworld.io/assethub',
      notes:
        'Paseo Asset Hub (PassetHub). Primary test environment for Asset Hub features on Paseo. Supports balances, assets, and polkadotXcm.',
    },
  ],

  dexes: [],

  fees: [
    {
      chain: 'Paseo Relay Chain',
      baseFee: '0.001-0.01 PAS',
      feeUnit: 'PAS',
      existentialDeposit: '0.01 PAS',
      notes: 'Approximate. Query chain state for exact ED. PAS has 10 decimals.',
    },
    {
      chain: 'Paseo Asset Hub (PassetHub)',
      baseFee: '0.001-0.01 PAS',
      feeUnit: 'PAS',
      existentialDeposit: '0.1 PAS',
      notes: 'Asset Hub ED may differ from relay. Query on-chain for exact values.',
    },
  ],

  xcmPatterns: {
    direct: {
      description: 'Direct XCM transfer between Paseo parachains',
      example: 'Paseo Asset Hub ↔ Paseo Relay',
      requirements: [
        'Both chains support XCM',
        'Asset exists on destination chain',
        'Compatible XCM versions',
      ],
    },
    viaRelay: {
      description: 'Transfer routed via Paseo Relay Chain',
      example: 'Parachain A → Paseo Relay → Parachain B',
      requirements: ['XCM enabled on all involved chains', 'Reserve location compatible'],
    },
  },

  patterns: {
    simpleTransfer: {
      description: 'Transfer PAS between accounts on the same Paseo chain',
      steps: [
        'Validate SS58 address (format 42)',
        'Check balance (ensure > amount + fees + ED)',
        'Create transfer extrinsic (use transferKeepAlive to prevent account reaping)',
        'Sign and submit',
      ],
    },
    crossChainTransfer: {
      description: 'Transfer assets across Paseo parachains using XCM',
      steps: [
        'Verify asset exists on source and destination chain',
        'Check XCM route availability',
        'Verify sufficient balance for fees and existential deposit',
        'Create XCM extrinsic (use limited versions to prevent fund loss)',
        'Sign and submit',
      ],
    },
  },

  ecosystemChanges: {
    testnetNature: {
      date: 'Ongoing',
      description: 'Paseo is a community-run testnet for Polkadot parachain development.',
      impact: [
        'Breaking changes may occur',
        'Balances and assets may be reset',
        'No real-world value for PAS or other test assets',
      ],
    },
  },

  assetClassification: {
    sufficient: {
      description: 'Some test assets may be marked sufficient; verify on-chain.',
      examples: [],
    },
    nonSufficient: {
      description: 'Most assets require native PAS balance to keep the account alive.',
      minimumBalance: 'Chain-dependent; query on-chain',
      examples: ['PAS'],
    },
  },

  safetyGuidelines: {
    balanceChecking: {
      warning: 'Paseo balances are for testing only and may be reset.',
      bestPractice: [
        'Always query live chain state',
        'Never assume balances persist across sessions',
      ],
      locations: {
        relayChain: {
          endpoint: 'wss://paseo.rpc.amforc.com:443',
          checked: true,
          note: 'Paseo relay endpoint',
        },
        assetHub: {
          endpoint: 'wss://pas-rpc.stakeworld.io/assethub',
          checked: true,
          note: 'Paseo Asset Hub (PassetHub)',
        },
      },
    },
    assetVerification: {
      warning: 'All Paseo assets are test-only. No real-world value.',
      bestPractice: 'Verify assetId and chain context. PAS has 10 decimals.',
      verifiedAssets: {},
    },
  },
};

export const PASEO_XCM_PATTERNS: Record<string, XCMPattern> = PASEO_KNOWLEDGE_BASE.xcmPatterns;
export const PASEO_COMMON_PATTERNS: Record<string, OperationPattern> = PASEO_KNOWLEDGE_BASE.patterns;
export const PASEO_ECOSYSTEM_CHANGES = PASEO_KNOWLEDGE_BASE.ecosystemChanges;
export const PASEO_SAFETY_GUIDELINES = PASEO_KNOWLEDGE_BASE.safetyGuidelines;

export async function fetchLivePaseoParachainData(): Promise<ParachainInfo[]> {
  try {
    return PASEO_KNOWLEDGE_BASE.parachains;
  } catch (error) {
    console.warn('Failed to fetch live Paseo parachain data, using static data', error);
    return PASEO_KNOWLEDGE_BASE.parachains;
  }
}

export async function buildPaseoKnowledgeBase(useLiveData = false): Promise<PolkadotKnowledge> {
  if (useLiveData) {
    const liveParachains = await fetchLivePaseoParachainData();
    return { ...PASEO_KNOWLEDGE_BASE, parachains: liveParachains };
  }
  return PASEO_KNOWLEDGE_BASE;
}

/**
 * Format Paseo Knowledge Base for system prompt
 */
export function formatPaseoKnowledgeBase(): string {
  const kb = PASEO_KNOWLEDGE_BASE;
  let output = '\n## Paseo Testnet Knowledge Base\n\n';
  output += '⚠️ **IMPORTANT**: Paseo is a TESTNET. All tokens (PAS) have NO real-world value. Native token PAS has 10 decimals, SS58 format 42.\n\n';

  output += '### ⚠️ Important Testnet Information\n\n';
  Object.entries(kb.ecosystemChanges).forEach(([key, change]) => {
    output += `**${key}** (${change.date})\n`;
    output += `${change.description}\n\n`;
    output += 'Impact:\n';
    change.impact.forEach((impact) => {
      output += `- ${impact}\n`;
    });
    output += '\n';
  });

  output += '### ⚠️ Safety Guidelines\n\n';
  output += `**Balance Checking**: ${kb.safetyGuidelines.balanceChecking.warning}\n\n`;
  output += '**Best Practices**:\n';
  kb.safetyGuidelines.balanceChecking.bestPractice.forEach((practice) => {
    output += `- ${practice}\n`;
  });
  output += '\n**RPC Endpoints**:\n';
  Object.entries(kb.safetyGuidelines.balanceChecking.locations).forEach(([location, info]) => {
    output += `- ${location}: ${info.endpoint}\n`;
    output += `  - Note: ${info.note}\n`;
  });
  output += '\n';

  output += '### Parachain Topology\n\n';
  output += 'Available parachains on Paseo testnet:\n\n';
  kb.parachains.forEach((chain) => {
    output += `**${chain.name}** (ID: ${chain.id})\n`;
    output += `- Native Token: ${chain.nativeToken}\n`;
    output += `- XCM Supported: ${chain.xcmSupported ? 'Yes' : 'No'}\n`;
    if (chain.rpcEndpoint) output += `- RPC Endpoint: ${chain.rpcEndpoint}\n`;
    output += `- Tokens: ${chain.tokenDetails.map((t) => `${t.symbol} (${t.decimals} decimals)`).join(', ')}\n`;
    if (chain.notes) output += `- Note: ${chain.notes}\n`;
    output += '\n';
  });

  output += '### Fee Structures\n\n';
  kb.fees.forEach((fee) => {
    output += `**${fee.chain}**: Base Fee ${fee.baseFee}, ED ${fee.existentialDeposit}\n`;
    if (fee.notes) output += `  ${fee.notes}\n`;
  });
  output += '\n';

  output += '### XCM Transfer Patterns\n\n';
  Object.entries(kb.xcmPatterns).forEach(([key, pattern]) => {
    output += `**${key}**: ${pattern.description}\n`;
    output += `- Example: ${pattern.example}\n`;
    output += `- Requirements: ${pattern.requirements.join(', ')}\n`;
  });
  output += '\n';

  output += '### Common Operation Patterns\n\n';
  Object.entries(kb.patterns).forEach(([key, pattern]) => {
    output += `**${key}**: ${pattern.description}\n`;
    pattern.steps.forEach((step, i) => {
      output += `${i + 1}. ${step}\n`;
    });
    output += '\n';
  });

  return output;
}
