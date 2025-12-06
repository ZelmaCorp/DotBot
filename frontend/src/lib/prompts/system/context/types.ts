/**
 * Context Types for System Prompt
 * 
 * Types for contextual information that gets injected into the system prompt
 * based on the current state of the application.
 */

export interface WalletContext {
  /** Whether wallet is connected */
  isConnected: boolean;
  
  /** Connected wallet address */
  address?: string;
  
  /** Wallet provider name (Talisman, SubWallet, etc.) */
  provider?: string;
  
  /** Available accounts */
  accounts?: Array<{
    address: string;
    name?: string;
    balance?: string;
  }>;
}

export interface NetworkContext {
  /** Current network name */
  network: 'polkadot' | 'kusama' | string;
  
  /** Network RPC endpoint */
  rpcEndpoint?: string;
  
  /** Network chain ID */
  chainId?: string;
  
  /** Available networks */
  availableNetworks?: string[];
}

export interface BalanceContext {
  /** Free balance */
  free: string;
  
  /** Reserved balance */
  reserved: string;
  
  /** Frozen balance */
  frozen: string;
  
  /** Total balance */
  total: string;
  
  /** Token symbol */
  symbol: string;
}

export interface SystemContext {
  /** Wallet context */
  wallet: WalletContext;
  
  /** Network context */
  network: NetworkContext;
  
  /** Balance context */
  balance?: BalanceContext;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

