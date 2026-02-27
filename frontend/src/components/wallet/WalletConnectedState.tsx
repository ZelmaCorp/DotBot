/**
 * WalletConnectedState Component
 * 
 * Displays the connected wallet state with account info, other accounts, and disconnect button.
 * 
 * Will be part of @dotbot/react package.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import type { Network } from '@dotbot/core';
import { WalletAccount } from '../../types/wallet';
import { useDebouncedClick } from '../../hooks/useDebounce';
import { getEnvironmentFromNetwork } from '../../utils/appUtils';
import WalletAccountCard from './WalletAccountCard';
import WalletAccountItem from './WalletAccountItem';
import EnvironmentSwitch from './EnvironmentSwitch';

const ADD_ACCOUNT_FEEDBACK_MS = 2500;

interface WalletConnectedStateProps {
  accountName: string;
  address: string;
  source: string;
  network: Network;
  allAccounts: WalletAccount[];
  isConnecting: boolean;
  onDisconnect: () => void;
  onConnectAccount: (account: WalletAccount) => void;
  onRefreshAccounts: () => void | Promise<number>;
  onNetworkSwitch: (network: Network) => void;
}

const WalletConnectedState: React.FC<WalletConnectedStateProps> = ({
  accountName,
  address,
  source,
  network,
  allAccounts,
  isConnecting,
  onDisconnect,
  onConnectAccount,
  onRefreshAccounts,
  onNetworkSwitch,
}) => {
  // Filter out the currently connected account
  const otherAccounts = allAccounts.filter(
    account => account.address !== address
  );

  // Debounced handlers to prevent multiple rapid clicks
  const handleDisconnect = useDebouncedClick(onDisconnect, 500);

  const [addAccountMessage, setAddAccountMessage] = useState<{
    type: 'refreshing' | 'success' | 'error';
    text: string;
  } | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRefreshAccounts = useCallback(async () => {
    if (addAccountMessage?.type === 'refreshing') return;
    setAddAccountMessage({ type: 'refreshing', text: 'Refreshing…' });
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
      setAddAccountMessage({ type: 'success', text });
    } catch {
      setAddAccountMessage({ type: 'error', text: 'Something went wrong' });
    }
    feedbackTimeoutRef.current = setTimeout(() => {
      setAddAccountMessage(null);
      feedbackTimeoutRef.current = null;
    }, ADD_ACCOUNT_FEEDBACK_MS);
  }, [onRefreshAccounts, addAccountMessage?.type]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const isAddAccountBusy = addAccountMessage?.type === 'refreshing' || isConnecting;

  return (
    <div className="wallet-connected-state">
      <WalletAccountCard
        accountName={accountName}
        address={address}
        source={source}
        environment={getEnvironmentFromNetwork(network)}
      />

      {otherAccounts.length > 0 && (
        <div className="wallet-accounts-section">
          <h3 className="wallet-accounts-title">Other Accounts:</h3>
          {otherAccounts.map((account, index) => (
            <WalletAccountItem
              key={`${account.address}-${index}`}
              account={account}
              isConnecting={isConnecting}
              onConnect={onConnectAccount}
            />
          ))}
        </div>
      )}

      {/* Add Account Button – uses button body as message area for feedback */}
      <button
        onClick={handleRefreshAccounts}
        className={`wallet-add-account-btn wallet-add-account-btn--${addAccountMessage?.type ?? 'idle'}`}
        disabled={isAddAccountBusy}
      >
        {addAccountMessage?.type === 'refreshing' ? (
          <Loader2 className="wallet-add-icon wallet-add-icon--spin" size={20} />
        ) : addAccountMessage?.type === 'success' ? (
          <Check className="wallet-add-icon" size={20} />
        ) : (
          <Plus className="wallet-add-icon" size={20} />
        )}
        <span>
          {addAccountMessage?.text ?? 'Add Account'}
        </span>
      </button>

      <EnvironmentSwitch
        network={network}
        onSwitch={onNetworkSwitch}
        variant="modal"
        explanatoryText={false}
      />
      
      <button
        onClick={handleDisconnect}
        className="wallet-disconnect-btn"
        disabled={isConnecting}
      >
        Disconnect Wallet
      </button>
    </div>
  );
};

export default WalletConnectedState;

