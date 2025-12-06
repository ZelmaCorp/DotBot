/**
 * Re-export from lib for backward compatibility
 * 
 * This file exists to maintain backward compatibility with existing imports.
 * All new code should import directly from '../lib' or '../lib/config/logger'.
 */
export { createSubsystemLogger, logError, logger } from '../lib/config/logger';
export type { Subsystem, ErrorType } from '../lib/types/logging'; 