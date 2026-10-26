const path = require('path');
const fs = require('fs');

let dbInstance = null;
let isNodeSqlite = false;

/**
 * Initializes and returns the persistent SQLite database instance.
 * Supports native node:sqlite (Node 22+) as well as better-sqlite3.
 * 
 * @param {string} [customPath] - Optional path to database file (e.g. ':memory:')
 */
function initDatabase(customPath) {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = customPath || process.env.DATABASE_PATH || path.join(__dirname, '../data/sessions.db');

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Detect available SQLite engine
  let DatabaseSync;
  try {
    DatabaseSync = require('node:sqlite').DatabaseSync;
    isNodeSqlite = true;
  } catch (e) {
    try {
      DatabaseSync = require('better-sqlite3');
      isNodeSqlite = false;
    } catch (e2) {
      throw new Error('No SQLite driver available. Ensure Node.js >= 22.5 is used or better-sqlite3 is installed.');
    }
  }

  dbInstance = new DatabaseSync(dbPath);

  // Enable WAL mode for high concurrency
  if (dbPath !== ':memory:') {
    try {
      dbInstance.exec('PRAGMA journal_mode = WAL;');
    } catch (e) {
      // WAL may not be supported on in-memory or certain virtual drives
    }
  }

  // Create schema
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      label TEXT,
      status TEXT NOT NULL DEFAULT 'created',
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      submitted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);
  `);

  return dbInstance;
}

/**
 * Creates a new demonstration session.
 */
function createSession({ id, label = null, expiresAt, createdAt = new Date().toISOString() }) {
  const db = initDatabase();
  const stmt = db.prepare(`
    INSERT INTO sessions (id, label, status, created_at, expires_at)
    VALUES (?, ?, 'created', ?, ?)
  `);

  stmt.run(id, label, createdAt, expiresAt);

  return {
    id,
    label,
    status: 'created',
    createdAt,
    expiresAt,
    submittedAt: null
  };
}

/**
 * Retrieves a session by its unique ID.
 */
function getSessionById(id) {
  const db = initDatabase();
  const stmt = db.prepare(`
    SELECT id, label, status, created_at AS createdAt, expires_at AS expiresAt, submitted_at AS submittedAt
    FROM sessions
    WHERE id = ?
  `);

  const row = stmt.get(id);
  if (!row) return null;

  return row;
}

/**
 * Retrieves all sessions, sorted by creation date descending.
 */
function listSessions() {
  const db = initDatabase();
  const stmt = db.prepare(`
    SELECT id, label, status, created_at AS createdAt, expires_at AS expiresAt, submitted_at AS submittedAt
    FROM sessions
    ORDER BY created_at DESC
  `);

  return stmt.all();
}

/**
 * Marks a session as opened if it is currently in 'created' state.
 */
function markSessionOpened(id) {
  const db = initDatabase();
  const stmt = db.prepare(`
    UPDATE sessions
    SET status = 'opened'
    WHERE id = ? AND status = 'created'
  `);

  const result = stmt.run(id);
  return result && result.changes ? result.changes > 0 : true;
}

/**
 * Marks a session as submitted upon verified delivery.
 */
function markSessionSubmitted(id, submittedAt = new Date().toISOString()) {
  const db = initDatabase();
  const stmt = db.prepare(`
    UPDATE sessions
    SET status = 'submitted', submitted_at = ?
    WHERE id = ?
  `);

  const result = stmt.run(submittedAt, id);
  return result && result.changes ? result.changes > 0 : true;
}

/**
 * Revokes an active session.
 */
function revokeSession(id) {
  const db = initDatabase();
  const stmt = db.prepare(`
    UPDATE sessions
    SET status = 'revoked'
    WHERE id = ?
  `);

  const result = stmt.run(id);
  return result && result.changes ? result.changes > 0 : true;
}

/**
 * Close database connection (used for teardown/tests).
 */
function closeDatabase() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {
      // Ignore
    }
    dbInstance = null;
  }
}

module.exports = {
  initDatabase,
  createSession,
  getSessionById,
  listSessions,
  markSessionOpened,
  markSessionSubmitted,
  revokeSession,
  closeDatabase
};
