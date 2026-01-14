/**
 * Simulation Configuration
 * 
 * Domain-specific convenience functions for simulation settings.
 * This keeps settingsManager.ts clean and scalable.
 */

import { settingsManager, type SimulationConfig } from '../../services/settingsManager';

/**
 * Get current simulation configuration
 */
export function getSimulationConfig(): SimulationConfig {
  return settingsManager.getSimulationConfig();
}

/**
 * Update simulation configuration
 */
export function updateSimulationConfig(updates: Partial<SimulationConfig>): void {
  settingsManager.updateSimulationConfig(updates);
}

/**
 * Check if simulation is enabled
 */
export function isSimulationEnabled(): boolean {
  return settingsManager.getSimulationConfig().enabled;
}

/**
 * Enable simulation
 */
export function enableSimulation(): void {
  settingsManager.updateSimulationConfig({ enabled: true });
}

/**
 * Disable simulation
 */
export function disableSimulation(): void {
  settingsManager.updateSimulationConfig({ enabled: false });
}

/**
 * Reset simulation settings to defaults
 */
export function resetSimulationConfig(): void {
  settingsManager.resetSimulation();
}

// Export type
export type { SimulationConfig };

