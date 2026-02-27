/**
 * WalletEmptyState Component
 * 
 * Displays when no wallet accounts are detected.
 * 
 * Will be part of @dotbot/react package.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { RefreshCw, Check, Loader2 } from 'lucide-react';
import { useDebouncedClick } from '../../hooks/useDebounce';
import walletIcon from '../../assets/wallet.svg';

const REFRESH_FEEDBACK_MS = 2500;

interface WalletEmptyStateProps {
  isConnecting: boolean;
  onEnableWallet: () => void;
  onRefreshAccounts: () => void | Promise<number>;
}

const WalletEmptyState: React.FC<WalletEmptyStateProps> = ({
  isConnecting,
  onEnableWallet,
  onRefreshAccounts
}) => {
  const handleEnableWallet = useDebouncedClick(onEnableWallet, 1000);

  const [refreshMessage, setRefreshMessage] = useState<{
    type: 'refreshing' | 'success' | 'error';
    text: string;
  } | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRefreshAccounts = useCallback(async () => {
    if (refreshMessage?.type === 'refreshing') return;
    setRefreshMessage({ type: 'refreshing', text: 'Refreshing…' });
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
    try {
      const result = await Promise.resolve(onRefreshAccounts());
      const count = typeof result === 'number' ? result : 0;
      const text =
        typeof result === 'number'
          ? `Found ${count} account${count !== 1 ? 's' : ''}`
          : 'Accounts updated';
      setRefreshMessage({ type: 'success', text });
    } catch {
      setRefreshMessage({ type: 'error', text: 'Something went wrong' });
    }
    feedbackTimeoutRef.current = setTimeout(() => {
      setRefreshMessage(null);
      feedbackTimeoutRef.current = null;
    }, REFRESH_FEEDBACK_MS);
  }, [onRefreshAccounts, refreshMessage?.type]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const isRefreshBusy = refreshMessage?.type === 'refreshing' || isConnecting;

  return (
    <div className="wallet-empty-state">
      <div className="wallet-empty-content">
        <img src={walletIcon} alt="Wallet" className="wallet-empty-icon" />
        <p className="wallet-empty-text">
          No wallet accounts detected
        </p>
      </div>
      
      <div className="wallet-actions">
        <button
          onClick={handleEnableWallet}
          disabled={isConnecting}
          className="wallet-enable-btn"
        >
          {isConnecting ? (
            <>
              <RefreshCw className="wallet-btn-icon animate-spin" />
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
          onClick={handleRefreshAccounts}
          disabled={isRefreshBusy}
          className={`wallet-refresh-btn wallet-refresh-btn--${refreshMessage?.type ?? 'idle'}`}
        >
          {refreshMessage?.type === 'refreshing' ? (
            <Loader2 className="wallet-btn-icon wallet-add-icon--spin" size={16} />
          ) : refreshMessage?.type === 'success' ? (
            <Check className="wallet-btn-icon" size={16} />
          ) : (
            <RefreshCw className="wallet-btn-icon" size={16} />
          )}
          <span>{refreshMessage?.text ?? 'Refresh Connection'}</span>
        </button>
      </div>
      
      <div className="wallet-help-text">
        Make sure you have a Polkadot wallet extension installed and unlocked
      </div>
    </div>
  );
};

export default WalletEmptyState;

