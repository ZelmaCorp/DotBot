import { web3Accounts, web3Enable } from '@polkadot/extension-dapp';
import { signatureVerify, cryptoWaitReady } from '@polkadot/util-crypto';
import { decodeAddress } from '@polkadot/keyring';
import { WalletAccount } from '../../types/wallet';

// const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

interface WalletStatus {
  available: boolean;
  locked: boolean;
  error?: string;
  extensions?: string[];
}

interface AuthenticationResult {
  success: boolean;
  user?: any;
  token?: string;
  error?: string;
}

class Web3AuthService {
  private currentAccount: WalletAccount | null = null;
  private authToken: string | null = null;
  private user: any = null;
  private extensionsEnabled: boolean = false;
  private enabledExtensionsCache: any[] | null = null;
  private enablePromise: Promise<any[]> | null = null;

  constructor() {
    this.authToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');
    this.user = storedUser ? JSON.parse(storedUser) : null;
  }

  /**
   * Internal method to enable Web3 extensions (with caching to prevent duplicate calls)
   */
  private async _enableWeb3Internal(): Promise<any[]> {
    // If already enabled and cached, return cache
    if (this.enabledExtensionsCache !== null) {
      console.log('Using cached extensions');
      return this.enabledExtensionsCache;
    }

    // If there's already a pending enable call, wait for it
    if (this.enablePromise !== null) {
      console.log('Waiting for pending web3Enable call...');
      return this.enablePromise;
    }

    // Create new enable promise
    console.log('Enabling Web3 extensions...');
    this.enablePromise = web3Enable('DotBot');

    try {
      const extensions = await this.enablePromise;
      console.log('Enabled extensions:', extensions);

      if (extensions.length === 0) {
        throw new Error('No Web3 extensions found. Please install Talisman, Subwallet, or another Polkadot wallet extension.');
      }

      // Cache the result
      this.enabledExtensionsCache = extensions;
      this.extensionsEnabled = true;

      return extensions;
    } catch (error) {
      console.error('Error enabling Web3:', error);
      this.extensionsEnabled = false;
      this.enabledExtensionsCache = null;
      throw error;
    } finally {
      this.enablePromise = null;
    }
  }

  /**
   * Enable Web3 extensions and get available accounts
   * MUST be called before authenticate() to ensure extensions are ready
   */
  async enableWeb3(): Promise<WalletAccount[]> {
    try {
      await this._enableWeb3Internal();

      // Get all available accounts
      const accounts = await web3Accounts();
      console.log('Available accounts:', accounts);

      // Transform to our WalletAccount interface
      return accounts.map(account => ({
        address: account.address,
        name: account.meta?.name || 'Unnamed Account',
        source: account.meta?.source || 'unknown',
        type: account.type,
        genesisHash: account.meta?.genesisHash || undefined
      }));
    } catch (error) {
      console.error('Error enabling Web3:', error);
      throw error;
    }
  }

  /**
   * Check if wallet extensions are available
   */
  async checkWalletAvailability(): Promise<WalletStatus> {
    try {
      console.log('Checking wallet availability...');
      
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        console.log('Not in browser environment');
        return { available: false, locked: false, error: 'Not in browser environment' };
      }
      
      // Check if the polkadot extension object exists
      if (typeof (window as any).injectedWeb3 === 'undefined') {
        console.log('No injectedWeb3 found');
        return { available: false, locked: false, error: 'No wallet extensions detected' };
      }
      
      console.log('Available injected extensions:', Object.keys((window as any).injectedWeb3));
      
      // Try to enable extensions (using cached method)
      const extensions = await this._enableWeb3Internal();
      console.log('web3Enable result:', extensions);
      
      // If extensions array is empty but we have injectedWeb3, the extensions might be locked
      if (extensions.length === 0 && Object.keys((window as any).injectedWeb3).length > 0) {
        console.log('Extensions detected but not enabled - likely locked');
        return { 
          available: true, 
          locked: true, 
          extensions: Object.keys((window as any).injectedWeb3) 
        };
      }
      
      return { 
        available: extensions.length > 0, 
        locked: false, 
        extensions: extensions.map(ext => ext.name) 
      };
    } catch (error) {
      console.error('Error checking wallet availability:', error);
      return { 
        available: false, 
        locked: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get available accounts if wallet is enabled
   */
  async getAvailableAccounts(): Promise<WalletAccount[]> {
    try {
      console.log('Getting available accounts...');
      const accounts = await web3Accounts();
      console.log('Retrieved accounts:', accounts);
      
      return accounts.map(account => ({
        address: account.address,
        name: account.meta?.name || 'Unnamed Account',
        source: account.meta?.source || 'unknown',
        type: account.type,
        genesisHash: account.meta?.genesisHash || undefined
      }));
    } catch (error) {
      console.error('Error getting accounts:', error);
      return [];
    }
  }

  /**
   * TEST: Exact playground code - call web3Enable FRESH
   */
  async testPlaygroundCode(account: WalletAccount): Promise<void> {
    // Call web3Enable FRESH just like the working playground!
    const extensions = await web3Enable('DotBot');
    console.log('🧪 PLAYGROUND TEST - Fresh extensions:', extensions.map((e: any) => e.name));
    const extension = extensions.find((e: any) => e.name === account.source);
    
    if (!extension || !extension.signer || !extension.signer.signRaw) {
      throw new Error('No signer available');
    }

    const timestamp = Date.now();
    const message = `Test Message\nTimestamp: ${timestamp}\nAddress: ${account.address}`;
    
    console.log('🧪 PLAYGROUND TEST - Message:', message);

    const signResult = await extension.signer.signRaw({
      address: account.address,
      data: message,
      type: 'payload'
    });

    console.log('🧪 PLAYGROUND TEST - Signature:', signResult.signature);

    const verificationResult = signatureVerify(message, signResult.signature, account.address);
    
    console.log('🧪 PLAYGROUND TEST - Result:', {
      isValid: verificationResult.isValid,
      crypto: verificationResult.crypto
    });
    
    const expectedPublicKey = decodeAddress(account.address);
    if (verificationResult.publicKey) {
      const keysMatch = expectedPublicKey.length === verificationResult.publicKey.length &&
        expectedPublicKey.every((b, i) => b === verificationResult.publicKey![i]);
      console.log('🧪 PLAYGROUND TEST - Keys match:', keysMatch);
      console.log('🧪 PLAYGROUND TEST - FINAL:', verificationResult.isValid && keysMatch ? '✅ SUCCESS' : '❌ FAIL');
    }
  }

  /**
   * Authenticate with a specific account
   * 
   * CRITICAL: ensureWeb3Enabled() is called first to ensure extensions are ready
   */
  async authenticate(account: WalletAccount): Promise<AuthenticationResult> {
    try {
      this.currentAccount = account;
      
      console.log('🚀 Starting authentication process');
      console.log('📋 Account details:', {
        address: account.address,
        name: account.name || 'unnamed',
        source: account.source,
        type: account.type || 'not specified',
        genesisHash: account.genesisHash || 'not specified'
      });
      
      // Create message (EXACT playground format for testing)
      const timestamp = Date.now();
      const message = `Test Message\nTimestamp: ${timestamp}\nAddress: ${account.address}`;
      
      console.log('📝 Message:', message);
      
      // Decode account address to get the expected public key (for comparison)
      const expectedPublicKey = decodeAddress(account.address);
      
      // Verify account is accessible
      if (!account.address) {
        throw new Error('Account address is missing. Please select a valid account in your wallet extension.');
      }
      
      // Request signature from the wallet
      let signatureData: string;
      try {
        // Call web3Enable FRESH just like the working playground
        const extensions = await web3Enable('DotBot');
        console.log('🔌 All extensions:', extensions.map((e: any) => ({ name: e.name, version: e.version })));
        console.log('🔍 Looking for extension with name:', account.source);
        const extension = extensions.find((e: any) => e.name === account.source);
        
        if (!extension) {
          console.error('❌ Extension not found! Available:', extensions.map((e: any) => e.name));
          throw new Error(`Extension "${account.source}" not found`);
        }
        
        if (!extension.signer || !extension.signer.signRaw) {
          throw new Error('No signer available');
        }

        console.log('✅ Signer found:', { name: extension.name, hasSigner: !!extension.signer, hasSignRaw: !!extension.signer?.signRaw });
        console.log('📝 About to sign:', {
          address: account.address,
          messageLength: message.length,
          message: message,
          messageBytes: Array.from(new TextEncoder().encode(message)).slice(0, 20),
          type: 'payload'
        });

        // Sign with type: 'payload' (exactly like playground)
        const signResult = await extension.signer.signRaw({
          address: account.address,
          data: message,
          type: 'payload'
        });

        console.log('📥 Raw signResult:', {
          type: typeof signResult,
          keys: Object.keys(signResult),
          signResult: signResult
        });

        // Extract signature EXACTLY like playground
        signatureData = signResult.signature;
        console.log('✅ Extracted signature:', signatureData);
        
      } catch (signError) {
        console.error('Signing error:', signError);
        
        // Provide more specific error messages
        if (signError instanceof Error) {
          if (signError.message.includes('Unable to retrieve keypair')) {
            throw new Error(`Account not accessible: ${signError.message}. Please ensure the account is unlocked and accessible in your wallet extension.`);
          } else           if (signError.message.includes('User rejected')) {
            throw new Error('Signing was rejected by the user. Please approve the signing request in your wallet extension.');
          } else if (signError.message.includes('No signing method found')) {
            const enabledExtensions = await this._enableWeb3Internal();
            throw new Error(`No signing method found. Available extensions: ${enabledExtensions?.map(e => e.name).join(', ') || 'none'}`);
          } else {
            throw new Error(`Failed to sign message: ${signError.message}`);
          }
        } else {
          throw new Error('Failed to sign message: Unknown error');
        }
      }

      // Signature already extracted above
      console.log('🔐 Final signature to verify:', signatureData);

      // Verify signature - REQUIRED for security
      // CRITICAL: Verify the EXACT SAME BYTES that were signed (raw Uint8Array)
      // CRITICAL: Compare PUBLIC KEYS, not SS58 addresses!
      let isValid = false;
      let verificationError: Error | null = null;
      
      try {
        // Verify signature (EXACT playground call)
        console.log('🔍 About to verify with:', {
          message: message,
          messageLength: message.length,
          signature: signatureData,
          signatureLength: signatureData.length,
          address: account.address
        });
        
        // Ensure crypto library is fully initialized
        await cryptoWaitReady();
        console.log('✅ Crypto library ready');
        
        const verificationResult = signatureVerify(message, signatureData, account.address);
        
        console.log('🔍 Verification result:', {
          isValid: verificationResult.isValid,
          crypto: verificationResult.crypto,
          publicKeyLength: verificationResult.publicKey?.length
        });
        
        // Compare public keys (not SS58 addresses)
        if (verificationResult.publicKey) {
          const verifiedPublicKey = verificationResult.publicKey;
          const keysMatch = expectedPublicKey.length === verifiedPublicKey.length &&
            expectedPublicKey.every((b, i) => b === verifiedPublicKey[i]);
          
          console.log('🔑 Keys match:', keysMatch);
          
          // Success ONLY if both signature valid AND public keys match
          isValid = verificationResult.isValid && keysMatch;
          
          if (!keysMatch) {
            verificationError = new Error('Public keys do not match. Wrong account or address encoding issue.');
          } else if (!verificationResult.isValid) {
            verificationError = new Error('Signature is invalid. Message or signature may have been modified.');
          }
        } else {
          isValid = verificationResult.isValid;
          if (!isValid) {
            verificationError = new Error('Signature verification failed.');
          }
        }
      } catch (verifyError) {
        verificationError = verifyError instanceof Error 
          ? verifyError 
          : new Error(`Signature verification threw an error: ${String(verifyError)}`);
        console.error('❌ Signature verification exception:', {
          error: verificationError.message,
          stack: verificationError.stack
        });
      }
      
      if (verificationError || !isValid) {
        const errorMessage = verificationError?.message || 'Signature verification failed';
        console.error('❌ Verification failed:', errorMessage);
        throw new Error(`Authentication failed: ${errorMessage}`);
      }
      
      console.log('✅ Signature verified successfully!', {
        address: account.address,
        publicKeyMatch: true,
        signatureValid: true
      });

      // In a real implementation, you would send the signature to your backend for authentication
      // For now, we'll create a local session token
      const sessionToken = `session_${account.address}_${Date.now()}`;
      
      console.log('✅ Authentication successful! Session created.');

      // Store authentication state
      this.authToken = sessionToken;
      this.user = {
        id: account.address,
        address: account.address,
        name: account.name,
        source: account.source
      };
      this.currentAccount = account;
      
      // Store in localStorage
      localStorage.setItem('authToken', this.authToken);
      localStorage.setItem('user', JSON.stringify(this.user));
      
      console.log('Service: Authentication state updated:', {
        authToken: this.authToken,
        user: this.user,
        currentAccount: this.currentAccount,
        isAuthenticated: this.isAuthenticated()
      });
      
      return {
        success: true,
        user: this.user,
        token: this.authToken
      };
    } catch (error: any) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      // In a real implementation, you would call a logout endpoint
      console.log('Logging out user');
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      // Clear local data
      this.currentAccount = null;
      this.authToken = null;
      this.user = null;
      
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.authToken && !!this.user;
  }

  /**
   * Get current user
   */
  getCurrentUser(): any {
    return this.user;
  }

  /**
   * Get current account
   */
  getCurrentAccount(): WalletAccount | null {
    return this.currentAccount;
  }

  /**
   * Get auth token
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Initialize authentication state
   */
  async initialize(): Promise<boolean> {
    if (this.authToken && this.user) {
      // In a real implementation, you would verify the token with your backend
      console.log('Initializing with existing auth state');
      return true;
    }
    return false;
  }
}

// Create singleton instance - all components use this same instance
const web3AuthService = new Web3AuthService();

// Export both default and named for flexibility
export default web3AuthService;
export { web3AuthService };
