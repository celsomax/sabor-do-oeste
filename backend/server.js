/**
 * server.js – Sabor do Oeste Backend
 *
 * Starts an Express HTTP server that provides:
 *   POST /api/ai/analyze              – stock + profit analysis
 *   POST /api/ai/purchase-suggestions – 30-day purchase forecast
 *   POST /api/ai/chat                 – free-form question to AI
 *   GET  /api/health                  – health check
 *
 * AI calls are proxied through this server so that API keys are
 * NEVER exposed to the browser.
 */

'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const aiRouter    = require('./routes/ai');
const stockRouter = require('./routes/stock');
const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3001;

// -----------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. curl, same-origin)
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '256kb' }));

// Basic request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// -----------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiProvider: process.env.AI_PROVIDER || 'openai',
    firebaseConfigured: !!process.env.FIREBASE_PROJECT_ID
  });
});

app.use('/api/ai',    aiRouter);
app.use('/api/stock', stockRouter);

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use(errorHandler);

// -----------------------------------------------------------------------
// Start
// -----------------------------------------------------------------------
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🥩 Sabor do Oeste Backend running at http://localhost:${PORT}`);
    console.log(`   AI provider: ${process.env.AI_PROVIDER || 'openai'} (fallback: ${process.env.AI_FALLBACK_PROVIDER || 'gemini'})`);
    console.log(`   Firebase: ${process.env.FIREBASE_PROJECT_ID ? process.env.FIREBASE_PROJECT_ID : 'NOT configured'}\n`);
  });
}

module.exports = app; // for tests
