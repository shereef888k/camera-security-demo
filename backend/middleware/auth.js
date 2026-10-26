const crypto = require('crypto');

/**
 * Authentication middleware for administrator endpoints.
 * Validates 'X-Admin-Key' or 'Authorization: Bearer <key>' against ADMIN_API_KEY.
 * Uses timing-safe string comparison to protect against timing attacks.
 */
function requireAdminAuth(req, res, next) {
  const configuredKey = process.env.ADMIN_API_KEY;

  if (!configuredKey || configuredKey.trim() === '') {
    const configErr = new Error('Administrator authentication key is not configured on the server.');
    configErr.statusCode = 500;
    return next(configErr);
  }

  // Extract key from header
  let providedKey = req.headers['x-admin-key'];

  if (!providedKey && req.headers['authorization']) {
    const parts = req.headers['authorization'].split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      providedKey = parts[1];
    }
  }

  if (!providedKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing Administrator API Key. Please provide X-Admin-Key header.'
    });
  }

  // Timing-safe constant-length comparison via SHA-256 digest
  const configuredHash = crypto.createHash('sha256').update(configuredKey.trim()).digest();
  const providedHash = crypto.createHash('sha256').update(providedKey.trim()).digest();

  if (!crypto.timingSafeEqual(configuredHash, providedHash)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid Administrator API Key.'
    });
  }

  next();
}

module.exports = {
  requireAdminAuth
};
