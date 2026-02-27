import express, { Request, Response, NextFunction } from 'express';

/**
 * Backend shutdown notice utilities
 *
 * Central place to keep the "going down" flag, the header middleware,
 * and the internal shutdown-notice endpoint used by the deploy workflow.
 */

let GOING_DOWN = false;

export function markBackendGoingDown(): void {
  GOING_DOWN = true;
}

export function isBackendGoingDown(): boolean {
  return GOING_DOWN;
}

/**
 * Middleware: attach graceful-deploy header when backend is going down.
 *
 * This does not change response bodies, only adds a header that the frontend
 * can watch for and display a “please reload” warning.
 */
export function shutdownHeaderMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (GOING_DOWN) {
    res.setHeader('X-Backend-Going-Down', 'true');
  }
  next();
}

/**
 * Internal router: mark backend as "going down" for graceful deploys.
 *
 * Mounted under /api/internal by the main app. This is called from the
 * deployment script on the server before tearing down old containers.
 *
 * Security model:
 * - Only HTTP clients that know DEPLOY_SHUTDOWN_TOKEN can trigger this.
 * - The production deploy workflow passes the token from GitHub Secrets
 *   and calls this endpoint over localhost on the server.
 */
export const shutdownNoticeRouter = express.Router();

shutdownNoticeRouter.post('/shutdown-notice', (req: Request, res: Response) => {
  const configuredToken = process.env.DEPLOY_SHUTDOWN_TOKEN;

  if (!configuredToken) {
    return res.status(503).json({
      success: false,
      message: 'Shutdown notice endpoint is not configured on this environment.',
    });
  }

  const authHeader = req.header('authorization') || req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;

  if (!token || token !== configuredToken) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: invalid shutdown token.',
    });
  }

  if (!GOING_DOWN) {
    markBackendGoingDown();
  }

  return res.json({
    success: true,
    goingDown: true,
    message: 'Backend marked as going down for graceful deploy.',
  });
});

