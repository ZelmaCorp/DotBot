/**
 * RPC Manager
 * 
 * Manages multiple RPC endpoints with automatic failover, health tracking,
 * and intelligent endpoint selection.
 * 
 * Execution sessions lock an API instance to prevent metadata mismatches.
 * Once an extrinsic lifecycle starts, the ApiPromise must be immutable.
 * 
 * Health checks are both EVENT-DRIVEN and PERIODIC:
 * - Health is checked when connecting to an endpoint (event-driven)
 * - Periodic background polling keeps health data up-to-date (every 30 minutes by default, skipped when already connected)
 * - Endpoints marked healthy/unhealthy based on connection success/failure
 * - Health data is persisted to localStorage for cross-session persistence
 * 
 * CRITICAL DESIGN:
 * - getReadApi(): For read operations, can failover
 * - createExecutionSession(): For transactions, locks API instance (no failover)
 */

// Must run before @polkadot/api loads so its logger uses our patched console (suppress API-WS disconnect noise)
import '../polkadotConsolePatch';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { createSubsystemLogger, Subsystem } from '../services/logger';
import { ExecutionSession } from './ExecutionSession';
import { HealthTracker } from './healthTracker';
import type { RpcManagerConfig, EndpointHealth } from './types';

/**
 * RPC Manager for handling multiple endpoints with automatic failover
 */
export class RpcManager {
  private endpoints: string[];
  private healthMap: Map<string, EndpointHealth>;
  private healthTracker: HealthTracker;
  private currentEndpoint: string | null = null;
  private currentReadApi: ApiPromise | null = null;
  private connectionTimeout: number;
  private activeSessions: Set<ExecutionSession> = new Set();
  private rpcLogger = createSubsystemLogger(Subsystem.RPC);

  constructor(config: RpcManagerConfig) {
    this.endpoints = config.endpoints;
    this.connectionTimeout = config.connectionTimeout || 10000; // 10 seconds
    const failoverTimeout = config.failoverTimeout || 5 * 60 * 1000; // 5 minutes
    const healthDataMaxAge = config.healthDataMaxAge || 24 * 60 * 60 * 1000; // 24 hours
    const healthCheckInterval = config.healthCheckInterval || 30 * 60 * 1000; // 30 minutes

    // Initialize health map
    this.healthMap = new Map();
    
    // Initialize health tracker
    this.healthTracker = new HealthTracker(
      this.healthMap,
      this.endpoints,
      config.storageKey,
      healthDataMaxAge,
      failoverTimeout,
      healthCheckInterval
    );
    
    // Try to load persisted health data
    if (config.storageKey) {
      this.healthTracker.loadHealthData();
    }
    
    // If no valid persisted data, initialize with defaults
    if (this.healthMap.size === 0) {
      this.endpoints.forEach(endpoint => {
        this.healthMap.set(endpoint, {
          endpoint,
          healthy: true,
          lastChecked: 0,
          failureCount: 0
        });
      });
    }
    
    // Start periodic health monitoring if enabled (default: true)
    if (config.enablePeriodicHealthChecks !== false) {
      this.healthTracker.startHealthMonitoring(() => this.performHealthCheck());
    }
  }
  
  /**
   * Normalize various error types to a consistent Error object with message
   * 
   * Handles Error objects, strings, and unknown types consistently
   */
  private normalizeError(error: Error | string | unknown): { message: string; error: Error } {
    if (error instanceof Error) {
      return {
        message: error.message || 'Unknown error',
        error
      };
    }
    if (typeof error === 'string') {
      return {
        message: error,
        error: new Error(error)
      };
    }
    const message = 'Connection failed (unknown error type)';
    return {
      message,
      error: new Error(message)
    };
  }

  /**
   * Attempt to connect to an endpoint.
   *
   * Does NOT wait for provider 'connected' — Polkadot nodes send nothing until we send a JSON-RPC
   * request. We start ApiPromise.create(provider) immediately so the API sends the first request
   * (metadata etc.) and we wait for that response; this avoids false "connection timeout".
   */
  private async tryConnect(endpoint: string): Promise<ApiPromise> {
    const startTime = Date.now();
    const API_INIT_TIMEOUT_MS = 12000; // 12 seconds - faster failure for slow testnet endpoints
    const DISCONNECT_GRACE_PERIOD_MS = 2000; // 2 seconds grace period for normal closures
    const MAX_TOTAL_TIMEOUT_MS = Math.max(this.connectionTimeout + API_INIT_TIMEOUT_MS + 5000, 20000);

    return new Promise<ApiPromise>((resolve, reject) => {
      const provider = new WsProvider(endpoint);
      let apiInitTimeoutHandle: NodeJS.Timeout | null = null;
      let disconnectGraceTimer: NodeJS.Timeout | null = null;
      let maxTimeoutHandle: NodeJS.Timeout | null = null;
      let isResolved = false;
      let apiInstance: ApiPromise | null = null;

      const safeDisconnect = () => {
        try {
          if (provider && typeof provider.disconnect === 'function') {
            provider.disconnect();
          }
        } catch {
          // Ignore disconnect errors
        }
      };

      const cleanup = () => {
        if (isResolved) return;
        isResolved = true;
        if (maxTimeoutHandle) {
          clearTimeout(maxTimeoutHandle);
          maxTimeoutHandle = null;
        }
        if (apiInitTimeoutHandle) {
          clearTimeout(apiInitTimeoutHandle);
          apiInitTimeoutHandle = null;
        }
        if (disconnectGraceTimer) {
          clearTimeout(disconnectGraceTimer);
          disconnectGraceTimer = null;
        }
        safeDisconnect();
      };

      const errorHandler = (error: Error | string | unknown) => {
        if (isResolved) return;
        cleanup();
        const { message, error: errorObj } = this.normalizeError(error);
        this.rpcLogger.error({ endpoint, error: message }, `Provider error - triggering failover`);
        reject(errorObj);
      };

      const disconnectedHandler = () => {
        if (isResolved) return;
        if (apiInstance) return;
        if (disconnectGraceTimer) return;
        disconnectGraceTimer = setTimeout(() => {
          if (!isResolved && !apiInstance) {
            cleanup();
            const err = new Error(`Connection lost during initialization - endpoint disconnected. The system will try the next endpoint.`);
            this.rpcLogger.error({ endpoint }, `Disconnected during API initialization - forcing failover`);
            reject(err);
          }
        }, DISCONNECT_GRACE_PERIOD_MS);
      };

      maxTimeoutHandle = setTimeout(() => {
        if (!isResolved) {
          cleanup();
          reject(new Error(`Maximum timeout (${MAX_TOTAL_TIMEOUT_MS}ms) exceeded for endpoint. The system will try the next endpoint.`));
          this.rpcLogger.error({ endpoint }, `Maximum timeout exceeded - forcing failover`);
        }
      }, MAX_TOTAL_TIMEOUT_MS);

      let apiPromise: Promise<ApiPromise>;
      try {
        apiPromise = ApiPromise.create({ provider });
      } catch (syncError) {
        cleanup();
        const { message: errorMessage } = this.normalizeError(syncError);
        reject(new Error(`Synchronous error during API creation: ${errorMessage}. The system will try the next endpoint.`));
        this.rpcLogger.error({ endpoint }, `Synchronous error during API creation - forcing failover`);
        return;
      }

      const timeoutPromise = new Promise<never>((_, timeoutReject) => {
        apiInitTimeoutHandle = setTimeout(() => {
          if (!isResolved) {
            cleanup();
            timeoutReject(new Error(`API initialization timeout (${API_INIT_TIMEOUT_MS}ms) - endpoint may be slow or unresponsive. The system will try the next endpoint.`));
          }
        }, API_INIT_TIMEOUT_MS);
      });

      provider.on('error', errorHandler);
      provider.on('disconnected', disconnectedHandler);

      Promise.race([apiPromise, timeoutPromise])
        .then((api) => {
          if (isResolved) return;
          // ApiPromise.create() resolved => provider responded to RPC; no need to gate on provider.isConnected
          apiInstance = api;
          isResolved = true;
          if (maxTimeoutHandle) {
            clearTimeout(maxTimeoutHandle);
            maxTimeoutHandle = null;
          }
          if (apiInitTimeoutHandle) {
            clearTimeout(apiInitTimeoutHandle);
            apiInitTimeoutHandle = null;
          }
          if (disconnectGraceTimer) {
            clearTimeout(disconnectGraceTimer);
            disconnectGraceTimer = null;
          }
          const responseTime = Date.now() - startTime;
          this.healthTracker.markEndpointHealthy(endpoint, responseTime);
          resolve(api);
        })
        .catch((error) => {
          if (isResolved) return;
          const { message: errorMessage } = this.normalizeError(error);
          const isFatalError =
            errorMessage.includes('FATAL') ||
            errorMessage.includes('Unable to initialize the API') ||
            errorMessage.toLowerCase().includes('fatal') ||
            errorMessage.toLowerCase().includes('unable to initialize');
          const isDisconnectionError =
            errorMessage.includes('disconnected') ||
            errorMessage.includes('Normal Closure') ||
            errorMessage.includes('1000') ||
            errorMessage.includes('WebSocket is not connected') ||
            !provider.isConnected;
          cleanup();
          const finalError =
            isFatalError || isDisconnectionError
              ? new Error(`API initialization failed: ${errorMessage}. The system will try the next endpoint.`)
              : error instanceof Error ? error : new Error(errorMessage);
          this.rpcLogger.error({ endpoint, error: errorMessage }, `Failed to initialize API - forcing failover`);
          reject(finalError);
        });
    });
  }

  /**
   * Clear cached read API if it's the given instance (so next getReadApi() will try endpoints again / failover).
   * Called when the read API disconnects or errors so we don't keep returning a dead connection.
   */
  private clearReadApiIf(api: ApiPromise): void {
    if (this.currentReadApi === api) {
      this.currentReadApi = null;
      this.currentEndpoint = null;
      this.rpcLogger.debug({}, 'Read API disconnected or errored - cleared cache for failover on next getReadApi()');
    }
  }

  /**
   * Get API for READ operations (can failover)
   * 
   * This is for queries, balance checks, etc. that don't create transactions.
   * If the current endpoint fails, it will automatically try another.
   */
  async getReadApi(): Promise<ApiPromise> {
    // If we have a current read API and it's still connected, reuse it
    if (this.currentReadApi && this.currentReadApi.isConnected) {
      return this.currentReadApi;
    }
    
    // Otherwise, connect to best available endpoint
    const orderedEndpoints = this.healthTracker.getOrderedEndpoints();
    this.rpcLogger.info({ 
      totalEndpoints: this.endpoints.length,
      availableEndpoints: orderedEndpoints.length
    }, `Attempting to connect to RPC endpoints (${orderedEndpoints.length} available out of ${this.endpoints.length} total)`);

    if (orderedEndpoints.length === 0) {
      this.rpcLogger.warn({}, 'All endpoints marked as failed, resetting health for one final attempt');
      this.endpoints.forEach(endpoint => {
        const health = this.healthMap.get(endpoint);
        if (health) {
          health.lastFailure = undefined;
          this.healthMap.set(endpoint, health);
        }
      });
      
      // Try again with reset endpoints
      const retryEndpoints = this.healthTracker.getOrderedEndpoints();
      if (retryEndpoints.length === 0) {
        // Still no endpoints - give up
        throw new Error('No RPC endpoints available to connect to');
      }
      
      // Try each endpoint one more time
      let lastError: Error | null = null;
      for (const endpoint of retryEndpoints) {
        try {
          const api = await this.tryConnect(endpoint);
          this.currentEndpoint = endpoint;
          this.currentReadApi = api;
          api.on('disconnected', () => this.clearReadApiIf(api));
          api.on('error', () => this.clearReadApiIf(api));
          return api;
        } catch (error) {
          const { error: errorObj } = this.normalizeError(error);
          lastError = errorObj;
        }
      }
      const lastErrorMessage = lastError?.message || 'Unknown error';
      throw new Error(
        `Failed to connect to any RPC endpoint after retry. Last error: ${lastErrorMessage}`
      );
    }

    let lastError: Error | null = null;

    for (let i = 0; i < orderedEndpoints.length; i++) {
      const endpoint = orderedEndpoints[i];
      this.rpcLogger.debug({ 
        endpoint,
        attempt: i + 1,
        total: orderedEndpoints.length
      }, `Trying endpoint ${i + 1}/${orderedEndpoints.length}: ${endpoint}`);
      
      let api: ApiPromise | null = null;
      for (let retry = 0; retry < 2 && !api; retry++) {
        try {
          api = await this.tryConnect(endpoint);
        } catch (error) {
          const err = error as Error;
          const msg = err?.message ?? String(error);
          const isWsNotConnected =
            msg.includes('WebSocket is not connected') ||
            msg.includes('Unable to initialize the API');
          if (retry === 0 && isWsNotConnected) {
            this.rpcLogger.debug({ endpoint }, 'WebSocket not connected on first attempt - retrying once');
            continue;
          }
          lastError = err;
          break;
        }
      }
      if (api) {
        const connectedApi = api;
        this.currentEndpoint = endpoint;
        this.currentReadApi = connectedApi;
        connectedApi.on('disconnected', () => this.clearReadApiIf(connectedApi));
        connectedApi.on('error', () => this.clearReadApiIf(connectedApi));
        this.rpcLogger.info({ endpoint }, `Successfully connected to endpoint: ${endpoint}`);
        return connectedApi;
      }
      this.rpcLogger.warn({ 
        endpoint,
        error: lastError?.message ?? 'Unknown',
        attempt: i + 1,
        total: orderedEndpoints.length
      }, `Failed to connect to endpoint ${i + 1}/${orderedEndpoints.length}, trying next endpoint`);
      this.healthTracker.markEndpointFailed(endpoint);
    }

    // All endpoints failed
    throw new Error(
      `Failed to connect to any RPC endpoint. Last error: ${lastError?.message || 'Unknown'}`
    );
  }

  /**
   * Create an EXECUTION SESSION - locks an API instance for transaction lifecycle
   * 
   * CRITICAL: Once created, the API instance is immutable. If the endpoint dies,
   * the session fails and the user must retry. No silent switching.
   * 
   * AUTOMATIC FAILOVER: This method automatically tries all available endpoints
   * in order until one succeeds. If an endpoint fails with any error (including
   * "FATAL: Unable to initialize the API" or normal closures), it will automatically
   * try the next endpoint. Components using this method do NOT need to implement
   * their own failover logic - it's handled here.
   * 
   * Use this for:
   * - Creating extrinsics
   * - Signing transactions
   * - Broadcasting transactions
   * 
   * @returns ExecutionSession with locked API instance
   * @throws Error if ALL endpoints fail (after trying each one)
   */
  async createExecutionSession(): Promise<ExecutionSession> {
    const orderedEndpoints = this.healthTracker.getOrderedEndpoints();
    
    this.rpcLogger.info({ 
      totalEndpoints: this.endpoints.length,
      availableEndpoints: orderedEndpoints.length
    }, `Creating execution session (${orderedEndpoints.length} available endpoints)`);

    if (orderedEndpoints.length === 0) {
      this.rpcLogger.warn({}, 'All endpoints marked as failed, resetting health for execution session');
      this.endpoints.forEach(endpoint => {
        const health = this.healthMap.get(endpoint);
        if (health) {
          health.lastFailure = undefined;
          this.healthMap.set(endpoint, health);
        }
      });
      return this.createExecutionSession();
    }

    let lastError: Error | null = null;

    for (let i = 0; i < orderedEndpoints.length; i++) {
      const endpoint = orderedEndpoints[i];
      this.rpcLogger.debug({ 
        endpoint,
        attempt: i + 1,
        total: orderedEndpoints.length
      }, `Trying endpoint ${i + 1}/${orderedEndpoints.length} for execution session: ${endpoint}`);
      
      let api: ApiPromise | null = null;
      for (let retry = 0; retry < 2 && !api; retry++) {
        try {
          api = await this.tryConnect(endpoint);
        } catch (error) {
          const { message } = this.normalizeError(error);
          const isWsNotConnected =
            message.includes('WebSocket is not connected') ||
            message.includes('Unable to initialize the API');
          if (retry === 0 && isWsNotConnected) {
            this.rpcLogger.debug({ endpoint }, 'WebSocket not connected on first attempt - retrying once');
            continue;
          }
          lastError = error instanceof Error ? error : new Error(message);
          break;
        }
      }
      if (api) {
        const session = new ExecutionSession(api, endpoint);
        this.activeSessions.add(session);
        this.rpcLogger.info({ endpoint }, `Execution session created with endpoint: ${endpoint}`);
        api.on('disconnected', () => {
          session.markInactive();
          this.activeSessions.delete(session);
        });
        return session;
      }
      const { message, error: errorObj } = this.normalizeError(lastError);
      lastError = errorObj;
      this.rpcLogger.warn({ 
        endpoint,
        error: message,
        attempt: i + 1,
        total: orderedEndpoints.length
      }, `Failed to connect to endpoint ${i + 1}/${orderedEndpoints.length}${i < orderedEndpoints.length - 1 ? ', trying next' : ''}`);
      this.healthTracker.markEndpointFailed(endpoint);
    }

    // All endpoints failed - log and throw final error
    const lastErrorMessage = lastError?.message || 'Unknown error';
    this.rpcLogger.error({ 
      totalEndpoints: orderedEndpoints.length,
      lastError: lastErrorMessage
    }, `Failed to create execution session - all ${orderedEndpoints.length} endpoints failed`);
    
    throw new Error(
      `Failed to create execution session. Tried all ${orderedEndpoints.length} available endpoints, but all failed. ` +
      `Last error: ${lastErrorMessage}. ` +
      `Please check your network connection or try again later.`
    );
  }

  /**
   * Legacy method - use getReadApi() or createExecutionSession() instead
   * @deprecated Use getReadApi() for reads or createExecutionSession() for transactions
   */
  async connect(): Promise<ApiPromise> {
    this.rpcLogger.warn({}, 'RpcManager.connect() is deprecated. Use getReadApi() or createExecutionSession()');
    return this.getReadApi();
  }

  /**
   * Get the current active endpoint (for read API)
   */
  getCurrentEndpoint(): string | null {
    return this.currentEndpoint;
  }

  /**
   * Get health status of all endpoints
   */
  getHealthStatus(): EndpointHealth[] {
    return this.healthTracker.getHealthStatus();
  }

  /**
   * Get number of active execution sessions
   */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Perform a health check on all endpoints.
   * Uses the same flow as tryConnect: open WebSocket, send RPC (via ApiPromise), wait for response.
   * Polkadot nodes send nothing until we send a request, so we must send then wait (no "connected"-only check).
   * Skips when we already have a healthy read API (reduces churn).
   */
  async performHealthCheck(): Promise<void> {
    if (this.currentReadApi?.isConnected) {
      this.rpcLogger.debug({ endpoint: this.currentEndpoint }, 'Skipping health check: read API already connected');
      return;
    }

    const endpointsToCheck = this.healthTracker.getOrderedEndpoints().slice(0, 5);
    const HEALTH_CHECK_TIMEOUT_MS = 10000;

    await Promise.all(
      endpointsToCheck.map(async (endpoint) => {
        const start = Date.now();
        try {
          const api = await Promise.race([
            this.tryConnect(endpoint),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT_MS)
            ),
          ]);
          const responseTime = Date.now() - start;
          await api.disconnect();
          this.healthTracker.markEndpointHealthy(endpoint, responseTime);
        } catch {
          this.healthTracker.markEndpointFailed(endpoint);
        }
      })
    );

    const healthyCount = Array.from(this.healthMap.values()).filter((h) => h.healthy).length;
    this.rpcLogger.info(
      { healthyCount, totalEndpoints: this.endpoints.length, checked: endpointsToCheck.length },
      `Health check complete: ${healthyCount}/${this.endpoints.length} endpoints healthy (checked ${endpointsToCheck.length})`
    );
  }

  /**
   * Cleanup: disconnect all APIs and stop monitoring
   */
  async destroy(): Promise<void> {
    this.healthTracker.stopHealthMonitoring();
    
    // Disconnect read API
    if (this.currentReadApi) {
      await this.currentReadApi.disconnect();
      this.currentReadApi = null;
    }
    
    // Mark all sessions as inactive (but don't disconnect - let them handle it)
    this.activeSessions.forEach(session => {
      session.markInactive();
    });
    this.activeSessions.clear();
  }
}
