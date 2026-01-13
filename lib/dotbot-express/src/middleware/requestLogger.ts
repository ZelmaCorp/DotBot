/**
 * Request logging middleware
 * Logs incoming requests for debugging and monitoring
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Simple request logger middleware
 * Logs method, path, and response time
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };

    if (logLevel === 'error') {
      console.error('[Request]', logData);
    } else {
      console.log('[Request]', logData);
    }
  });

  next();
}
