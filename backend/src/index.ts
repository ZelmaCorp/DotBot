/**
 * DotBot Backend Server
 * Provides API endpoints to use DotBot
 */

import app from './app';

const PORT = process.env.PORT || 8000;

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log('[Server] DotBot backend server started');
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Server] Port: ${PORT}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
  console.log(`[Server] Chat endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`[Server] DotBot endpoint: http://localhost:${PORT}/api/dotbot/chat`);
});
