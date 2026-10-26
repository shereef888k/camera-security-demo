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

  // Log error internally (without credentials)
  if (statusCode >= 500) {
    console.error(`[Error] ${req.method} ${req.path} - Status ${statusCode}:`, err.message);
  }

  // Send clean JSON error response
  return res.status(statusCode).json({
    success: false,
    error: err.message || 'An internal server error occurred.',
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
