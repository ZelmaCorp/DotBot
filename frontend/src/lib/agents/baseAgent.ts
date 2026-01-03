/**
 * Base Agent Class
 * 
 * Base class for all agents providing common functionality.
 * All agents should extend this class for standardized behavior.
 */

import { ApiPromise } from '@polkadot/api';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { decodeAddress } from '@polkadot/keyring';
import { isAddress } from '@polkadot/util-crypto';
import { BN } from '@polkadot/util';
import { AgentResult, AgentError, ValidationResult, BalanceInfo, DryRunResult } from './types';

export abstract class BaseAgent {
  protected api: ApiPromise | null = null;
  protected assetHubApi: ApiPromise | null = null;

  /**
   * Initialize the agent with a Polkadot API instance
   * 
   * @param api Polkadot Relay Chain API instance
   * @param assetHubApi Optional Asset Hub API instance (recommended for DOT operations)
   */
  initialize(api: ApiPromise, assetHubApi?: ApiPromise | null): void {
    this.api = api;
    this.assetHubApi = assetHubApi || null;
  }

  /**
   * Check if the agent is initialized
   */
  protected ensureInitialized(): void {
    if (!this.api) {
      throw new AgentError(
        'Agent not initialized. Call initialize() with an ApiPromise instance first.',
        'NOT_INITIALIZED'
      );
    }
  }

  /**
   * Get the API instance
   */
  protected getApi(): ApiPromise {
    this.ensureInitialized();
    return this.api!;
  }

  /**
   * Validate that an address is valid
   */
  protected validateAddress(address: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!address || address.trim().length === 0) {
      errors.push('Address is required');
      return { valid: false, errors, warnings };
    }

    try {
      // Check if address is valid Polkadot/Substrate address format
      if (!isAddress(address)) {
        errors.push(`Invalid address format: ${address}`);
        return { valid: false, errors, warnings };
      }

      // Decode to verify it's a valid address
      decodeAddress(address);
    } catch (error) {
      errors.push(`Address validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors, warnings };
    }

    return { valid: true, errors: [], warnings };
  }

  /**
   * Get account balance information (defaults to relay chain)
   */
  protected async getBalance(address: string): Promise<BalanceInfo> {
    const api = this.getApi();
    const accountInfo = await api.query.system.account(address);
    
    // Type assertion for account data
    const accountData = accountInfo as any;
    const free = accountData.data?.free?.toString() || '0';
    const reserved = accountData.data?.reserved?.toString() || '0';
    const frozen = accountData.data?.frozen?.toString() || '0';
    const available = new BN(free).sub(new BN(frozen)).toString();

    return {
      free,
      reserved,
      frozen,
      available,
    };
  }

  /**
   * Get account balance from Asset Hub
   */
  protected async getAssetHubBalance(address: string): Promise<BalanceInfo | null> {
    if (!this.assetHubApi) {
      return null;
    }

    try {
      const accountInfo = await this.assetHubApi.query.system.account(address);
      
      // Type assertion for account data
      const accountData = accountInfo as any;
      const free = accountData.data?.free?.toString() || '0';
      const reserved = accountData.data?.reserved?.toString() || '0';
      const frozen = accountData.data?.frozen?.toString() || '0';
      const available = new BN(free).sub(new BN(frozen)).toString();

      return {
        free,
        reserved,
        frozen,
        available,
      };
    } catch (error) {
      // Failed to fetch Asset Hub balance
      return null;
    }
  }

  /**
   * DEPRECATED: Do not use this method!
   * 
   * This method incorrectly infers chain selection from balance.
   * Chain selection MUST be explicit based on user intent.
   * 
   * Use getBalanceOnChain() with explicit chain parameter instead.
   * 
   * @deprecated Use getBalanceOnChain(chain, address) instead
   */
  protected async getDotBalance(address: string): Promise<{
    balance: BalanceInfo;
    chain: 'relay' | 'assetHub';
  }> {
    // DEPRECATED: Use getBalanceOnChain() with explicit chain parameter
    
    // For backward compatibility, default to Asset Hub
    const assetHubBalance = await this.getAssetHubBalance(address);
    if (assetHubBalance) {
      return { balance: assetHubBalance, chain: 'assetHub' };
    }

    // Fall back to relay chain
    const relayBalance = await this.getBalance(address);
    return { balance: relayBalance, chain: 'relay' };
  }

  /**
   * Check if account has sufficient balance
   */
  protected async hasSufficientBalance(
    address: string,
    requiredAmount: string | BN,
    includeFees: boolean = true
  ): Promise<{ sufficient: boolean; available: string; required: string; shortfall?: string }> {
    const balance = await this.getBalance(address);
    const requiredBN = typeof requiredAmount === 'string' ? new BN(requiredAmount) : requiredAmount;
    const availableBN = new BN(balance.available);

    // If we need to include fees, we'll estimate them
    // For now, we'll add a small buffer (0.01 DOT) for fees
    const feeBuffer = includeFees ? new BN(10_000_000_000) : new BN(0); // 0.01 DOT
    const totalRequired = requiredBN.add(feeBuffer);

    const sufficient = availableBN.gte(totalRequired);
    const shortfall = sufficient ? undefined : totalRequired.sub(availableBN).toString();

    return {
      sufficient,
      available: balance.available,
      required: totalRequired.toString(),
      shortfall,
    };
  }

  /**
   * Estimate transaction fee
   */
  protected async estimateFee(
    extrinsic: any,
    address: string
  ): Promise<string> {
    try {
      const { partialFee } = await extrinsic.paymentInfo(address);
      return partialFee.toString();
    } catch (error) {
      // If fee estimation fails, return a conservative estimate
      return '1000000000'; // 0.001 DOT
    }
  }

  /**
   * Dry-run an extrinsic to validate it before returning to user
   * This catches runtime errors BEFORE the user sees the transaction
   * 
   * Uses Chopsticks for real runtime simulation (fork-based execution)
   * Falls back to paymentInfo if Chopsticks is unavailable
   * 
   * @param api The API instance that created the extrinsic (MUST match!)
   * @param extrinsic The extrinsic to validate
   * @param address The sender address
   * @param rpcEndpoint Optional RPC endpoint for Chopsticks (defaults to api endpoint)
   * @returns DryRunResult with success status and fee estimation
   */
  protected async dryRunExtrinsic(
    api: ApiPromise,
    extrinsic: SubmittableExtrinsic<'promise'>,
    address: string,
    rpcEndpoint?: string | string[]
  ): Promise<DryRunResult> {
    // Try Chopsticks simulation first (real runtime execution)
    try {
      const { simulateTransaction, isChopsticksAvailable } = await import(
        '../../services/simulation'
      );
      
      if (await isChopsticksAvailable()) {
        const rpc = rpcEndpoint || this.extractRpcEndpoint(api);
        const result = await simulateTransaction(api, rpc, extrinsic, address);
        
        if (result.success) {
          return {
            success: true,
            estimatedFee: result.estimatedFee,
            wouldSucceed: true,
            validationMethod: 'chopsticks',
            balanceChanges: result.balanceChanges.map((bc: any) => ({
              value: bc.value.toString(),
              change: bc.change,
            })),
            runtimeInfo: {
              validated: true,
              events: result.events.length,
            },
          };
        } else {
          return {
            success: false,
            error: result.error || 'Simulation failed',
            estimatedFee: result.estimatedFee,
            wouldSucceed: false,
            validationMethod: 'chopsticks',
          };
        }
      }
    } catch (chopsticksError) {
      // Chopsticks unavailable, fall back to paymentInfo
    }
    
    // Fallback: Use paymentInfo (structure validation only)
    try {
      const paymentInfo = await extrinsic.paymentInfo(address);
      const estimatedFee = paymentInfo.partialFee.toString();
      
      return {
        success: true,
        estimatedFee,
        wouldSucceed: true,
        validationMethod: 'paymentInfo',
        runtimeInfo: {
          weight: paymentInfo.weight.toString(),
          class: paymentInfo.class.toString(),
          validated: false,
        },
      };
    } catch (error) {
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        error: errorMessage,
        estimatedFee: '0',
        wouldSucceed: false,
        validationMethod: 'paymentInfo',
      };
    }
  }

  /**
   * Extract RPC endpoint from API instance
   */
  private extractRpcEndpoint(api: ApiPromise): string {
    try {
      // Try to get endpoint from API
      const provider = (api as any)._options?.provider;
      if (provider && provider.endpoint) {
        return provider.endpoint;
      }
      
      // Fallback to common endpoints based on genesis hash
      const genesisHash = api.genesisHash.toHex();
      
      // Polkadot
      if (genesisHash === '0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3') {
        return 'wss://rpc.polkadot.io';
      }
      
      // Asset Hub
      if (genesisHash === '0x68d56f15f85d3136970ec16946040bc1752654e906147f7e43e9d539d7c3de2f') {
        return 'wss://polkadot-asset-hub-rpc.polkadot.io';
      }
      
      // Default
      return 'wss://rpc.polkadot.io';
    } catch {
      return 'wss://rpc.polkadot.io';
    }
  }

  /**
   * Get API instance for a specific chain
   * 
   * @param chain The target chain ('assetHub' or 'relay')
   * @returns The corresponding API instance
   * @throws AgentError if the requested API is not available
   */
  protected getApiForChain(chain: 'assetHub' | 'relay'): ApiPromise {
    if (chain === 'assetHub') {
      if (!this.assetHubApi) {
        throw new AgentError(
          'Asset Hub API not available. Please ensure Asset Hub connection is initialized.',
          'ASSET_HUB_NOT_AVAILABLE'
        );
      }
      return this.assetHubApi;
    }
    
    // Default to relay chain
    return this.getApi();
  }

  /**
   * Get balance on a specific chain
   * 
   * @param chain The target chain
   * @param address The account address
   * @returns Balance information for that chain
   */
  protected async getBalanceOnChain(
    chain: 'assetHub' | 'relay',
    address: string
  ): Promise<BalanceInfo> {
    if (chain === 'assetHub') {
      const balance = await this.getAssetHubBalance(address);
      if (!balance) {
        throw new AgentError(
          'Unable to fetch Asset Hub balance',
          'ASSET_HUB_BALANCE_FETCH_FAILED'
        );
      }
      return balance;
    }
    
    // Relay chain
    return this.getBalance(address);
  }

  /**
   * Format amount for display (convert from Planck to DOT)
   */
  protected formatAmount(amount: string | BN, decimals: number = 10): string {
    const amountBN = typeof amount === 'string' ? new BN(amount) : amount;
    const divisor = new BN(10).pow(new BN(decimals));
    const whole = amountBN.div(divisor).toString();
    const fraction = amountBN.mod(divisor).toString().padStart(decimals, '0');
    return `${whole}.${fraction}`;
  }

  /**
   * Parse amount from human-readable format to Planck
   */
  protected parseAmount(amount: string | number, decimals: number = 10): BN {
    const amountStr = typeof amount === 'number' ? amount.toString() : amount;
    const [whole, fraction = ''] = amountStr.split('.');
    const fractionPadded = fraction.padEnd(decimals, '0').slice(0, decimals);
    const wholeBN = new BN(whole || '0');
    const fractionBN = new BN(fractionPadded || '0');
    const divisor = new BN(10).pow(new BN(decimals));
    return wholeBN.mul(divisor).add(fractionBN);
  }

  /**
   * Create a standardized agent result
   */
  protected createResult(
    description: string,
    extrinsic?: any,
    options: {
      estimatedFee?: string;
      warnings?: string[];
      metadata?: Record<string, any>;
      data?: any;
      resultType?: 'extrinsic' | 'data' | 'mixed' | 'confirmation';
      requiresConfirmation?: boolean;
      executionType?: 'extrinsic' | 'data_fetch' | 'validation' | 'user_input';
    } = {}
  ): AgentResult {
    const {
      estimatedFee,
      warnings,
      metadata,
      data,
      resultType = extrinsic ? 'extrinsic' : 'data',
      requiresConfirmation = true,
      executionType = extrinsic ? 'extrinsic' : 'data_fetch',
    } = options;

    return {
      description,
      extrinsic,
      estimatedFee,
      warnings,
      metadata,
      data,
      resultType,
      requiresConfirmation,
      executionType,
    };
  }

  /**
   * Get agent name (for logging/debugging)
   */
  abstract getAgentName(): string;
}

