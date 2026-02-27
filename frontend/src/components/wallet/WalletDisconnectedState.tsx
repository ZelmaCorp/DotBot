/**
 * WalletDisconnectedState Component
 * 
 * Displays the disconnected wallet state with accounts list or empty state.
 * 
 * Will be part of @dotbot/react package.
 */

import React from 'react';
import type { Network } from '@dotbot/core';
import { WalletAccount } from '../../types/wallet';
import WalletErrorCard from './WalletErrorCard';
import WalletAccountsList from './WalletAccountsList';
import WalletEmptyState from './WalletEmptyState';

interface WalletDisconnectedStateProps {
  error: string | null;
  accounts: WalletAccount[];
  isConnecting: boolean;
  network: Network;
  onConnectAccount: (account: WalletAccount) => void;
  onEnableWallet: () => void;
  onRefreshAccounts: () => void | Promise<number>;
  onNetworkSwitch?: (network: Network) => void;
}

const WalletDisconnectedState: React.FC<WalletDisconnectedStateProps> = ({
  error,
  accounts,
  isConnecting,
  network,
  onConnectAccount,
  onEnableWallet,
  onRefreshAccounts,
  onNetworkSwitch,
}) => {
  return (
    <div className="wallet-disconnected-state">
      <p className="wallet-description">
        Connect with Talisman, Subwallet, or another Polkadot wallet extension to access DotBot.
      </p>

      {error && <WalletErrorCard error={error} />}

      {accounts.length > 0 ? (
        <WalletAccountsList
          accounts={accounts}
          isConnecting={isConnecting}
          network={network}
          onConnectAccount={onConnectAccount}
          onRefreshAccounts={onRefreshAccounts}
          onNetworkSwitch={onNetworkSwitch}
        />
      ) : (
        <WalletEmptyState
          isConnecting={isConnecting}
          onEnableWallet={onEnableWallet}
          onRefreshAccounts={onRefreshAccounts}
        />
      )}
    </div>
  );
};

export default WalletDisconnectedState;

