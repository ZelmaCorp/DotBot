/**
 * Simulation Banner Component
 * 
 * Displays simulation status banners (success, failure, disabled)
 */

import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export interface SimulationBannerProps {
  type: 'success' | 'failure' | 'disabled';
  successCount?: number;
  failureCount?: number;
}

const SimulationBanner: React.FC<SimulationBannerProps> = ({
  type,
  successCount = 0,
  failureCount = 0
}) => {
  if (type === 'success') {
    return (
      <div className="simulation-banner simulation-success">
        <div className="banner-icon">
          <CheckCircle2 size={20} />
        </div>
        <div className="banner-content">
          <div className="banner-title">✓ Simulation Successful</div>
          <div className="banner-description">
            {successCount} transaction{successCount !== 1 ? 's' : ''} passed simulation and {successCount !== 1 ? 'are' : 'is'} ready to execute. Review the details below and click "Accept and Start" to proceed.
          </div>
        </div>
      </div>
    );
  }

  if (type === 'failure') {
    return (
      <div className="simulation-banner simulation-failure">
        <div className="banner-icon">
          <AlertTriangle size={20} />
        </div>
        <div className="banner-content">
          <div className="banner-title">⚠ Simulation Failed</div>
          <div className="banner-description">
            {failureCount} transaction{failureCount !== 1 ? 's' : ''} failed simulation. {failureCount === 1 ? 'This transaction would fail' : 'These transactions would fail'} on-chain. Review the error{failureCount !== 1 ? 's' : ''} below for details.
          </div>
        </div>
      </div>
    );
  }

  // type === 'disabled'
  return (
    <div className="simulation-banner simulation-disabled">
      <div className="banner-icon">
        <AlertTriangle size={20} />
      </div>
      <div className="banner-content">
        <div className="banner-title">Transaction simulation is disabled</div>
        <div className="banner-description">
          Transactions will be sent directly to your wallet for signing without pre-execution simulation.
        </div>
      </div>
    </div>
  );
};

export default SimulationBanner;

