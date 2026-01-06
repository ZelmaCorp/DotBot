/**
 * WalletConnectedState Component
 * 
 * Displays the connected wallet state with account info and disconnect button.
 * 
 * Will be part of @dotbot/react package.
 */

import React from 'react';
import { Environment } from '../../lib';
import WalletAccountCard from './WalletAccountCard';
import EnvironmentSwitch from './EnvironmentSwitch';

interface WalletConnectedStateProps {
  accountName: string;
  address: string;
  source: string;
  environment: Environment;
  onDisconnect: () => void;
  onEnvironmentSwitch: (environment: Environment) => void;
}

const WalletConnectedState: React.FC<WalletConnectedStateProps> = ({
  accountName,
  address,
  source,
  environment,
  onDisconnect,
  onEnvironmentSwitch
}) => {
  return (
    <div className="wallet-connected-state">
      <WalletAccountCard
        accountName={accountName}
        address={address}
        source={source}
        environment={environment}
      />
      

      <EnvironmentSwitch
        environment={environment}
        onSwitch={onEnvironmentSwitch}
        variant="modal"
        explanatoryText={false}
      />
      
      <button
        onClick={onDisconnect}
        className="wallet-disconnect-btn"
      >
        Disconnect Wallet
      </button>
    </div>
  );
};

export default WalletConnectedState;

