/**
 * System Prompt Version Control
 * 
 * Tracks version of the system prompt system for compatibility
 * and validation purposes.
 */

export const SYSTEM_PROMPT_VERSION = '1.0.0';

export interface VersionedPrompt {
  /** Version of the system prompt format */
  version: string;
  
  /** Timestamp when prompt was generated */
  generatedAt: number;
  
  /** Context used to generate the prompt */
  context?: {
    walletConnected: boolean;
    network?: string;
    hasBalance?: boolean;
  };
  
  /** The actual prompt text */
  prompt: string;
}

/**
 * Validate that a prompt version is compatible
 */
export function isCompatibleVersion(version: string): boolean {
  // For now, all 1.x.x versions are compatible
  const majorVersion = version.split('.')[0];
  const currentMajor = SYSTEM_PROMPT_VERSION.split('.')[0];
  return majorVersion === currentMajor;
}

/**
 * Create a versioned prompt object
 */
export function createVersionedPrompt(
  prompt: string,
  context?: VersionedPrompt['context']
): VersionedPrompt {
  return {
    version: SYSTEM_PROMPT_VERSION,
    generatedAt: Date.now(),
    context,
    prompt,
  };
}

