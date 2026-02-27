/**
 * WalletAccountsList Component
 * 
 * Lists all available wallet accounts with connect buttons.
 * 
 * Will be part of @dotbot/react package.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import type { Network } from '@dotbot/core';
import { WalletAccount } from '../../types/wallet';
import WalletAccountItem from './WalletAccountItem';
import EnvironmentSwitch from './EnvironmentSwitch';

const ADD_ACCOUNT_FEEDBACK_MS = 2500;

interface WalletAccountsListProps {
  accounts: WalletAccount[];
  isConnecting: boolean;
  network: Network;
  onConnectAccount: (account: WalletAccount) => void;
  onRefreshAccounts: () => void | Promise<number>;
  onNetworkSwitch?: (network: Network) => void;
}

const WalletAccountsList: React.FC<WalletAccountsListProps> = ({
  accounts,
  isConnecting,
  network,
  onConnectAccount,
  onRefreshAccounts,
  onNetworkSwitch,
}) => {
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
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const isAddAccountBusy = addAccountMessage?.type === 'refreshing' || isConnecting;

  return (
    <div className="wallet-accounts-section">
      <h3 className="wallet-accounts-title">Available Accounts:</h3>
      {accounts.map((account, index) => (
        <WalletAccountItem
          key={`${account.address}-${index}`}
          account={account}
          isConnecting={isConnecting}
          onConnect={onConnectAccount}
        />
      ))}
      
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
        <span>{addAccountMessage?.text ?? 'Add Account'}</span>
      </button>
      
      {/* Network Switch Section */}
      {onNetworkSwitch && (
        <EnvironmentSwitch
          network={network}
          onSwitch={onNetworkSwitch}
          variant="modal"
        />
      )}
    </div>
  );
};

export default WalletAccountsList;

