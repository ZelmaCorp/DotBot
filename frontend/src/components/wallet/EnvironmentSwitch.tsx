/**
 * EnvironmentSwitch Component
 *
 * Allows switching between Mainnet and testnets (Westend, Paseo).
 * Shows a 3-option control so the current selection is always visible.
 *
 * Variants:
 * - "modal": Full 3-option segment + explanation, used in WalletModal
 * - "compact": Small 3-option buttons for header/toolbar
 */

import React, { useState } from 'react';
import { Info, Loader2 } from 'lucide-react';
import type { Network } from '@dotbot/core';
import '../../styles/environment-switch.css';

/** Networks offered in this switch (mainnet = Polkadot; testnets = Westend, Paseo) */
type SwitchableNetwork = 'polkadot' | 'westend' | 'paseo';

const SWITCH_NETWORKS: { network: SwitchableNetwork; label: string }[] = [
  { network: 'polkadot', label: 'Mainnet' },
  { network: 'westend', label: 'Westend' },
  { network: 'paseo', label: 'Paseo' },
];

const FAUCET_URLS: Partial<Record<SwitchableNetwork, string>> = {
  westend: 'https://faucet.polkadot.io/westend',
  paseo: 'https://faucet.polkadot.io/paseo',
};

interface EnvironmentSwitchProps {
  /** Current network (polkadot, westend, or paseo for this switch) */
  network: Network;
  onSwitch: (network: Network) => Promise<void> | void;
  variant?: 'modal' | 'compact';
  disabled?: boolean;
  explanatoryText?: boolean;
}

const EnvironmentSwitch: React.FC<EnvironmentSwitchProps> = ({
  network,
  onSwitch,
  variant = 'modal',
  disabled = false,
  explanatoryText = true,
}) => {
  const [isSwitching, setIsSwitching] = useState(false);
  const currentNetwork: SwitchableNetwork = SWITCH_NETWORKS.some((o) => o.network === network)
    ? (network as SwitchableNetwork)
    : 'polkadot';

  const handleSelect = async (targetNetwork: SwitchableNetwork) => {
    if (isSwitching || disabled || targetNetwork === currentNetwork) return;
    setIsSwitching(true);
    try {
      await onSwitch(targetNetwork as unknown as Network);
    } catch (error) {
      console.error('Environment switch failed:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  // Compact variant - 3 small segment buttons
  if (variant === 'compact') {
    return (
      <div className="environment-switch-compact-group" role="group" aria-label="Network">
        {SWITCH_NETWORKS.map(({ network: n, label }) => {
          const isActive = n === currentNetwork;
          return (
            <button
              key={n}
              type="button"
              onClick={() => handleSelect(n)}
              disabled={isSwitching || disabled}
              className={`environment-switch-compact-option ${isActive ? 'active' : ''}`}
              title={label}
            >
              {isSwitching && n === currentNetwork ? (
                <Loader2 className="environment-switch-icon animate-spin" size={14} />
              ) : (
                <span className="environment-switch-compact-label">{label.slice(0, 1)}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Modal variant - 3-option segment + description + faucet when testnet
  const isTestnet = currentNetwork === 'westend' || currentNetwork === 'paseo';
  const faucetUrl = isTestnet ? FAUCET_URLS[currentNetwork] ?? '' : '';

  return (
    <div className="environment-switch-modal">
      <div className="environment-switch-content">
        <div className="environment-switch-header">
          <Info className="environment-switch-info-icon" size={18} />
          <span className="environment-switch-title">Network</span>
        </div>

        <div className="environment-switch-segment" role="group" aria-label="Network">
          {SWITCH_NETWORKS.map(({ network: n, label }) => {
            const isActive = n === currentNetwork;
            return (
              <button
                key={n}
                type="button"
                onClick={() => handleSelect(n)}
                disabled={isSwitching || disabled}
                className={`environment-switch-segment-option ${isActive ? 'active' : ''} ${n === 'polkadot' ? 'mainnet' : 'testnet'}`}
              >
                {isSwitching && isActive ? (
                  <Loader2 className="environment-switch-spinner" size={14} />
                ) : (
                  label
                )}
              </button>
            );
          })}
        </div>

        {explanatoryText && (
          <p className="environment-switch-description">
            {currentNetwork === 'polkadot' &&
              'Mainnet uses real DOT. Westend and Paseo are testnets with no real value.'}
            {currentNetwork === 'westend' &&
              'Westend testnet uses WND. Safe for testing without real tokens.'}
            {currentNetwork === 'paseo' &&
              'Paseo testnet uses PAS. Community-run testnet for development.'}
          </p>
        )}

        {isTestnet && faucetUrl && (
          <div className="environment-switch-faucet">
            <span className="environment-switch-faucet-label">Need more testnet tokens?</span>
            <a
              href={faucetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="environment-switch-faucet-link"
            >
              {currentNetwork === 'westend' ? 'faucet.polkadot.io/westend' : 'faucet.polkadot.io/'}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnvironmentSwitch;
