/**
 * Execution System
 * 
 * Lower-level execution system for advanced use cases.
 * For most users, use DotBot instead - it's the turnkey solution that handles
 * everything including LLM integration, system prompts, and execution.
 * 
 * Use ExecutionSystem when you:
 * - Already have an ExecutionPlan from an LLM
 * - Want to execute plans without LLM integration
 * - Need fine-grained control over the execution flow
 */

import { ApiPromise } from '@polkadot/api';
import { ExecutionPlan } from '../prompts/system/execution/types';
import { ExecutionOrchestrator, OrchestrationResult } from './orchestrator';
import { Executioner } from './executioner';
import { ExecutionOptions, SigningRequest, BatchSigningRequest, ExecutionItem } from './types';
import { ExecutionArray } from './executionArray';
import { WalletAccount } from '../types/wallet';
import { Signer } from './signers/types';
import type { RpcManager, ExecutionSession } from '../rpcManager';
import { SimulationStatusCallback } from '../agents/types';
import { isSimulationEnabled } from './simulation/simulationConfig';
import { createSimulationContext, findMatchingApi } from './simulation/simulationHelpers';

/**
 * Execution System
 * 
 * Lower-level execution system for advanced use cases.
 * Handles execution of ExecutionPlans (from LLM) to blockchain operations.
 * 
 * For turnkey usage, see DotBot class instead.
 * 
 * @example
 * ```typescript
 * const system = new ExecutionSystem();
 * system.initialize(api, account);
 * 
 * // Set up signing handler
 * system.setSigningHandler((request) => {
 *   showSigningModal(request);
 * });
 * 
 * // Execute LLM plan - that's it!
 * await system.execute(llmPlan);
 * ```
 */
export class ExecutionSystem {
  private orchestrator: ExecutionOrchestrator;
  private executioner: Executioner;
  
  // Execution sessions - locked API instances for transaction lifecycle
  private relayChainSession: ExecutionSession | null = null;
  private assetHubSession: ExecutionSession | null = null;
  
  // Store initialization state for re-initialization with sessions
  private initializedAccount: WalletAccount | null = null;
  private initializedSigner: Signer | null = null;
  private initializedOnSimulationStatus: SimulationStatusCallback | undefined = undefined;
  
  constructor() {
    this.orchestrator = new ExecutionOrchestrator();
    this.executioner = new Executioner();
  }
  
  /**
   * Initialize the system
   * 
   * @param api Polkadot Relay Chain API instance
   * @param account Account information
   * @param signer Optional: Pluggable signer (for portability)
   * @param assetHubApi Optional: Asset Hub API instance (recommended for DOT transfers)
   * @param relayChainManager Optional: RPC manager for Relay Chain endpoints
   * @param assetHubManager Optional: RPC manager for Asset Hub endpoints
   * @param onSimulationStatus Optional: Callback for simulation status updates
   */
  initialize(
    api: ApiPromise, 
    account: WalletAccount, 
    signer?: Signer, 
    assetHubApi?: ApiPromise | null,
    relayChainManager?: RpcManager | null,
    assetHubManager?: RpcManager | null,
    onSimulationStatus?: SimulationStatusCallback | null
  ): void {
    // Store for later re-initialization with sessions
    this.initializedAccount = account;
    this.initializedSigner = signer || null;
    this.initializedOnSimulationStatus = onSimulationStatus || undefined;
    
    this.orchestrator.initialize(api, assetHubApi, onSimulationStatus, relayChainManager, assetHubManager);
    this.executioner.initialize(api, account, signer, assetHubApi, relayChainManager, assetHubManager, onSimulationStatus || undefined);
  }
  
  /**
   * Set signing handler (REQUIRED)
   */
  setSigningHandler(handler: (request: SigningRequest) => void): void {
    this.executioner.setSigningRequestHandler(handler);
  }
  
  /**
   * Set batch signing handler (optional)
   */
  setBatchSigningHandler(handler: (request: BatchSigningRequest) => void): void {
    this.executioner.setBatchSigningRequestHandler(handler);
  }
  
  /**
   * Get orchestrator instance (for advanced usage)
   */
  getOrchestrator(): ExecutionOrchestrator {
    return this.orchestrator;
  }
  
  /**
   * Get executioner instance (for advanced usage)
   */
  getExecutioner(): Executioner {
    return this.executioner;
  }
  
  /**
   * Prepare execution array: orchestrate plan and run simulation if enabled
   * 
   * This is the two-phase execution pattern:
   * 1. Prepare: Orchestrate + simulate (if enabled)
   * 2. Execute: User approves → sign → broadcast (via startExecution)
   * 
   * @param plan ExecutionPlan from LLM
   * @param relayChainManager RPC manager for Relay Chain
   * @param assetHubManager RPC manager for Asset Hub
   * @param accountAddress Account address for simulation
   * @param onSimulationStatus Optional callback for simulation status
   * @param executionId Optional execution ID to preserve when rebuilding (prevents duplicate ExecutionMessages)
   * @returns ExecutionArray ready for execution
   */
  async prepareExecutionArray(
    plan: ExecutionPlan,
    relayChainManager: RpcManager,
    assetHubManager: RpcManager,
    accountAddress: string,
    onSimulationStatus?: SimulationStatusCallback,
    executionId?: string
  ): Promise<ExecutionArray> {
    this.cleanupExecutionSessions();
    
    try {
      await this.createExecutionSessions(relayChainManager, assetHubManager);
      this.initializeWithSessions();
      
      const result = await this.orchestrator.orchestrate(plan, {}, executionId);
      if (!result.success && result.errors.length > 0) {
        const errorMessages = result.errors.map(e => `• ${e.error}`).join('\n');
        throw new Error(`Failed to prepare transaction:\n\n${errorMessages}`);
      }
      
      if (isSimulationEnabled()) {
        await this.runSimulationForExecutionArray(
          result.executionArray,
          accountAddress,
          relayChainManager,
          assetHubManager,
          onSimulationStatus
        );
      }
      
      return result.executionArray;
    } catch (error) {
      this.cleanupExecutionSessions();
      throw error;
    }
  }
  
  /**
   * Create execution sessions for Relay Chain and Asset Hub
   */
  private async createExecutionSessions(
    relayChainManager: RpcManager,
    assetHubManager: RpcManager
  ): Promise<void> {
    this.relayChainSession = await relayChainManager.createExecutionSession();
    console.info(`Created Relay Chain execution session: ${this.relayChainSession.endpoint}`);
    
    try {
      this.assetHubSession = await assetHubManager.createExecutionSession();
      console.info(`Created Asset Hub execution session: ${this.assetHubSession.endpoint}`);
    } catch (error) {
      console.warn('Asset Hub execution session creation failed, continuing without it:', error);
      this.assetHubSession = null;
    }
  }
  
  /**
   * Initialize orchestrator and executioner with session APIs
   */
  private initializeWithSessions(): void {
    if (!this.relayChainSession || !this.initializedAccount) {
      throw new Error('Execution sessions not created or system not initialized');
    }
    
    // Re-initialize orchestrator with session APIs
    this.orchestrator.initialize(
      this.relayChainSession.api,
      this.assetHubSession?.api || null,
      this.initializedOnSimulationStatus || undefined,
      null, // RPC managers not needed (using session APIs)
      null
    );
    
    // Re-initialize executioner with session APIs
    this.executioner.initialize(
      this.relayChainSession.api,
      this.initializedAccount,
      this.initializedSigner || undefined,
      this.assetHubSession?.api || null,
      null, // RPC managers not needed (using session APIs)
      null,
      this.initializedOnSimulationStatus
    );
  }
  
  /**
   * Validate execution sessions are still active
   */
  async validateExecutionSessions(): Promise<boolean> {
    if (!this.relayChainSession) {
      return false;
    }
    return await this.relayChainSession.isConnected();
  }
  
  /**
   * Clean up execution sessions
   */
  cleanupExecutionSessions(): void {
    if (this.relayChainSession) {
      this.relayChainSession.markInactive();
      this.relayChainSession = null;
    }
    if (this.assetHubSession) {
      this.assetHubSession.markInactive();
      this.assetHubSession = null;
    }
  }
  
  /**
   * Get execution sessions (for DotBot to store)
   */
  getExecutionSessions(): { relayChain: ExecutionSession | null; assetHub: ExecutionSession | null } {
    return {
      relayChain: this.relayChainSession,
      assetHub: this.assetHubSession,
    };
  }
  
  /**
   * Run simulation for all items in execution array
   */
  private async runSimulationForExecutionArray(
    executionArray: ExecutionArray,
    accountAddress: string,
    relayChainManager: RpcManager,
    assetHubManager: RpcManager,
    onSimulationStatus?: SimulationStatusCallback
  ): Promise<void> {
    const orchestratorApi = this.orchestrator.getApi();
    const orchestratorAssetHubApi = this.orchestrator.getAssetHubApi();
    
    if (!orchestratorApi) {
      console.error('Cannot run simulation: orchestrator API not initialized');
      return;
    }
    
    const items = executionArray.getState().items
      .filter((item: ExecutionItem) => item.executionType === 'extrinsic' && item.agentResult.extrinsic);
    
    const simulationPromises = items.map(item =>
      this.simulateItem(item, orchestratorApi, orchestratorAssetHubApi, executionArray, accountAddress, relayChainManager, assetHubManager, onSimulationStatus)
    );
    
    await Promise.all(simulationPromises);
  }
  
  /**
   * Simulate a single execution item
   */
  private async simulateItem(
    item: ExecutionItem,
    relayApi: ApiPromise,
    assetHubApi: ApiPromise | null,
    executionArray: ExecutionArray,
    accountAddress: string,
    relayChainManager: RpcManager,
    assetHubManager: RpcManager,
    onSimulationStatus?: SimulationStatusCallback
  ): Promise<void> {
    const extrinsic = item.agentResult.extrinsic!;
    const apiForExtrinsic = findMatchingApi(extrinsic, relayApi, assetHubApi);
    
    if (!apiForExtrinsic) {
      console.error(`Cannot determine API for item ${item.id}, skipping simulation`);
      return;
    }
    
    this.logRegistryMismatchIfNeeded(item, extrinsic, apiForExtrinsic);
    
    const { runSimulation } = await import('./simulation/executionSimulator');
    const simulationContext = createSimulationContext(
      apiForExtrinsic,
      accountAddress,
      assetHubManager,
      relayChainManager,
      onSimulationStatus
    );
    
    try {
      await runSimulation(extrinsic, simulationContext, executionArray, item);
    } catch (error) {
      this.handleSimulationError(error, item, extrinsic, apiForExtrinsic);
    }
  }
  
  /**
   * Log registry mismatch warning if needed
   */
  private logRegistryMismatchIfNeeded(
    item: ExecutionItem,
    extrinsic: any,
    apiForExtrinsic: ApiPromise
  ): void {
    if (apiForExtrinsic.registry !== extrinsic.registry) {
      const isAssetHubMethod = extrinsic.method.section === 'assets' || 
                               extrinsic.method.section === 'foreignAssets';
      console.warn(
        `Registry mismatch for item ${item.id}: extrinsic registry does not match orchestrator API registries. ` +
        `Using ${isAssetHubMethod ? 'Asset Hub' : 'Relay Chain'} API based on method section. ` +
        `This may cause metadata mismatch errors.`
      );
    }
  }
  
  /**
   * Handle simulation errors with detailed logging
   */
  private handleSimulationError(
    error: unknown,
    item: ExecutionItem,
    extrinsic: any,
    apiForExtrinsic: ApiPromise
  ): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Simulation failed for item ${item.id}:`, errorMsg);
    
    if (errorMsg.includes('Unable to find Call') || errorMsg.includes('findMetaCall')) {
      console.error(
        `Metadata mismatch detected. Extrinsic registry: ${extrinsic.registry.constructor.name}, ` +
        `API registry: ${apiForExtrinsic.registry.constructor.name}, ` +
        `Call index: [${extrinsic.method.callIndex[0]}, ${extrinsic.method.callIndex[1]}]`
      );
    }
  }
  
  /**
   * Execute LLM plan - complete flow from plan to blockchain
   * 
   * This is the main entry point. Pass LLM output and everything is handled:
   * 1. Orchestrator converts ExecutionStep[] to agent calls
   * 2. Agents create extrinsics
   * 3. ExecutionArray manages the queue
   * 4. Executioner handles signing and broadcasting
   * 
   * @param plan ExecutionPlan from LLM
   * @param options Execution options
   * @param callbacks Progress callbacks for LLM feedback
   */
  async execute(
    plan: ExecutionPlan,
    options: ExecutionOptions = {},
    callbacks?: {
      /** Called while preparing operations */
      onPreparingStep?: (description: string, current: number, total: number) => void;
      /** Called during execution */
      onExecutingStep?: (description: string, status: string) => void;
      /** Called on error */
      onError?: (error: string) => void;
      /** Called on completion */
      onComplete?: (success: boolean, completed: number, failed: number) => void;
    }
  ): Promise<void> {
    const orchestrationResult = await this.orchestrateWithCallbacks(plan, callbacks);
    const executionArray = this.processOrchestrationResult(orchestrationResult, callbacks);
    
    if (!executionArray) {
      return;
    }
    
    await this.executeWithCallbacks(executionArray, options, callbacks);
  }
  
  /**
   * Orchestrate plan with callback handling
   */
  private async orchestrateWithCallbacks(
    plan: ExecutionPlan,
    callbacks?: {
      onPreparingStep?: (description: string, current: number, total: number) => void;
      onError?: (error: string) => void;
    }
  ) {
    return await this.orchestrator.orchestrate(plan, {
      onProgress: (step, index, total) => {
        if (callbacks?.onPreparingStep) {
          callbacks.onPreparingStep(step.description, index + 1, total);
        }
      },
      onError: (step, error) => {
        if (callbacks?.onError) {
          callbacks.onError(`Failed to prepare ${step.description}: ${error.message}`);
        }
      }
    });
  }
  
  /**
   * Process orchestration result and handle errors
   */
  private processOrchestrationResult(
    orchestrationResult: OrchestrationResult,
    callbacks?: {
      onError?: (error: string) => void;
    }
  ): ExecutionArray | null {
    if (!orchestrationResult.success && callbacks?.onError) {
      callbacks.onError(
        `Orchestration completed with ${orchestrationResult.errors.length} error(s)`
      );
    }
    
    const { executionArray } = orchestrationResult;
    
    if (executionArray.isEmpty()) {
      if (callbacks?.onError) {
        callbacks.onError('No operations to execute');
      }
      return null;
    }
    
    return executionArray;
  }
  
  /**
   * Execute with callback handling
   */
  private async executeWithCallbacks(
    executionArray: ExecutionArray,
    options: ExecutionOptions,
    callbacks?: {
      onExecutingStep?: (description: string, status: string) => void;
      onComplete?: (success: boolean, completed: number, failed: number) => void;
    }
  ): Promise<void> {
    const unsubscribe = executionArray.onStatusUpdate((item) => {
      if (callbacks?.onExecutingStep) {
        callbacks.onExecutingStep(item.description, item.status);
      }
    });
    
    try {
      await this.executioner.execute(executionArray, options);
      
      const state = executionArray.getState();
      if (callbacks?.onComplete) {
        callbacks.onComplete(
          state.failedItems === 0,
          state.completedItems,
          state.failedItems
        );
      }
    } finally {
      unsubscribe();
    }
  }
}

