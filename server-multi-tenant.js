const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;

// Import services
const PostgresDatabaseService = require('./services/postgres-database.service');
const TenantMiddleware = require('./middleware/tenant.middleware');
const PDFGeneratorService = require('./services/pdf-generator.service');

// Import API routes
const signupRoutes = require('./services/signup-api');
const authRoutes = require('./services/auth-api');
const crmRoutes = require('./services/crm-api');
const quoteRoutes = require('./services/quote-api');
const mapsRoutes = require('./services/maps-api');
const approvalRoutes = require('./services/approval-api');

const app = express();
const PORT = process.env.PORT || 3333;

// Initialize database
const db = new PostgresDatabaseService();
const pdfGenerator = new PDFGeneratorService();

// =====================================================
// MIDDLEWARE CONFIGURATION
// =====================================================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false
}));

// CORS configuration for multi-tenant
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests from any subdomain
    if (!origin) return callback(null, true);
    
    const allowedDomains = [
      /^https?:\/\/([a-z0-9-]+\.)?fenceplatform\.io$/,
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/
    ];
    
    const allowed = allowedDomains.some(domain => domain.test(origin));
    callback(null, allowed);
  },
  credentials: true
}));

// Rate limiting per organization
const createRateLimiter = (windowMs, max) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => {
      // Rate limit per organization + IP
      return `${req.orgId || 'public'}-${req.ip}`;
    },
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        message: 'Please slow down your requests',
        retryAfter: req.rateLimit.resetTime
      });
    }
  });
};

// Apply different rate limits
app.use('/api/signup', createRateLimiter(15 * 60 * 1000, 5)); // 5 signups per 15 min
app.use('/api/', createRateLimiter(1 * 60 * 1000, 100)); // 100 requests per minute

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static('ui'));

// =====================================================
// PUBLIC ROUTES (No tenant required)
// =====================================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Signup page
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'signup.html'));
});

// Signup API
app.use('/api', signupRoutes);

// =====================================================
// TENANT MIDDLEWARE
// =====================================================

// Apply tenant extraction to all routes except public ones
app.use((req, res, next) => {
  if (TenantMiddleware.isPublicRoute(req.path)) {
    return next();
  }
  TenantMiddleware.extractTenant(req, res, next);
});

// Log activity for audit
app.use(TenantMiddleware.logActivity);

// =====================================================
// TENANT-SPECIFIC ROUTES
// =====================================================

// Dashboard redirect based on plan
app.get('/', TenantMiddleware.requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'index.html'));
});

// CRM Routes
app.use('/api/crm', 
  TenantMiddleware.requireAuth,
  (req, res, next) => {
    // Pass org context to CRM routes
    req.db = db;
    next();
  },
  crmRoutes
);

// Quote Routes
app.use('/api/quote',
  TenantMiddleware.requireAuth,
  TenantMiddleware.requireFeature('location_pricing'),
  (req, res, next) => {
    req.db = db;
    next();
  },
  quoteRoutes
);

// Maps Routes
app.use('/api/maps',
  TenantMiddleware.requireAuth,
  TenantMiddleware.requireFeature('location_pricing'),
  (req, res, next) => {
    req.db = db;
    next();
  },
  mapsRoutes
);

// Approval Routes
app.use('/api/approval',
  TenantMiddleware.requireAuth,
  TenantMiddleware.requireFeature('approval_workflow'),
  TenantMiddleware.requireRole(['manager', 'admin']),
  (req, res, next) => {
    req.db = db;
    next();
  },
  approvalRoutes
);

// =====================================================
// ROI CALCULATOR (Tenant-Aware)
// =====================================================

app.get('/api/calculations', TenantMiddleware.requireAuth, async (req, res) => {
  try {
    // Get org-specific settings
    const settings = req.orgSettings.roi_settings || {
      hourlyRate: 35,
      monthlyRevenue: 50000
    };

    // Get org-specific tiers
    const tiers = await db.all(
      `SELECT * FROM pricing_tiers WHERE org_id = $1 ORDER BY base_price`,
      [req.orgId],
      req.orgId
    );

    res.json({
      settings,
      tiers,
      organization: {
        name: req.organization.name,
        plan: req.organization.plan
      }
    });
  } catch (error) {
    console.error('Error fetching calculations:', error);
    res.status(500).json({ error: 'Failed to fetch calculations' });
  }
});

app.post('/api/calculations', TenantMiddleware.requireAuth, async (req, res) => {
  try {
    const { tier, inputs } = req.body;

    // Save calculation
    await db.run(
      `INSERT INTO roi_calculations (org_id, tier, inputs, results, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [req.orgId, tier, JSON.stringify(inputs), JSON.stringify(req.body)],
      req.orgId
    );

    // Track usage
    await db.incrementUsage(req.orgId, 'quotes_generated');

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving calculation:', error);
    res.status(500).json({ error: 'Failed to save calculation' });
  }
});

// =====================================================
// ORGANIZATION MANAGEMENT
// =====================================================

app.get('/api/organization', TenantMiddleware.requireAuth, async (req, res) => {
  try {
    const stats = await db.getOrganizationStats(req.orgId);
    
    res.json({
      organization: req.organization,
      stats,
      limits: {
        users: req.organization.max_users,
        monthly_jobs: req.organization.max_monthly_jobs,
        storage_gb: req.organization.max_storage_gb
      }
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: 'Failed to fetch organization data' });
  }
});

app.put('/api/organization/settings', 
  TenantMiddleware.requireAuth,
  TenantMiddleware.requireRole('admin'),
  async (req, res) => {
    try {
      const { settings } = req.body;
      
      const updated = await db.updateOrganization(req.orgId, {
        settings: JSON.stringify({
          ...req.orgSettings,
          ...settings
        })
      });

      res.json({ success: true, settings: updated.settings });
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

// =====================================================
// USAGE & ANALYTICS
// =====================================================

app.get('/api/usage', TenantMiddleware.requireAuth, async (req, res) => {
  try {
    const month = new Date().toISOString().slice(0, 7) + '-01';
    
    const usage = await db.get(
      `SELECT * FROM organization_usage 
       WHERE org_id = $1 AND month = $2`,
      [req.orgId, month],
      req.orgId
    );

    res.json({
      usage: usage || { jobs_created: 0, quotes_generated: 0, api_calls: 0 },
      limits: {
        jobs: req.organization.max_monthly_jobs,
        users: req.organization.max_users,
        api_calls: req.organization.max_api_calls || 10000
      },
      percentages: {
        jobs: usage ? (usage.jobs_created / req.organization.max_monthly_jobs * 100) : 0,
        users: usage ? (usage.active_users / req.organization.max_users * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

// =====================================================
// ADMIN ROUTES (Super Admin Only)
// =====================================================

app.get('/api/admin/organizations',
  TenantMiddleware.requireAuth,
  async (req, res) => {
    // Check if user is super admin
    if (req.organization.subdomain !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const orgs = await db.all(
        `SELECT o.*, 
          (SELECT COUNT(*) FROM users WHERE org_id = o.id) as user_count,
          (SELECT COUNT(*) FROM customers WHERE org_id = o.id) as customer_count
         FROM organizations o
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC`,
        []
      );

      res.json(orgs);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      res.status(500).json({ error: 'Failed to fetch organizations' });
    }
  }
);

app.get('/api/admin/stats',
  TenantMiddleware.requireAuth,
  async (req, res) => {
    if (req.organization.subdomain !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const stats = await db.getSystemStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching system stats:', error);
      res.status(500).json({ error: 'Failed to fetch system stats' });
    }
  }
);

// =====================================================
// ERROR HANDLING
// =====================================================

app.use((err, req, res, next) => {
  console.error('Application error:', err);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// =====================================================
// SERVER INITIALIZATION
// =====================================================

async function startServer() {
  try {
    // Initialize database
    await db.initialize();
    console.log('✓ Database initialized');

    // Ensure data directory exists
    const dataDir = path.join(__dirname, 'data');
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════╗
║     Multi-Tenant Fence Platform Active     ║
╠════════════════════════════════════════════╣
║  Main URL:    http://localhost:${PORT}       ║
║  Signup:      http://localhost:${PORT}/signup ║
║  Health:      http://localhost:${PORT}/health ║
║                                            ║
║  Test Orgs:                                ║
║  • demo.localhost:${PORT}                    ║
║  • acme.localhost:${PORT}                    ║
║                                            ║
║  Environment: ${process.env.NODE_ENV || 'development'}               ║
╚════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await db.close();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;