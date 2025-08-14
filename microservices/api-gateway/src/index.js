const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Service routing configuration
const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://fence-auth-service:3001',
  pricing: process.env.PRICING_SERVICE_URL || 'http://fence-pricing-service:3004',
  crm: process.env.CRM_SERVICE_URL || 'http://fence-crm-service:3002',
  maps: process.env.MAPS_SERVICE_URL || 'http://fence-maps-service:3003',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://fence-analytics-service:3005',
  notifications: process.env.NOTIFICATIONS_SERVICE_URL || 'http://fence-notifications-service:3006'
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    platform: 'Fence Platform Microservices',
    version: '2.0.0',
    services: Object.keys(services),
    documentation: '/api/docs',
    health: '/health',
    demo_accounts: [
      { email: 'admin@texasfencepro.com', password: 'DemoPass123!', tier: 'Professional' },
      { email: 'admin@austinfence.com', password: 'DemoPass123!', tier: 'Essential' }
    ]
  });
});

// Proxy requests to auth service
app.use('/api/auth', createProxyMiddleware({
  target: services.auth,
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' },
  onError: (err, req, res) => {
    console.error('Auth service error:', err);
    res.status(503).json({ error: 'Auth service unavailable' });
  }
}));

// Proxy requests to pricing service
app.use('/api/pricing', createProxyMiddleware({
  target: services.pricing,
  changeOrigin: true,
  pathRewrite: { '^/api/pricing': '' },
  onError: (err, req, res) => {
    console.error('Pricing service error:', err);
    res.status(503).json({ error: 'Pricing service unavailable' });
  }
}));

// Proxy requests to CRM service
app.use('/api/crm', createProxyMiddleware({
  target: services.crm,
  changeOrigin: true,
  pathRewrite: { '^/api/crm': '' },
  onError: (err, req, res) => {
    console.error('CRM service error:', err);
    res.status(503).json({ error: 'CRM service unavailable' });
  }
}));

// Proxy requests to maps service
app.use('/api/maps', createProxyMiddleware({
  target: services.maps,
  changeOrigin: true,
  pathRewrite: { '^/api/maps': '' },
  onError: (err, req, res) => {
    console.error('Maps service error:', err);
    res.status(503).json({ error: 'Maps service unavailable' });
  }
}));

// Service discovery endpoint
app.get('/api/services', (req, res) => {
  res.json(services);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method
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
  console.log('Connected services:', Object.keys(services).join(', '));
});