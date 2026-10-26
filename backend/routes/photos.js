const express = require('express');
const multer = require('multer');
const db = require('../services/db');
const telegramService = require('../services/telegram');

const router = express.Router();

// Supported MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit

// Configure Multer in-memory storage (never writes sensitive photos to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error(`Unsupported image format (${file.mimetype}). Only JPEG, PNG, and WebP are accepted.`);
      err.statusCode = 400;
      cb(err, false);
    }
  }
});

// Helper to validate session ID format (prevents injection/traversal attacks)
function isValidSessionId(id) {
  return typeof id === 'string' && /^[a-f0-9]{16,64}$/i.test(id);
}

/**
 * POST /api/sessions/:id/photo
 * Receive an explicitly submitted photo from a consented visitor and deliver to Telegram.
 */
router.post('/sessions/:id/photo', upload.single('photo'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // 0. Validate session ID format
    if (!isValidSessionId(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format.'
      });
    }

    // 1. Validate file presence
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        error: 'Missing photo file. Please provide an image in the "photo" form field.'
      });
    }

    // 2. Validate session existence
    const session = db.getSessionById(id);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found. The link may be invalid or expired.'
      });
    }

    // 3. Verify session is not revoked
    if (session.status === 'revoked') {
      return res.status(403).json({
        success: false,
        error: 'This demonstration session has been revoked by the administrator.'
      });
    }

    // 4. Verify session is not already completed
    if (session.status === 'submitted') {
      return res.status(409).json({
        success: false,
        error: 'A photo has already been submitted for this demonstration session. Sessions are single-use.'
      });
    }

    // 5. Verify session has not expired
    const now = new Date();
    if (now > new Date(session.expiresAt)) {
      return res.status(410).json({
        success: false,
        error: 'This demonstration session has expired. Please request a new link.'
      });
    }

    // 6. Transmit to Telegram Bot API
    const submissionTimestamp = now.toISOString();
    const filename = `session-${id.substring(0, 8)}.jpg`;

    await telegramService.sendPhoto({
      photoBuffer: req.file.buffer,
      filename,
      mimeType: req.file.mimetype,
      sessionId: session.id,
      label: session.label,
      timestamp: submissionTimestamp
    });

    // 7. Update session status in SQLite only AFTER Telegram delivery is confirmed
    db.markSessionSubmitted(session.id, submissionTimestamp);

    // 8. Return structured success
    return res.status(200).json({
      success: true,
      message: 'Photo explicitly submitted and delivered to administrator Telegram chat.',
      session: {
        id: session.id,
        status: 'submitted',
        submittedAt: submissionTimestamp
      }
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
