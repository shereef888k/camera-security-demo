const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// Set test environment variables before requiring server/app
process.env.NODE_ENV = 'test';
process.env.ADMIN_API_KEY = 'test_super_secure_admin_key_987654321';
process.env.DATABASE_PATH = ':memory:';
process.env.FRONTEND_ORIGIN = 'https://demo.example.com,http://localhost:3000';

const app = require('../server');
const db = require('../services/db');

describe('Sessions API Endpoints', () => {
  before(() => {
    db.initDatabase(':memory:');
  });

  after(() => {
    db.closeDatabase();
  });

  test('POST /api/sessions — Fails without Administrator API Key (401)', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ durationMinutes: 30, label: 'Test Session' });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Unauthorized/i);
  });

  test('POST /api/sessions — Fails with invalid Administrator API Key (401)', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('X-Admin-Key', 'wrong_key')
      .send({ durationMinutes: 30, label: 'Test Session' });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Unauthorized/i);
  });

  test('POST /api/sessions — Successfully creates a session with valid Admin Key (201)', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('X-Admin-Key', process.env.ADMIN_API_KEY)
      .send({ durationMinutes: 45, label: 'iPhone Safari Test' });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.session.id);
    assert.strictEqual(res.body.session.label, 'iPhone Safari Test');
    assert.strictEqual(res.body.session.status, 'created');

    const expiresAt = new Date(res.body.session.expiresAt);
    const createdAt = new Date(res.body.session.createdAt);
    const diffMinutes = Math.round((expiresAt - createdAt) / 60000);
    assert.strictEqual(diffMinutes, 45);
  });

  test('GET /api/sessions — Lists sessions for authenticated administrator (200)', async () => {
    const res = await request(app)
      .get('/api/sessions')
      .set('X-Admin-Key', process.env.ADMIN_API_KEY);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.sessions));
    assert.ok(res.body.sessions.length >= 1);
  });

  test('GET /api/sessions/:id — Retrieves public session info without secrets (200)', async () => {
    // 1. Create a session
    const createRes = await request(app)
      .post('/api/sessions')
      .set('X-Admin-Key', process.env.ADMIN_API_KEY)
      .send({ durationMinutes: 15, label: 'Visitor Inspection' });

    const sessionId = createRes.body.session.id;

    // 2. Query as visitor
    const res = await request(app).get(`/api/sessions/${sessionId}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.id, sessionId);
    assert.strictEqual(res.body.status, 'created');
    assert.strictEqual(res.body.label, 'Visitor Inspection');

    // Ensure no server secrets or bot tokens are present in response
    assert.strictEqual(res.body.chatId, undefined);
    assert.strictEqual(res.body.botToken, undefined);
    assert.strictEqual(res.body.adminKey, undefined);
  });

  test('GET /api/sessions/:id — Rejects malformed session IDs (400)', async () => {
    const res = await request(app).get('/api/sessions/invalid-id-!');
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  test('GET /api/sessions/:id — Returns 404 for non-existent session ID', async () => {
    const res = await request(app).get('/api/sessions/0123456789abcdef0123456789abcdef');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  test('POST /api/sessions/:id/opened — Transitions created session to opened (200)', async () => {
    const createRes = await request(app)
      .post('/api/sessions')
      .set('X-Admin-Key', process.env.ADMIN_API_KEY)
      .send({ durationMinutes: 30 });

    const sessionId = createRes.body.session.id;

    const openRes = await request(app).post(`/api/sessions/${sessionId}/opened`);
    assert.strictEqual(openRes.status, 200);
    assert.strictEqual(openRes.body.status, 'opened');

    // Verify status update in subsequent fetch
    const getRes = await request(app).get(`/api/sessions/${sessionId}`);
    assert.strictEqual(getRes.body.status, 'opened');
  });

  test('POST /api/sessions/:id/revoke — Revokes session via admin key (200)', async () => {
    const createRes = await request(app)
      .post('/api/sessions')
      .set('X-Admin-Key', process.env.ADMIN_API_KEY)
      .send({ durationMinutes: 30 });

    const sessionId = createRes.body.session.id;

    const revokeRes = await request(app)
      .post(`/api/sessions/${sessionId}/revoke`)
      .set('X-Admin-Key', process.env.ADMIN_API_KEY);

    assert.strictEqual(revokeRes.status, 200);
    assert.strictEqual(revokeRes.body.success, true);

    const getRes = await request(app).get(`/api/sessions/${sessionId}`);
    assert.strictEqual(getRes.body.status, 'revoked');
  });
});
