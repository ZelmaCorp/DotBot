/**
 * Transaction Simulation Service
 * 
 * Exports simulation functionality
 * 
 * NOTE: The simulation service uses a client-server architecture.
 * - Client (chopsticksClient.ts): Connects to backend Chopsticks server
 * - Server: Runs in @dotbot/express (simulationRoutes.ts)
 * 
 * All Chopsticks setup happens on the server. This package only provides
 * the client interface.
 */

export * from './chopsticks';
export * from './chopsticksIgnorePolicy';
export * from './database';
export * from './diagnostics';
export * from './sequentialSimulation';

// NOTE: Simulation server routes are in @dotbot/express
// Import simulationRouter from @dotbot/express to mount on your Express app
