/**
 * middleware/errorHandler.js
 *
 * Centralised Express error handler.
 * Ensures stack traces are only exposed in development.
 */

'use strict';

function errorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[Error] ${status} – ${message}`);
    if (process.env.NODE_ENV === 'development') console.error(err.stack);
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = { errorHandler };
