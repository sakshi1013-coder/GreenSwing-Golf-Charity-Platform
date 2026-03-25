/**
 * GreenSwing - Express Server Entry Point
 * RESTful API with Supabase + Stripe integration
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { isSupabaseConfigured } = require('./config/db');
const { isStripeConfigured } = require('./config/stripe');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));

// Stripe webhook needs raw body, so mount BEFORE json middleware
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));

// Parse JSON for all other routes
app.use(express.json({ limit: '10mb' })); // 10mb for base64 file uploads
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log(`${req.method} ${req.path}`);
    }
    next();
  });
}

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/scores', require('./routes/scores'));
app.use('/api/draws', require('./routes/draws'));
app.use('/api/charities', require('./routes/charities'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/winners', require('./routes/winners'));
app.use('/api/admin', require('./routes/admin'));

// Health check with integration status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'GreenSwing API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    integrations: {
      supabase: isSupabaseConfigured() ? 'connected' : 'demo mode (in-memory)',
      stripe: isStripeConfigured() ? 'connected' : 'demo mode (no payments)',
    },
    endpoints: {
      auth: '/api/auth',
      scores: '/api/scores',
      draws: '/api/draws',
      charities: '/api/charities',
      subscriptions: '/api/subscriptions',
      winners: '/api/winners',
      admin: '/api/admin (requires admin role)'
    }
  });
});

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack || err.message);
  res.status(err.status || 500).json({
    error: true,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('🏌️  ════════════════════════════════════════');
  console.log(`🏌️  GreenSwing API running on port ${PORT}`);
  console.log('🏌️  ════════════════════════════════════════');
  console.log(`📡 Health: http://localhost:${PORT}/api/health`);
  console.log(`🗄️  Supabase: ${isSupabaseConfigured() ? '✅ Connected' : '⚠️  Demo mode (in-memory)'}`);
  console.log(`💳 Stripe:   ${isStripeConfigured() ? '✅ Connected' : '⚠️  Demo mode (no payments)'}`);
  console.log('');
});

module.exports = app;
