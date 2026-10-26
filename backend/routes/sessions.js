const express = require('express');
const crypto = require('crypto');
const db = require('../services/db');
const { requireAdminAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper: Validate and sanitize session ID string
 */
function isValidSessionId(id) {
  return typeof id === 'string' && /^[a-f0-9]{16,64}$/i.test(id);
}

/**
 * POST /api/sessions
 * Create a new demo session (Admin Authorized).
 */
router.post('/', requireAdminAuth, (req, res, next) => {
  try {
    const { label, durationMinutes = 30 } = req.body;

    const parsedDuration = parseInt(durationMinutes, 10);
    if (isNaN(parsedDuration) || parsedDuration < 1 || parsedDuration > 10080) {
      return res.status(400).json({
        success: false,
        error: 'Invalid duration. Must be between 1 minute and 10080 minutes (7 days).'
      });
    }

    const sanitizedLabel = label && typeof label === 'string' ? label.trim().substring(0, 50) : null;

    // Generate unpredictable cryptographically secure 16-byte hex ID
    const sessionId = crypto.randomBytes(16).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + parsedDuration * 60 * 1000).toISOString();

    const session = db.createSession({
      id: sessionId,
      label: sanitizedLabel,
      expiresAt,
      createdAt: now.toISOString()
    });

    return res.status(201).json({
      success: true,
      message: 'Session created successfully.',
      session
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sessions/demo
 * Create an ephemeral public demonstration session (no admin key required).
 * Allows visitors on the video landing page to test the consent demonstration.
 */
router.post('/demo', (req, res, next) => {
  try {
    const { label } = req.body || {};
    const sanitizedLabel = label && typeof label === 'string'
      ? `Web Demo: ${label.trim().substring(0, 40)}`
      : 'Public Web Visitor Demo';

    // 15-minute expiration for ephemeral public demonstration
    const parsedDuration = 15;
    const sessionId = crypto.randomBytes(16).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + parsedDuration * 60 * 1000).toISOString();

    const session = db.createSession({
      id: sessionId,
      label: sanitizedLabel,
      expiresAt,
      createdAt: now.toISOString()
    });

    return res.status(201).json({
      success: true,
      message: 'Public demonstration session created.',
      session
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sessions
 * List all sessions (Admin Authorized).
 */
router.get('/', requireAdminAuth, (req, res, next) => {
  try {
    const sessions = db.listSessions();
    return res.json({
      success: true,
      sessions
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sessions/:id
 * Retrieve limited public session info for visitor page or inspection.
 */
router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidSessionId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format.'
      });
    }

    const session = db.getSessionById(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found.'
      });
    }

    // Check expiration dynamically
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);
    let effectiveStatus = session.status;

    if (effectiveStatus !== 'revoked' && effectiveStatus !== 'submitted' && now > expiresAt) {
      effectiveStatus = 'expired';
    }

    // Return limited public information (never expose internals)
    return res.json({
      success: true,
      id: session.id,
      label: session.label,
      status: effectiveStatus,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sessions/:id/opened
 * Record that a visitor has opened the demonstration link.
 */
router.post('/:id/opened', (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidSessionId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format.'
      });
    }

    const session = db.getSessionById(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found.'
      });
    }

    // Verify session state
    if (session.status === 'revoked') {
      return res.status(403).json({
        success: false,
        error: 'Session has been revoked.'
      });
    }

    if (new Date() > new Date(session.expiresAt)) {
      return res.status(410).json({
        success: false,
        error: 'Session has expired.'
      });
    }

    if (session.status === 'created') {
      db.markSessionOpened(id);
    }

    return res.json({
      success: true,
      status: 'opened'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sessions/:id/revoke
 * Revoke an active demonstration session (Admin Authorized).
 */
router.post('/:id/revoke', requireAdminAuth, (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidSessionId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format.'
      });
    }

    const session = db.getSessionById(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found.'
      });
    }

    db.revokeSession(id);

    return res.json({
      success: true,
      message: `Session #${id.substring(0, 8)} revoked successfully.`
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
