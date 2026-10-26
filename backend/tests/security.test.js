const { test, describe } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.ADMIN_API_KEY = 'test_super_secure_admin_key_987654321';
process.env.DATABASE_PATH = ':memory:';
process.env.FRONTEND_ORIGIN = 'https://trusted.github.io,http://localhost:3000';

const app = require('../server');

describe('Security & Infrastructure Tests', () => {
  test('GET /api/health — Returns operational system status and version (200)', async () => {
    const res = await request(app).get('/api/health');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.strictEqual(res.body.database, 'connected');
    assert.ok(typeof res.body.uptimeSeconds === 'number');
    assert.ok(res.body.version);
  });

  test('Security Headers — Helmet sets appropriate protection headers', async () => {
    const res = await request(app).get('/api/health');

    // Helmet default headers
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.ok(res.headers['cross-origin-resource-policy']);
  });

  test('CORS — Allows pre-approved origin in whitelist', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://trusted.github.io');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://trusted.github.io');
  });

  test('CORS — Blocks unapproved third-party origin in production mode', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://malicious-site.com');

    assert.strictEqual(res.status, 403);
    assert.match(res.body.error, /CORS blocked/i);

    process.env.NODE_ENV = prevEnv;
  });

  test('404 Route Handling — Returns structured JSON for unknown routes', async () => {
    const res = await request(app).get('/api/unknown-endpoint');

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Route not found/i);
  });
});
