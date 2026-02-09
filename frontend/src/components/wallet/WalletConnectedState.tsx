/**
 * WalletConnectedState Component
 * 
 * Displays the connected wallet state with account info, other accounts, and disconnect button.
 * 
 * Will be part of @dotbot/react package.
 */

import React from 'react';
import { Plus } from 'lucide-react';
import type { Network } from '@dotbot/core';
import { WalletAccount } from '../../types/wallet';
import { useDebouncedClick } from '../../hooks/useDebounce';
import { getEnvironmentFromNetwork } from '../../utils/appUtils';
import WalletAccountCard from './WalletAccountCard';
import WalletAccountItem from './WalletAccountItem';
import EnvironmentSwitch from './EnvironmentSwitch';

interface WalletConnectedStateProps {
  accountName: string;
  address: string;
  source: string;
  network: Network;
  allAccounts: WalletAccount[];
  isConnecting: boolean;
  onDisconnect: () => void;
  onConnectAccount: (account: WalletAccount) => void;
  onRefreshAccounts: () => void;
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
  const handleRefreshAccounts = useDebouncedClick(onRefreshAccounts, 500);

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

      {/* Add Account Button */}
      <button
        onClick={handleRefreshAccounts}
        className="wallet-add-account-btn"
        disabled={isConnecting}
      >
        <Plus className="wallet-add-icon" size={20} />
        <span>Add Account</span>
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

