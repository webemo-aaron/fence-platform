# Multi-Tenant Implementation Guide

## 🔨 Code Changes Required

### 1. Database Migration Script
```javascript
// migrations/001-multi-tenant-schema.js
const { Pool } = require('pg');

async function up(pool) {
  // Create organizations table
  await pool.query(`
    CREATE TABLE organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      subdomain VARCHAR(100) UNIQUE NOT NULL,
      plan VARCHAR(50) DEFAULT 'starter',
      created_at TIMESTAMP DEFAULT NOW(),
      settings JSONB DEFAULT '{}',
      limits JSONB DEFAULT '{
        "users": 1,
        "monthly_jobs": 50,
        "storage_gb": 1
      }'
    )
  `);

  // Add org_id to all existing tables
  const tables = [
    'customers', 'leads', 'appointments', 'quotes', 
    'roi_calculations', 'pricing_approvals'
  ];
  
  for (const table of tables) {
    await pool.query(`
      ALTER TABLE ${table} 
      ADD COLUMN org_id UUID REFERENCES organizations(id),
      ADD INDEX idx_${table}_org (org_id)
    `);
  }

  // Create RLS policies
  await pool.query(`
    ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY org_isolation ON customers
      FOR ALL
      USING (org_id = current_setting('app.org_id')::uuid);
  `);
}
```

### 2. Updated Database Service
```javascript
// services/multi-tenant-database.service.js
const { Pool } = require('pg');

class MultiTenantDatabaseService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20, // Connection pool for all tenants
    });
  }

  // Execute query with tenant context
  async query(text, params, orgId) {
    const client = await this.pool.connect();
    try {
      // Set tenant context for RLS
      await client.query('SET app.org_id = $1', [orgId]);
      const result = await client.query(text, params);
      return result;
    } finally {
      await client.query('RESET app.org_id');
      client.release();
    }
  }

  // Tenant-aware wrapper methods
  async findCustomers(orgId, filters = {}) {
    const query = `
      SELECT * FROM customers 
      WHERE org_id = $1 
      ${filters.status ? 'AND status = $2' : ''}
      ORDER BY created_at DESC
    `;
    const params = [orgId];
    if (filters.status) params.push(filters.status);
    
    return this.query(query, params, orgId);
  }

  // Shared data (no org_id needed)
  async getSharedPricingZones() {
    return this.pool.query('SELECT * FROM shared.pricing_zones');
  }
}

module.exports = MultiTenantDatabaseService;
```

### 3. Tenant Middleware
```javascript
// middleware/tenant.middleware.js
const jwt = require('jsonwebtoken');

class TenantMiddleware {
  static async extractTenant(req, res, next) {
    try {
      // Method 1: From subdomain
      const hostname = req.hostname; // acme.fenceplatform.com
      const subdomain = hostname.split('.')[0];
      
      // Method 2: From JWT token
      const token = req.headers.authorization?.split(' ')[1];
      let tokenOrgId = null;
      
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        tokenOrgId = decoded.orgId;
      }
      
      // Method 3: From header (for API access)
      const headerOrgId = req.headers['x-org-id'];
      
      // Determine final org_id
      const orgId = tokenOrgId || headerOrgId || 
                    await this.getOrgIdFromSubdomain(subdomain);
      
      if (!orgId) {
        return res.status(400).json({ error: 'Organization not found' });
      }
      
      // Attach to request
      req.orgId = orgId;
      req.organization = await this.getOrganization(orgId);
      
      // Check plan limits
      await this.checkPlanLimits(req.organization);
      
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid tenant context' });
    }
  }
  
  static async checkPlanLimits(org) {
    const usage = await this.getCurrentUsage(org.id);
    
    if (usage.monthly_jobs >= org.limits.monthly_jobs) {
      throw new Error('Monthly job limit exceeded. Please upgrade.');
    }
    
    if (usage.users >= org.limits.users) {
      throw new Error('User limit exceeded. Please upgrade.');
    }
  }
}

module.exports = TenantMiddleware;
```

### 4. Updated API Routes
```javascript
// services/multi-tenant-api.js
const express = require('express');
const router = express.Router();
const TenantMiddleware = require('../middleware/tenant.middleware');
const MultiTenantDatabaseService = require('./multi-tenant-database.service');

const db = new MultiTenantDatabaseService();

// Apply tenant middleware to all routes
router.use(TenantMiddleware.extractTenant);

// Tenant-specific endpoints
router.get('/customers', async (req, res) => {
  const customers = await db.findCustomers(req.orgId);
  res.json(customers);
});

router.post('/quotes', async (req, res) => {
  // Check feature availability
  if (!req.organization.features.location_pricing) {
    return res.status(403).json({ 
      error: 'Location pricing not available in your plan' 
    });
  }
  
  const quote = await db.createQuote({
    ...req.body,
    org_id: req.orgId
  });
  
  // Track usage
  await db.incrementUsage(req.orgId, 'quotes');
  
  res.json(quote);
});

// Shared data endpoint (cached)
router.get('/pricing-zones', async (req, res) => {
  const zones = await cache.get('pricing-zones', async () => {
    return db.getSharedPricingZones();
  });
  res.json(zones);
});

module.exports = router;
```

### 5. Billing Integration
```javascript
// services/billing.service.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class BillingService {
  async createOrganization(data) {
    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: data.email,
      name: data.company_name,
      metadata: {
        org_id: data.id
      }
    });
    
    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{
        price: this.getPriceId(data.plan)
      }],
      trial_period_days: 14,
      metadata: {
        org_id: data.id
      }
    });
    
    // Store in database
    await db.updateOrganization(data.id, {
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      trial_ends_at: new Date(subscription.trial_end * 1000)
    });
    
    return subscription;
  }
  
  async handleWebhook(event) {
    switch (event.type) {
      case 'customer.subscription.updated':
        await this.updateSubscription(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.cancelSubscription(event.data.object);
        break;
      case 'invoice.payment_failed':
        await this.handleFailedPayment(event.data.object);
        break;
    }
  }
  
  getPriceId(plan) {
    const prices = {
      starter: 'price_starter_monthly',
      growth: 'price_growth_monthly',
      enterprise: 'price_enterprise_monthly'
    };
    return prices[plan];
  }
}
```

### 6. Self-Service Onboarding
```javascript
// services/onboarding.service.js
class OnboardingService {
  async createAccount(data) {
    const org = await db.transaction(async (trx) => {
      // 1. Create organization
      const org = await trx.insert('organizations', {
        name: data.company_name,
        subdomain: this.generateSubdomain(data.company_name),
        plan: 'starter',
        settings: {
          timezone: data.timezone || 'America/Chicago',
          business_hours: data.business_hours || '9-5',
          service_area: data.service_area
        }
      });
      
      // 2. Create admin user
      const user = await trx.insert('users', {
        org_id: org.id,
        email: data.email,
        password_hash: await bcrypt.hash(data.password, 10),
        role: 'admin',
        name: data.name
      });
      
      // 3. Initialize default data
      await this.seedDefaultData(trx, org.id);
      
      // 4. Create billing subscription
      await billingService.createOrganization(org);
      
      return org;
    });
    
    // 5. Send welcome email
    await emailService.sendWelcome(data.email, org);
    
    // 6. Track signup
    await analytics.track('signup', {
      org_id: org.id,
      plan: 'starter',
      source: data.utm_source
    });
    
    return org;
  }
  
  async seedDefaultData(trx, orgId) {
    // Add sample data for demo
    await trx.insert('pricing_tiers', [
      { org_id: orgId, name: 'Basic', base_price: 299 },
      { org_id: orgId, name: 'Premium', base_price: 599 },
      { org_id: orgId, name: 'Elite', base_price: 999 }
    ]);
  }
  
  generateSubdomain(companyName) {
    const base = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);
    
    // Ensure uniqueness
    let subdomain = base;
    let counter = 1;
    
    while (await this.subdomainExists(subdomain)) {
      subdomain = `${base}${counter}`;
      counter++;
    }
    
    return subdomain;
  }
}
```

### 7. Resource Optimization
```javascript
// services/cache.service.js
const Redis = require('ioredis');

class CacheService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      keyPrefix: 'fence:',
      maxRetriesPerRequest: 3
    });
  }
  
  // Tenant-specific caching
  async get(key, orgId, fetchFn) {
    const cacheKey = `${orgId}:${key}`;
    
    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    // Fetch and cache
    const data = await fetchFn();
    await this.redis.setex(
      cacheKey, 
      300, // 5 minutes
      JSON.stringify(data)
    );
    
    return data;
  }
  
  // Shared data caching
  async getShared(key, fetchFn) {
    const cacheKey = `shared:${key}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
    
    const data = await fetchFn();
    await this.redis.setex(
      cacheKey,
      3600, // 1 hour for shared data
      JSON.stringify(data)
    );
    
    return data;
  }
  
  // Invalidate tenant cache
  async invalidate(orgId, pattern = '*') {
    const keys = await this.redis.keys(`fence:${orgId}:${pattern}`);
    if (keys.length) {
      await this.redis.del(...keys);
    }
  }
}
```

### 8. Usage Tracking
```javascript
// services/usage.service.js
class UsageService {
  async trackUsage(orgId, metric, value = 1) {
    const key = `usage:${orgId}:${metric}:${this.getCurrentMonth()}`;
    
    // Increment in Redis for real-time
    await redis.incrby(key, value);
    
    // Batch write to database
    await this.batchWrite({
      org_id: orgId,
      metric,
      value,
      timestamp: new Date()
    });
    
    // Check limits
    await this.checkLimits(orgId, metric);
  }
  
  async checkLimits(orgId, metric) {
    const org = await db.getOrganization(orgId);
    const usage = await this.getCurrentUsage(orgId);
    
    const limits = {
      jobs: org.limits.monthly_jobs,
      storage: org.limits.storage_gb * 1024 * 1024 * 1024,
      api_calls: org.limits.api_calls || 10000
    };
    
    if (usage[metric] >= limits[metric]) {
      // Notify admin
      await notifications.send(orgId, 'limit_exceeded', {
        metric,
        current: usage[metric],
        limit: limits[metric]
      });
      
      // Optionally block or throttle
      if (org.settings.hard_limits) {
        throw new Error(`${metric} limit exceeded`);
      }
    }
  }
}
```

### 9. Deployment Configuration
```yaml
# docker-compose.multi-tenant.yml
version: '3.8'

services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/fence_platform
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - db
      - redis
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=fence_platform
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - app

volumes:
  postgres_data:
  redis_data:
```

### 10. Monitoring Setup
```javascript
// services/monitoring.service.js
const prometheus = require('prom-client');

class MonitoringService {
  constructor() {
    // Metrics per tenant
    this.apiLatency = new prometheus.Histogram({
      name: 'api_latency_seconds',
      help: 'API latency in seconds',
      labelNames: ['org_id', 'endpoint', 'method'],
      buckets: [0.1, 0.5, 1, 2, 5]
    });
    
    this.activeUsers = new prometheus.Gauge({
      name: 'active_users',
      help: 'Active users per organization',
      labelNames: ['org_id', 'plan']
    });
    
    this.jobsProcessed = new prometheus.Counter({
      name: 'jobs_processed_total',
      help: 'Total jobs processed',
      labelNames: ['org_id', 'status']
    });
  }
  
  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        
        this.apiLatency.observe({
          org_id: req.orgId,
          endpoint: req.route?.path,
          method: req.method
        }, duration);
      });
      
      next();
    };
  }
}
```

## 🚀 Migration Path

### Week 1: Database Setup
```bash
# 1. Create PostgreSQL database
createdb fence_platform

# 2. Run migrations
npm run migrate:up

# 3. Test connection pooling
npm run test:db
```

### Week 2: Multi-tenant Core
```bash
# 1. Update services
npm run refactor:services

# 2. Add middleware
npm run test:middleware

# 3. Update APIs
npm run test:api
```

### Week 3: Billing & Onboarding
```bash
# 1. Setup Stripe
npm run setup:stripe

# 2. Test onboarding
npm run test:onboarding

# 3. Deploy staging
npm run deploy:staging
```

### Week 4: Production Launch
```bash
# 1. Load testing
npm run test:load

# 2. Security audit
npm run audit:security

# 3. Deploy production
npm run deploy:production
```

## ✅ Validation Checklist

- [ ] Data isolation verified
- [ ] Performance benchmarked
- [ ] Billing integration tested
- [ ] Onboarding flow smooth
- [ ] Resource limits enforced
- [ ] Monitoring configured
- [ ] Backups automated
- [ ] Security audited
- [ ] Documentation complete
- [ ] Support team trained