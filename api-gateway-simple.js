const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// Service URLs from environment variables
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'https://fence-auth-service-453424326027.us-central1.run.app';
const PRICING_SERVICE_URL = process.env.PRICING_SERVICE_URL || 'https://fence-pricing-service-453424326027.us-central1.run.app';
const SOCIAL_SERVICE_URL = process.env.SOCIAL_MARKETING_SERVICE_URL || 'https://fence-social-marketing-service-453424326027.us-central1.run.app';

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      auth: AUTH_SERVICE_URL,
      pricing: PRICING_SERVICE_URL,
      social: SOCIAL_SERVICE_URL
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    platform: 'Fence Platform Microservices',
    version: '2.0.0',
    services: ['auth', 'pricing', 'social-marketing'],
    documentation: {
      health: '/health',
      auth: '/api/auth/*',
      pricing: '/api/pricing/*',
      social: '/api/social/*'
    },
    demo_accounts: [
      { email: 'admin@texasfencepro.com', password: 'DemoPass123!', tier: 'Professional' },
      { email: 'admin@austinfence.com', password: 'DemoPass123!', tier: 'Essential' }
    ],
    facebook_oauth: `${AUTH_SERVICE_URL}/auth/facebook`
  });
});

// Proxy auth requests
app.all('/api/auth/*', async (req, res) => {
  try {
    const path = req.path.replace('/api/auth', '');
    const response = await axios({
      method: req.method,
      url: `${AUTH_SERVICE_URL}${path}`,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Auth service error:', error.message);
    res.status(error.response?.status || 503).json({ 
      error: 'Auth service unavailable',
      details: error.message 
    });
  }
});

// Proxy pricing requests
app.all('/api/pricing/*', async (req, res) => {
  try {
    const path = req.path.replace('/api/pricing', '');
    const response = await axios({
      method: req.method,
      url: `${PRICING_SERVICE_URL}${path}`,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Pricing service error:', error.message);
    res.status(error.response?.status || 503).json({ 
      error: 'Pricing service unavailable',
      details: error.message 
    });
  }
});

// Proxy social marketing requests
app.all('/api/social/*', async (req, res) => {
  try {
    const path = req.path.replace('/api/social', '');
    const response = await axios({
      method: req.method,
      url: `${SOCIAL_SERVICE_URL}${path}`,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Social service error:', error.message);
    res.status(error.response?.status || 503).json({ 
      error: 'Social marketing service unavailable',
      details: error.message 
    });
  }
});

// Service discovery
app.get('/api/services', (req, res) => {
  res.json({
    auth: AUTH_SERVICE_URL,
    pricing: PRICING_SERVICE_URL,
    social: SOCIAL_SERVICE_URL
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method,
    available_routes: ['/health', '/api/auth/*', '/api/pricing/*', '/api/social/*']
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Gateway error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    service: 'api-gateway'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log('Service URLs:');
  console.log('  Auth:', AUTH_SERVICE_URL);
  console.log('  Pricing:', PRICING_SERVICE_URL);
  console.log('  Social:', SOCIAL_SERVICE_URL);
});