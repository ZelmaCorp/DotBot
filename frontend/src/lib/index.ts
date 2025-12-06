/**
 * DotBot Library
 * 
 * Core library for Polkadot operations through natural language.
 * This library provides agents, system prompts, and execution capabilities.
 */

// Export agents (runtime agent classes and registry)
export * from './agents';
export type { AgentClass, AgentRegistryEntry } from './agents';
export { 
  AGENT_REGISTRY, 
  getAgentByClassName, 
  getAllAgentClassNames, 
  createAgent 
} from './agents';

// Export prompts system (but exclude conflicting agent functions)
export { 
  buildSystemPrompt, 
  buildSystemPromptSync, 
  getDefaultSystemPrompt, 
  buildVersionedSystemPrompt 
} from './prompts/system/loader';
export { 
  logSystemPrompt, 
  logSystemPromptAsync, 
  getSystemPromptString, 
  logSystemPromptWithMockContext 
} from './prompts/system/utils';
export { BASE_SYSTEM_PROMPT } from './prompts/system/base';
export { EXECUTION_ARRAY_INSTRUCTIONS } from './prompts/system/execution/instructions';
export {
  formatPolkadotKnowledgeBase,
  buildKnowledgeBase,
  fetchLiveParachainData,
  STATIC_KNOWLEDGE_BASE,
  XCM_TRANSFER_PATTERNS,
  COMMON_PATTERNS,
  ECOSYSTEM_CHANGES,
  SAFETY_GUIDELINES,
} from './prompts/system/knowledge/dot-knowledge';
export type {
  ParachainInfo,
  TokenInfo,
  DEXInfo,
  FeeStructure,
  AssetClassification,
  EcosystemChange,
  SafetyGuidelines,
  PolkadotKnowledge,
  XCMPattern,
  OperationPattern,
} from './prompts/system/knowledge/types';
export {
  SYSTEM_PROMPT_VERSION,
  isCompatibleVersion,
  createVersionedPrompt,
} from './prompts/system/version';
export type { VersionedPrompt } from './prompts/system/version';
// Export prompt agent registry functions with different names to avoid conflicts
export {
  AGENTS,
  buildAgentRegistry,
  getAgentByClassName as getPromptAgentByClassName,
  getAgentByDisplayName,
  getAllAgentClassNames as getAllPromptAgentClassNames,
  getAllFunctionNames,
} from './prompts/system/agents';
export type {
  AgentDefinition,
  AgentFunction,
  FunctionParameter,
  AgentRegistry,
} from './prompts/system/agents/types';
export type {
  ExecutionArray,
  ExecutionStep,
  ExecutionStatus,
  ExecutionType,
  ExecutionContext,
} from './prompts/system/execution/types';
export type {
  SystemContext,
  WalletContext,
  NetworkContext,
  BalanceContext,
} from './prompts/system/context/types';

// Export types and enums (must export enums as values, not just types)
export { Subsystem, ErrorType } from './types/logging';
export type { Subsystem as SubsystemType, ErrorType as ErrorTypeType } from './types/logging';

// Export config
export { createSubsystemLogger, logError, logger } from './config/logger';

