require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const db = require('./services/db');
const sessionsRouter = require('./routes/sessions');
const photosRouter = require('./routes/photos');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === 'production';

// 1. HTTP Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// 2. Dynamic CORS Configuration
const allowedOrigins = (process.env.FRONTEND_ORIGIN || '*')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. curl, tests, mobile native)
    if (!origin) return callback(null, true);

    // If wildcard configured
    if (allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // Check explicit whitelist
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In local development, permit common local dev ports automatically
    if (!isProduction) {
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
    }

    const corsErr = new Error(`CORS blocked: Origin ${origin} is not allowed by FRONTEND_ORIGIN policy.`);
    corsErr.statusCode = 403;
    return callback(corsErr);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key', 'Accept'],
  credentials: true,
  maxAge: 86400 // Cache preflight for 24 hours
};

app.use(cors(corsOptions));

// 3. Rate Limiting
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});

const photoSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 photo submissions per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Submission rate limit reached. Please wait before attempting further photo uploads.'
  }
});

app.use('/api/', globalApiLimiter);
app.use('/api/sessions/:id/photo', photoSubmissionLimiter);

// 4. Request Body Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 5. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Camera Security Demonstration API',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: 'connected'
  });
});

// 6. Mount API Routes
app.use('/api/sessions', sessionsRouter);
app.use('/api', photosRouter);

// 7. 404 & Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize persistent database
db.initDatabase();

// Start server if executed directly
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🛡️  Camera Security Demo Backend Running`);
    console.log(`   Port:            ${PORT}`);
    console.log(`   Environment:     ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Database:        ${process.env.DATABASE_PATH || 'data/sessions.db'}`);
    console.log(`   Allowed Origins: ${allowedOrigins.join(', ')}`);
    console.log(`====================================================`);
  });

  // Graceful shutdown handling
  const shutdown = (signal) => {
    console.log(`\nReceived ${signal}. Gracefully shutting down...`);
    server.close(() => {
      db.closeDatabase();
      console.log('Database connection closed. Process exited.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = app;
