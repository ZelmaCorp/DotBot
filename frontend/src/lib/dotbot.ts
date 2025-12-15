/**
 * DotBot - Out of the Box Interface
 * 
 * This is the turnkey solution. One class, simple API, everything included.
 * Frontend just needs to create this and call chat().
 * 
 * @example
 * ```typescript
 * const dotbot = await DotBot.create({
 *   wallet: selectedAccount,
 *   endpoint: 'wss://rpc.polkadot.io',
 *   onSigningRequest: (request) => showModal(request)
 * });
 * 
 * const result = await dotbot.chat("Send 2 DOT to Bob");
 * ```
 */

import { ApiPromise, WsProvider } from '@polkadot/api';
import { ExecutionSystem } from './execution-array/system';
import { BrowserWalletSigner } from './execution-array/signers/browser-signer';
import { buildSystemPrompt } from './prompts/system/loader';
import { ExecutionPlan } from './prompts/system/execution/types';
import { SigningRequest, BatchSigningRequest, ExecutionOptions } from './execution-array/types';
import { WalletAccount } from '../types/wallet';

export interface DotBotConfig {
  /** Wallet account */
  wallet: WalletAccount;
  
  /** Polkadot endpoint (default: wss://rpc.polkadot.io) */
  endpoint?: string;
  
  /** LLM API endpoint (for custom LLM) */
  llmEndpoint?: string;
  
  /** LLM API key */
  llmApiKey?: string;
  
  /** Signing request handler (REQUIRED for transactions) */
  onSigningRequest?: (request: SigningRequest) => void;
  
  /** Batch signing request handler */
  onBatchSigningRequest?: (request: BatchSigningRequest) => void;
  
  /** Auto-approve transactions (NOT recommended for production!) */
  autoApprove?: boolean;
}

export interface ChatResult {
  /** LLM response text */
  response: string;
  
  /** Execution plan (if any) */
  plan?: ExecutionPlan;
  
  /** Whether operations were executed */
  executed: boolean;
  
  /** Execution success status */
  success: boolean;
  
  /** Number of operations completed */
  completed: number;
  
  /** Number of operations failed */
  failed: number;
}

export interface ChatOptions {
  /** Custom system prompt override */
  systemPrompt?: string;
  
  /** Execution options */
  executionOptions?: ExecutionOptions;
  
  /** Custom LLM function (bypass default) */
  llm?: (message: string, systemPrompt: string) => Promise<string>;
}

/**
 * DotBot - Out of the Box Interface
 * 
 * Everything you need in one simple class.
 */
export class DotBot {
  private api: ApiPromise;
  private executionSystem: ExecutionSystem;
  private wallet: WalletAccount;
  private config: DotBotConfig;
  
  private constructor(api: ApiPromise, executionSystem: ExecutionSystem, config: DotBotConfig) {
    this.api = api;
    this.executionSystem = executionSystem;
    this.wallet = config.wallet;
    this.config = config;
  }
  
  /**
   * Create and initialize DotBot
   * 
   * This is the only setup you need!
   */
  static async create(config: DotBotConfig): Promise<DotBot> {
    // Connect to Polkadot
    const endpoint = config.endpoint || 'wss://rpc.polkadot.io';
    const provider = new WsProvider(endpoint);
    const api = await ApiPromise.create({ provider });
    await api.isReady;
    
    // Create signer
    const signer = new BrowserWalletSigner({ 
      autoApprove: config.autoApprove || false 
    });
    
    // Set up signing handlers
    if (config.onSigningRequest) {
      signer.setSigningRequestHandler(config.onSigningRequest);
    }
    if (config.onBatchSigningRequest) {
      signer.setBatchSigningRequestHandler(config.onBatchSigningRequest);
    }
    
    // Create and initialize execution system
    const executionSystem = new ExecutionSystem();
    executionSystem.initialize(api, config.wallet, signer);
    
    return new DotBot(api, executionSystem, config);
  }
  
  /**
   * Chat with DotBot - Natural language to blockchain operations
   * 
   * This is the main method. Pass a message, get results.
   * 
   * @example
   * ```typescript
   * const result = await dotbot.chat("Send 2 DOT to Bob");
   * console.log(result.response);
   * console.log(result.executed); // true if transaction was executed
   * ```
   */
  async chat(message: string, options?: ChatOptions): Promise<ChatResult> {
    // Build system prompt with current context
    const systemPrompt = options?.systemPrompt || await this.buildContextualSystemPrompt();
    
    // Send to LLM
    const llmResponse = await this.callLLM(message, systemPrompt, options?.llm);
    
    // Extract execution plan
    const plan = this.extractExecutionPlan(llmResponse);
    
    // If no plan, just return the response
    if (!plan || plan.steps.length === 0) {
      return {
        response: llmResponse,
        executed: false,
        success: true,
        completed: 0,
        failed: 0
      };
    }
    
    // Execute the plan
    let completed = 0;
    let failed = 0;
    let success = true;
    
    try {
      await this.executionSystem.execute(
        plan,
        options?.executionOptions,
        {
          onComplete: (s, c, f) => {
            success = s;
            completed = c;
            failed = f;
          }
        }
      );
    } catch (error) {
      success = false;
      throw error;
    }
    
    return {
      response: llmResponse,
      plan,
      executed: true,
      success,
      completed,
      failed
    };
  }
  
  /**
   * Get account balance
   */
  async getBalance(): Promise<{
    free: string;
    reserved: string;
    frozen: string;
  }> {
    const accountInfo = await this.api.query.system.account(this.wallet.address);
    const data = accountInfo.toJSON() as any;
    return {
      free: data.data.free,
      reserved: data.data.reserved,
      frozen: data.data.frozen || data.data.miscFrozen || '0'
    };
  }
  
  /**
   * Get chain info
   */
  async getChainInfo(): Promise<{
    chain: string;
    version: string;
  }> {
    const [chain, version] = await Promise.all([
      this.api.rpc.system.chain(),
      this.api.rpc.system.version()
    ]);
    
    return {
      chain: chain.toString(),
      version: version.toString()
    };
  }
  
  /**
   * Get Polkadot API (for advanced usage)
   */
  getApi(): ApiPromise {
    return this.api;
  }
  
  /**
   * Get current wallet
   */
  getWallet(): WalletAccount {
    return this.wallet;
  }
  
  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    await this.api.disconnect();
  }
  
  /**
   * Build system prompt with current context
   */
  private async buildContextualSystemPrompt(): Promise<string> {
    try {
      const balance = await this.getBalance();
      const chainInfo = await this.getChainInfo();
      
      // Calculate total balance
      const freeBN = BigInt(balance.free || '0');
      const reservedBN = BigInt(balance.reserved || '0');
      const frozenBN = BigInt(balance.frozen || '0');
      const totalBN = freeBN + reservedBN + frozenBN;
      
      return buildSystemPrompt({
        wallet: {
          isConnected: true,
          address: this.wallet.address,
          provider: this.wallet.source
        },
        network: {
          network: chainInfo.chain.toLowerCase().includes('kusama') ? 'kusama' : 'polkadot',
          rpcEndpoint: this.config.endpoint || 'wss://rpc.polkadot.io'
        },
        balance: {
          free: balance.free,
          reserved: balance.reserved,
          frozen: balance.frozen,
          total: totalBN.toString(),
          symbol: 'DOT'
        }
      });
    } catch (error) {
      // Fallback to basic prompt if context fetch fails
      return buildSystemPrompt();
    }
  }
  
  /**
   * Call LLM (can be overridden with custom function)
   */
  private async callLLM(
    message: string, 
    systemPrompt: string,
    customLLM?: (message: string, systemPrompt: string) => Promise<string>
  ): Promise<string> {
    if (customLLM) {
      return await customLLM(message, systemPrompt);
    }
    
    // Default: Use ASI-One (if available in frontend)
    // For now, throw error if no custom LLM provided
    throw new Error(
      'No LLM configured. Pass a custom LLM function in chat options:\n' +
      'dotbot.chat(message, { llm: async (msg, prompt) => { /* your LLM call */ } })'
    );
  }
  
  /**
   * Extract execution plan from LLM response
   */
  private extractExecutionPlan(llmResponse: string): ExecutionPlan | null {
    try {
      // Look for JSON code block
      const jsonMatch = llmResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[1]);
        if (this.isValidExecutionPlan(plan)) {
          return plan;
        }
      }
      
      // Try to parse entire response as JSON
      try {
        const plan = JSON.parse(llmResponse);
        if (this.isValidExecutionPlan(plan)) {
          return plan;
        }
      } catch {
        // Not JSON, that's fine
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * Validate execution plan structure
   */
  private isValidExecutionPlan(obj: any): obj is ExecutionPlan {
    return (
      obj &&
      typeof obj === 'object' &&
      'id' in obj &&
      'steps' in obj &&
      Array.isArray(obj.steps)
    );
  }
}

