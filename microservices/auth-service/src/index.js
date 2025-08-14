const express = require('express');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const session = require('express-session');
const passport = require('passport');
const { initializeFacebookAuth } = require('./facebook-auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Session middleware (required for passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'fence-platform-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Security middleware
app.use(helmet());
app.use(express.json());

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// In-memory store for demo (replace with database in production)
const users = new Map();
const sessions = new Map();

// Demo users
const demoUsers = [
  {
    id: 'demo-1',
    email: 'admin@texasfencepro.com',
    password: '$2a$10$YQF8vH8.JKxGz5vG2EKrLOdPgD9fqJ.rzV7mxqKqJXZ7K5yG1Xzqe', // DemoPass123!
    tenant_id: 'texas-fence-pro',
    tier: 'professional',
    company: 'Texas Fence Pro',
    role: 'admin'
  },
  {
    id: 'demo-2',
    email: 'admin@austinfence.com',
    password: '$2a$10$YQF8vH8.JKxGz5vG2EKrLOdPgD9fqJ.rzV7mxqKqJXZ7K5yG1Xzqe', // DemoPass123!
    tenant_id: 'austin-fence',
    tier: 'essential',
    company: 'Austin Fence Company',
    role: 'admin'
  }
];

// Initialize demo users
demoUsers.forEach(user => {
  users.set(user.email, user);
});

// Initialize Facebook OAuth
initializeFacebookAuth(app, users);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Login endpoint
app.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  const user = users.get(email);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
      tier: user.tier,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const sessionId = `session-${Date.now()}-${Math.random()}`;
  sessions.set(sessionId, {
    user_id: user.id,
    token,
    created_at: new Date()
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      company: user.company,
      tier: user.tier,
      role: user.role
    },
    session_id: sessionId
  });
});

// Signup endpoint
app.post('/signup', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('company').notEmpty(),
  body('tier').isIn(['starter', 'essential', 'professional', 'enterprise'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, company, tier } = req.body;

  if (users.has(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = `user-${Date.now()}`;
  const tenantId = company.toLowerCase().replace(/\s+/g, '-');

  const newUser = {
    id: userId,
    email,
    password: hashedPassword,
    tenant_id: tenantId,
    tier,
    company,
    role: 'admin',
    created_at: new Date()
  };

  users.set(email, newUser);

  const token = jwt.sign(
    {
      id: userId,
      email,
      tenant_id: tenantId,
      tier,
      role: 'admin'
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  res.status(201).json({
    success: true,
    token,
    user: {
      id: userId,
      email,
      company,
      tier,
      tenant_id: tenantId
    }
  });
});

// Verify token endpoint
app.post('/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({
      valid: true,
      user: decoded
    });
  } catch (error) {
    res.status(401).json({
      valid: false,
      error: 'Invalid token'
    });
  }
});

// Logout endpoint
app.post('/logout', (req, res) => {
  const { session_id } = req.body;
  
  if (session_id && sessions.has(session_id)) {
    sessions.delete(session_id);
  }
  
  res.json({ success: true, message: 'Logged out successfully' });
});

// Password reset request
app.post('/reset-password-request', [
  body('email').isEmail().normalizeEmail()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // In production, send email with reset link
  res.json({
    success: true,
    message: 'Password reset link sent to email',
    demo_note: 'In production, an email would be sent'
  });
});

// Get current user
app.get('/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = Array.from(users.values()).find(u => u.id === decoded.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      company: user.company,
      tier: user.tier,
      role: user.role,
      tenant_id: user.tenant_id
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    service: 'auth-service'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Auth service error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    service: 'auth-service'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
  console.log(`Demo users: ${demoUsers.map(u => u.email).join(', ')}`);
});