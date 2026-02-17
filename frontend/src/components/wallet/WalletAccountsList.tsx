/**
 * WalletAccountsList Component
 * 
 * Lists all available wallet accounts with connect buttons.
 * 
 * Will be part of @dotbot/react package.
 */

import React from 'react';
import { Plus } from 'lucide-react';
import type { Network } from '@dotbot/core';
import { WalletAccount } from '../../types/wallet';
import { useDebouncedClick } from '../../hooks/useDebounce';
import WalletAccountItem from './WalletAccountItem';
import EnvironmentSwitch from './EnvironmentSwitch';

interface WalletAccountsListProps {
  accounts: WalletAccount[];
  isConnecting: boolean;
  network: Network;
  onConnectAccount: (account: WalletAccount) => void;
  onRefreshAccounts: () => void;
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
  // Debounced handler to prevent multiple rapid clicks
  const handleRefreshAccounts = useDebouncedClick(onRefreshAccounts, 500);

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
      
      {/* Add Account Button */}
      <button
        onClick={handleRefreshAccounts}
        className="wallet-add-account-btn"
        disabled={isConnecting}
      >
        <Plus className="wallet-add-icon" size={20} />
        <span>Add Account</span>
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

