import React, { useEffect, useState } from 'react';
import { X, AlertCircle, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';
import { useWalletStore } from '../../stores/walletStore';
import { WalletAccount } from '../../types/wallet';
import web3AuthService from '../../lib/services/web3AuthService';
import walletIcon from '../../assets/wallet.svg';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const {
    isConnected,
    selectedAccount,
    availableWallets,
    isConnecting,
    error,
    enableWallet,
    connectAccount,
    disconnect,
    refreshAccounts,
    clearError,
    setError
  } = useWalletStore();

  const [connectingAccount, setConnectingAccount] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Initialize wallet check when modal opens
  useEffect(() => {
    if (isOpen && !isConnected) {
      // Clear any previous errors
      clearError();
      setLocalError(null);
      // Enable wallet to get accounts
      enableWallet().catch(err => {
        console.error('Failed to enable wallet:', err);
        setError(err instanceof Error ? err.message : 'Failed to enable wallet');
      });
    }
  }, [isOpen, isConnected, enableWallet, clearError, setError]);

  // Clear errors when modal closes
  useEffect(() => {
    if (!isOpen) {
      clearError();
      setLocalError(null);
      setConnectingAccount(null);
    }
  }, [isOpen, clearError]);

  // Close modal automatically on successful connection
  useEffect(() => {
    if (isOpen && isConnected && selectedAccount && !error && !localError) {
      // Small delay to show success state
      const timer = setTimeout(() => {
        onClose();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isConnected, selectedAccount, error, localError, onClose]);

  if (!isOpen) return null;

  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const getAllAccounts = (): WalletAccount[] => {
    return availableWallets.flatMap(wallet => wallet.accounts);
  };

  /**
   * Handle account connection with proper error handling
   * This is the critical function that calls web3AuthService.authenticate()
   */
  const handleConnectAccount = async (account: WalletAccount) => {
    console.log('Modal: Connecting to account:', account);
    
    // Clear previous errors
    clearError();
    setLocalError(null);
    setConnectingAccount(account.address);
    
    try {
      // Call authenticate directly - it will ensure extensions are enabled internally
      // This will:
      // 1. Request signature from wallet
      // 2. Verify signature
      // 3. Store auth state
      console.log('Modal: Calling web3AuthService.authenticate()...');
      const result = await web3AuthService.authenticate(account);
      console.log('Modal: Authentication result:', result);

      if (result.success) {
        // Update store state via connectAccount
        // This ensures store and service are in sync
        await connectAccount(account);
        
        // Verify connection succeeded
        const store = useWalletStore.getState();
        if (store.isConnected && store.selectedAccount) {
          console.log('Modal: ✅ Connection successful, closing modal');
          // Modal will close automatically via useEffect
        } else {
          console.warn('Modal: ⚠️ Authentication succeeded but store not updated');
          setLocalError('Connection succeeded but state update failed. Please try again.');
        }
      } else {
        throw new Error(result.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Modal: ❌ Connection error:', error);
      
      // Categorize and format error message
      let errorMessage = 'Connection failed';
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        
        if (msg.includes('user rejected') || msg.includes('rejected')) {
          errorMessage = 'Signing was cancelled. Please approve the signing request in your wallet extension.';
        } else if (msg.includes('signature verification') || msg.includes('signature is invalid')) {
          errorMessage = 'Signature verification failed. This may indicate:\n• Wrong account selected\n• Wallet extension issue\n• Please try signing again';
        } else if (msg.includes('locked') || msg.includes('unlock')) {
          errorMessage = 'Wallet is locked. Please unlock your wallet extension and try again.';
        } else if (msg.includes('no signing method') || msg.includes('signraw')) {
          errorMessage = 'Wallet signing failed. Please check your wallet extension is unlocked and try again.';
        } else if (msg.includes('not accessible') || msg.includes('keypair')) {
          errorMessage = 'Account not accessible. Please ensure the account is unlocked in your wallet extension.';
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = `Unknown error: ${String(error)}`;
      }
      
      // Set error in both local state and store
      setLocalError(errorMessage);
      setError(errorMessage);
      
      console.error('Modal: Error details:', {
        error,
        errorMessage,
        account: account.address
      });
    } finally {
      setConnectingAccount(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      onClose();
    } catch (error) {
      console.error('Disconnect error:', error);
      setLocalError(error instanceof Error ? error.message : 'Failed to disconnect');
    }
  };

  const handleRefresh = async () => {
    clearError();
    setLocalError(null);
    try {
      await refreshAccounts();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to refresh accounts';
      setLocalError(errorMsg);
      setError(errorMsg);
    }
  };

  // Get display error (local error takes precedence)
  const displayError = localError || error;

  return (
    <div className="wallet-modal-overlay" onClick={onClose}>
      <div className="wallet-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wallet-modal-header">
          <div className="wallet-modal-title">
            <img src={walletIcon} alt="Wallet" className="wallet-modal-icon" />
            <h2 className="wallet-modal-heading">
              {isConnected ? 'Wallet Connected' : 'Connect Wallet'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="wallet-modal-close"
            disabled={isConnecting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="wallet-modal-content">
          {isConnected && selectedAccount ? (
            // Connected state
            <div className="wallet-connected-state">
              <div className="wallet-account-card">
                <div className="wallet-status">
                  <CheckCircle2 className="wallet-status-icon text-green-500" />
                  <span className="wallet-status-text">Connected</span>
                </div>
                <div className="wallet-account-info">
                  <div className="wallet-account-name">{selectedAccount.name}</div>
                  <div className="wallet-account-address">
                    {formatAddress(selectedAccount.address)}
                  </div>
                  <div className="wallet-account-source">
                    via {selectedAccount.source}
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleDisconnect}
                className="wallet-disconnect-btn"
                disabled={isConnecting}
              >
                Disconnect Wallet
              </button>
            </div>
          ) : (
            // Not connected state
            <div className="wallet-disconnected-state">
              <p className="wallet-description">
                Connect with Talisman, Subwallet, or another Polkadot wallet extension to access DotBot.
              </p>

              {/* Error Display */}
              {displayError && (
                <div className="wallet-error-card">
                  <div className="wallet-error-content">
                    <AlertCircle className="wallet-error-icon" />
                    <div className="wallet-error-text">
                      {displayError.split('\n').map((line, i) => (
                        <React.Fragment key={i}>
                          {line}
                          {i < displayError.split('\n').length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      clearError();
                      setLocalError(null);
                    }}
                    className="wallet-error-dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {getAllAccounts().length > 0 ? (
                // Show available accounts
                <div className="wallet-accounts-section">
                  <h3 className="wallet-accounts-title">Available Accounts:</h3>
                  {getAllAccounts().map((account, index) => {
                    const isConnectingThis = connectingAccount === account.address;
                    const isDisabled = isConnecting || isConnectingThis;
                    
                    return (
                      <div
                        key={`${account.address}-${index}`}
                        className={`wallet-account-item ${isConnectingThis ? 'connecting' : ''}`}
                      >
                        <div className="wallet-account-details">
                          <div className="wallet-account-name">
                            {account.name || 'Unnamed Account'}
                          </div>
                          <div className="wallet-account-address">
                            {formatAddress(account.address)}
                          </div>
                          <div className="wallet-account-source">
                            via {account.source}
                          </div>
                        </div>
                        <button
                          onClick={() => handleConnectAccount(account)}
                          disabled={isDisabled}
                          className="wallet-connect-btn"
                        >
                          {isConnectingThis ? (
                            <>
                              <Loader2 className="wallet-btn-icon animate-spin" />
                              <span>Signing...</span>
                            </>
                          ) : (
                            'Connect'
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // No accounts found - show enable/refresh options
                <div className="wallet-empty-state">
                  <div className="wallet-empty-content">
                    <img src={walletIcon} alt="Wallet" className="wallet-empty-icon" />
                    <p className="wallet-empty-text">
                      No wallet accounts detected
                    </p>
                  </div>
                  
                  <div className="wallet-actions">
                    <button
                      onClick={enableWallet}
                      disabled={isConnecting}
                      className="wallet-enable-btn"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="wallet-btn-icon animate-spin" />
                          <span>Enabling...</span>
                        </>
                      ) : (
                        <>
                          <img src={walletIcon} alt="Wallet" className="wallet-btn-icon" />
                          <span>Enable Wallet Extensions</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={handleRefresh}
                      disabled={isConnecting}
                      className="wallet-refresh-btn"
                    >
                      <RefreshCw className={`wallet-btn-icon ${isConnecting ? 'animate-spin' : ''}`} />
                      <span>Refresh Connection</span>
                    </button>
                  </div>
                  
                  <div className="wallet-help-text">
                    Make sure you have a Polkadot wallet extension installed and unlocked
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
