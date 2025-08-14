const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS for API integration
app.use(cors());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API proxy middleware for development
app.use('/api', (req, res, next) => {
  // In production, this would proxy to actual microservices
  // For now, return mock data
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  // Mock API responses
  if (req.path === '/health') {
    return res.json({ status: 'healthy', service: 'react-enterprise', timestamp: new Date().toISOString() });
  }
  
  next();
});

// Handle React Router (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'react-enterprise-frontend',
    timestamp: new Date().toISOString(),
    version: '3.0.0'
  });
});

app.listen(PORT, () => {
  console.log(`React Enterprise Frontend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});