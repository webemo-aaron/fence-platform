# Quick MVP Multi-Tenant Solution

## 🎯 Minimal Viable Multi-Tenant Platform (2-Week Sprint)

### Goal
Get 5-10 fence installers using a shared platform in 2 weeks with minimal changes.

## 🚀 Simplest Approach: URL-Based Isolation

### Architecture
```
acme.fenceplatform.io → [Shared Server] → Database (org_id=1)
smith.fenceplatform.io → [Shared Server] → Database (org_id=2)
```

## 📝 MVP Requirements

### Week 1: Core Changes

#### 1. Add Organization Table (Day 1)
```sql
-- Single migration file
ALTER TABLE customers ADD COLUMN org_id INTEGER DEFAULT 1;
ALTER TABLE leads ADD COLUMN org_id INTEGER DEFAULT 1;
ALTER TABLE quotes ADD COLUMN org_id INTEGER DEFAULT 1;
ALTER TABLE appointments ADD COLUMN org_id INTEGER DEFAULT 1;

CREATE TABLE organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  plan TEXT DEFAULT 'trial',
  stripe_customer_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  trial_ends_at DATETIME DEFAULT (datetime('now', '+14 days')),
  is_active BOOLEAN DEFAULT 1
);

-- Seed first org for existing data
INSERT INTO organizations (name, subdomain, email) 
VALUES ('Demo Company', 'demo', 'demo@example.com');
```

#### 2. Simple Tenant Middleware (Day 2)
```javascript
// middleware/simple-tenant.js
const db = require('./services/database.service');

async function getTenantId(req, res, next) {
  // Get subdomain from URL
  const host = req.get('host'); // acme.fenceplatform.io
  const subdomain = host.split('.')[0];
  
  // Special case for localhost
  if (host.includes('localhost')) {
    req.orgId = req.query.org || 1; // Use query param for testing
    return next();
  }
  
  // Look up organization
  const org = await db.get(
    'SELECT * FROM organizations WHERE subdomain = ?',
    [subdomain]
  );
  
  if (!org) {
    return res.status(404).send('Organization not found');
  }
  
  // Check if trial expired
  if (new Date(org.trial_ends_at) < new Date() && org.plan === 'trial') {
    return res.status(403).send('Trial expired. Please upgrade.');
  }
  
  req.orgId = org.id;
  req.organization = org;
  next();
}

module.exports = getTenantId;
```

#### 3. Update All Queries (Day 3-4)
```javascript
// Before
const customers = await db.all('SELECT * FROM customers');

// After  
const customers = await db.all(
  'SELECT * FROM customers WHERE org_id = ?',
  [req.orgId]
);

// Create helper function
class TenantAwareDB {
  async findAll(table, orgId) {
    return db.all(`SELECT * FROM ${table} WHERE org_id = ?`, [orgId]);
  }
  
  async create(table, data, orgId) {
    return db.run(
      `INSERT INTO ${table} SET ?, org_id = ?`,
      [data, orgId]
    );
  }
}
```

#### 4. Simple Signup Page (Day 5)
```html
<!-- ui/signup.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Start Your Free Trial</title>
  <style>
    .signup-form {
      max-width: 400px;
      margin: 50px auto;
      padding: 20px;
      border: 1px solid #ddd;
    }
    input, button {
      width: 100%;
      padding: 10px;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="signup-form">
    <h2>Start 14-Day Free Trial</h2>
    <form id="signupForm">
      <input type="text" id="company" placeholder="Company Name" required>
      <input type="email" id="email" placeholder="Email" required>
      <input type="tel" id="phone" placeholder="Phone">
      <input type="password" id="password" placeholder="Password" required>
      <button type="submit">Start Free Trial</button>
    </form>
    <p>No credit card required</p>
  </div>
  
  <script>
    document.getElementById('signupForm').onsubmit = async (e) => {
      e.preventDefault();
      
      const data = {
        company: document.getElementById('company').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        password: document.getElementById('password').value
      };
      
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      if (result.success) {
        alert(`Success! Access your portal at: ${result.subdomain}.fenceplatform.io`);
        window.location.href = `http://${result.subdomain}.fenceplatform.io`;
      }
    };
  </script>
</body>
</html>
```

#### 5. Signup API (Day 5)
```javascript
// api/signup.js
app.post('/api/signup', async (req, res) => {
  const { company, email, phone, password } = req.body;
  
  // Generate subdomain
  const subdomain = company.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20);
  
  // Create organization
  const org = await db.run(`
    INSERT INTO organizations (name, subdomain, email, phone)
    VALUES (?, ?, ?, ?)
  `, [company, subdomain, email, phone]);
  
  // Create admin user
  const passwordHash = await bcrypt.hash(password, 10);
  await db.run(`
    INSERT INTO users (org_id, email, password_hash, role)
    VALUES (?, ?, ?, 'admin')
  `, [org.lastID, email, passwordHash]);
  
  // Send welcome email
  await sendEmail(email, 'Welcome!', `
    Your fence platform is ready!
    Access it at: https://${subdomain}.fenceplatform.io
    
    Your 14-day trial has started.
  `);
  
  res.json({ 
    success: true, 
    subdomain,
    message: 'Check your email for login details'
  });
});
```

### Week 2: Polish & Launch

#### 6. Basic Billing Integration (Day 6-7)
```javascript
// services/simple-billing.js
const stripe = require('stripe')(process.env.STRIPE_KEY);

async function createCheckoutSession(orgId) {
  const org = await db.get(
    'SELECT * FROM organizations WHERE id = ?',
    [orgId]
  );
  
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price: 'price_1234', // $99/month price ID
      quantity: 1,
    }],
    mode: 'subscription',
    success_url: `https://${org.subdomain}.fenceplatform.io/success`,
    cancel_url: `https://${org.subdomain}.fenceplatform.io/billing`,
    metadata: {
      org_id: orgId
    }
  });
  
  return session.url;
}

// Webhook to activate subscription
app.post('/webhook/stripe', async (req, res) => {
  const event = stripe.webhooks.constructEvent(
    req.body,
    req.headers['stripe-signature'],
    process.env.STRIPE_WEBHOOK_SECRET
  );
  
  if (event.type === 'checkout.session.completed') {
    const orgId = event.data.object.metadata.org_id;
    await db.run(
      'UPDATE organizations SET plan = ?, stripe_customer_id = ? WHERE id = ?',
      ['paid', event.data.object.customer, orgId]
    );
  }
  
  res.json({received: true});
});
```

#### 7. Nginx Configuration (Day 8)
```nginx
# /etc/nginx/sites-enabled/fence-platform
server {
  listen 80;
  server_name *.fenceplatform.io;
  
  location / {
    proxy_pass http://localhost:3333;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

#### 8. Quick Admin Dashboard (Day 9)
```javascript
// api/admin.js
app.get('/api/admin/stats', async (req, res) => {
  // Only for super admin
  if (req.organization.subdomain !== 'admin') {
    return res.status(403).json({error: 'Forbidden'});
  }
  
  const stats = await db.get(`
    SELECT 
      COUNT(*) as total_orgs,
      COUNT(CASE WHEN plan = 'paid' THEN 1 END) as paid_orgs,
      COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as new_this_week
    FROM organizations
  `);
  
  res.json(stats);
});
```

#### 9. Data Migration Script (Day 10)
```javascript
// scripts/migrate-existing.js
async function migrateExistingCustomer(email, companyName) {
  // Create org for existing customer
  const subdomain = companyName.toLowerCase().replace(/\s+/g, '');
  
  const org = await db.run(`
    INSERT INTO organizations (name, subdomain, email, plan)
    VALUES (?, ?, ?, 'paid')
  `, [companyName, subdomain, email]);
  
  // Update their data
  await db.run(
    'UPDATE customers SET org_id = ? WHERE email = ?',
    [org.lastID, email]
  );
  
  console.log(`Migrated ${companyName} to ${subdomain}.fenceplatform.io`);
}
```

#### 10. Launch Checklist (Day 11-14)

##### Technical Setup
```bash
# 1. Deploy to server
git push production main

# 2. Setup wildcard DNS
# *.fenceplatform.io → Your server IP

# 3. SSL certificate
certbot --nginx -d *.fenceplatform.io

# 4. Database backup
sqlite3 data/invisible-fence.db .backup backup.db

# 5. Start with PM2
pm2 start server.js --name fence-platform
pm2 save
pm2 startup
```

##### Business Setup
```markdown
## Launch Email Template

Subject: Your Fence Business Management Platform is Ready!

Hi [Name],

Great news! We've set up your dedicated fence business platform.

**Your Custom Portal:** [company].fenceplatform.io
**Free Trial:** 14 days (no credit card needed)

**What's Included:**
✓ ROI Calculator for quotes
✓ Customer management (CRM)
✓ Location-based pricing
✓ Job scheduling
✓ PDF quote generation

**Special Launch Offer:** $49/month (normally $99)
- Locked in forever if you sign up during trial

**Quick Start:**
1. Visit your portal
2. Add your first customer
3. Create a quote
4. See the ROI calculation

Need help? Reply to this email or call 555-FENCE (33623)

Best,
The Fence Platform Team
```

## 💰 MVP Pricing

### Launch Pricing (First 20 Customers)
- **Free Trial**: 14 days
- **Special Price**: $49/month (normally $99)
- **What's Included**:
  - Unlimited users
  - Unlimited quotes
  - All features
  - Email support
  - Weekly backups

### Cost Analysis
```
Server (DigitalOcean): $20/month
Domain + SSL:          $10/month  
Email (SendGrid):      $15/month
Stripe fees (2.9%):    ~$30/month
Total Infrastructure:  $75/month

Revenue (10 customers @ $49): $490/month
Profit Margin:                 85%
```

## 📊 Success Metrics

### Week 1 Goals
- [ ] 3 beta testers signed up
- [ ] Core multi-tenant working
- [ ] Basic billing integrated

### Week 2 Goals  
- [ ] 10 trial users
- [ ] 3 paid conversions
- [ ] Zero critical bugs

### Month 1 Goals
- [ ] 20 paying customers
- [ ] $1,000 MRR
- [ ] 90% retention rate

## 🚦 Go-Live Checklist

### Before Launch
- [ ] Test with 3 different subdomains
- [ ] Verify data isolation
- [ ] Test payment flow
- [ ] Backup system working
- [ ] Support email setup

### Launch Day
- [ ] Send to 10 prospects
- [ ] Monitor server load
- [ ] Watch error logs
- [ ] Respond to signups quickly
- [ ] Collect feedback

### Post-Launch
- [ ] Daily check-ins with new users
- [ ] Fix bugs immediately
- [ ] Add requested features
- [ ] Optimize slow queries
- [ ] Plan v2 features

## 🎯 Why This Works

1. **Minimal Changes**: 80% of code stays the same
2. **Quick to Market**: 2 weeks vs 2 months
3. **Low Risk**: SQLite can handle 50+ tenants
4. **Easy to Understand**: Simple subdomain = company
5. **Profitable Fast**: Break-even at 2 customers

## Next Steps After MVP

Once you have 10-20 paying customers:
1. Migrate to PostgreSQL
2. Add advanced features
3. Implement usage limits
4. Build mobile app
5. Raise prices to $99/month

This MVP gets you to market fast, validates demand, and generates revenue while you build the full platform.