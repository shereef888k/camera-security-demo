const multer = require('multer');

/**
 * Centralized error handler middleware.
 * Ensures consistent structured JSON responses and prevents credential or stack leaks.
 */
function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle Multer upload errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'Uploaded photo exceeds maximum allowable file size (10 MB limit).'
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`
    });
  }

  // Handle invalid JSON bodies
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload.'
    });
  }

  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Sanitize unhandled internal server errors (500) in production to prevent stack or path leaks.
  // Intentional operational errors (4xx, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout)
  // carry safe, sanitized error descriptions designed for clients.
  const isInternalError = statusCode === 500;
  const clientMessage = (isProduction && isInternalError)
    ? 'An internal server error occurred.'
    : (err.message || 'An internal server error occurred.');

  // Send clean JSON error response
  return res.status(statusCode).json({
    success: false,
    error: clientMessage,
    ...(isProduction ? {} : { code: err.code })
  });
}

/**
 * 404 Handler for undefined routes
 */
function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.path}`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
