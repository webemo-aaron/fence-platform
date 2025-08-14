const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

class PostgresDatabaseService {
  constructor() {
    // Use connection string from environment or default
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/fence_platform',
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Handle pool errors
    this.pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async initialize() {
    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('✓ Connected to PostgreSQL database');
      
      // Ensure tables exist
      await this.ensureTables();
      return true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async ensureTables() {
    // Check if organizations table exists
    const result = await this.pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'organizations'
      );
    `);

    if (!result.rows[0].exists) {
      console.log('Running initial migration...');
      // In production, run migration scripts instead
      throw new Error('Database not initialized. Please run migrations first.');
    }
  }

  // ==========================================
  // TENANT-AWARE QUERY METHODS
  // ==========================================

  async query(text, params, orgId) {
    const client = await this.pool.connect();
    try {
      // Set organization context for RLS
      if (orgId) {
        await client.query('SET LOCAL app.current_org_id = $1', [orgId]);
      }
      
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async get(text, params, orgId) {
    const result = await this.query(text, params, orgId);
    return result.rows[0];
  }

  async all(text, params, orgId) {
    const result = await this.query(text, params, orgId);
    return result.rows;
  }

  async run(text, params, orgId) {
    const result = await this.query(text, params, orgId);
    return {
      rowCount: result.rowCount,
      rows: result.rows
    };
  }

  // ==========================================
  // ORGANIZATION METHODS
  // ==========================================

  async getOrganizationBySubdomain(subdomain) {
    const result = await this.pool.query(
      `SELECT * FROM organizations 
       WHERE subdomain = $1 
       AND deleted_at IS NULL 
       AND is_active = true
       AND (plan != 'trial' OR trial_ends_at > NOW())`,
      [subdomain]
    );
    return result.rows[0];
  }

  async createOrganization(data) {
    const { name, subdomain, email, phone, plan = 'trial' } = data;
    
    const result = await this.pool.query(
      `INSERT INTO organizations (name, subdomain, email, phone, plan)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, subdomain, email, phone, plan]
    );
    
    return result.rows[0];
  }

  async updateOrganization(orgId, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    const setClause = fields.map((field, index) => 
      `${field} = $${index + 2}`
    ).join(', ');
    
    const result = await this.pool.query(
      `UPDATE organizations 
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [orgId, ...values]
    );
    
    return result.rows[0];
  }

  async checkUsageLimit(orgId, metric) {
    const result = await this.pool.query(
      'SELECT check_usage_limit($1, $2) as allowed',
      [orgId, metric]
    );
    return result.rows[0].allowed;
  }

  async incrementUsage(orgId, metric, value = 1) {
    const month = new Date().toISOString().slice(0, 7) + '-01'; // First day of month
    
    await this.pool.query(
      `INSERT INTO organization_usage (org_id, month, ${metric})
       VALUES ($1, $2, $3)
       ON CONFLICT (org_id, month)
       DO UPDATE SET ${metric} = organization_usage.${metric} + $3, updated_at = NOW()`,
      [orgId, month, value]
    );
  }

  // ==========================================
  // CUSTOMER METHODS
  // ==========================================

  async findCustomers(orgId, filters = {}) {
    let query = `
      SELECT * FROM customers 
      WHERE org_id = $1
    `;
    const params = [orgId];
    let paramIndex = 2;

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.search) {
      query += ` AND (
        first_name ILIKE $${paramIndex} OR 
        last_name ILIKE $${paramIndex} OR 
        email ILIKE $${paramIndex}
      )`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    return this.all(query, params, orgId);
  }

  async createCustomer(orgId, data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map((_, i) => `$${i + 2}`).join(', ');
    
    const result = await this.query(
      `INSERT INTO customers (org_id, ${fields.join(', ')})
       VALUES ($1, ${placeholders})
       RETURNING *`,
      [orgId, ...values],
      orgId
    );
    
    await this.incrementUsage(orgId, 'jobs_created');
    
    return result.rows[0];
  }

  async updateCustomer(orgId, customerId, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    const setClause = fields.map((field, index) => 
      `${field} = $${index + 3}`
    ).join(', ');
    
    const result = await this.query(
      `UPDATE customers 
       SET ${setClause}, updated_at = NOW()
       WHERE org_id = $1 AND id = $2
       RETURNING *`,
      [orgId, customerId, ...values],
      orgId
    );
    
    return result.rows[0];
  }

  // ==========================================
  // QUOTE METHODS
  // ==========================================

  async createQuote(orgId, data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map((_, i) => `$${i + 2}`).join(', ');
    
    const result = await this.query(
      `INSERT INTO quote_history (org_id, ${fields.join(', ')})
       VALUES ($1, ${placeholders})
       RETURNING *`,
      [orgId, ...values],
      orgId
    );
    
    await this.incrementUsage(orgId, 'quotes_generated');
    
    return result.rows[0];
  }

  async findQuotes(orgId, filters = {}) {
    let query = `
      SELECT * FROM quote_history 
      WHERE org_id = $1
    `;
    const params = [orgId];

    if (filters.status) {
      query += ' AND status = $2';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    return this.all(query, params, orgId);
  }

  // ==========================================
  // USER METHODS
  // ==========================================

  async createUser(orgId, userData) {
    const { email, password, role = 'user', ...otherData } = userData;
    
    // Check user limit
    const canAddUser = await this.checkUsageLimit(orgId, 'users');
    if (!canAddUser) {
      throw new Error('User limit reached. Please upgrade your plan.');
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const fields = Object.keys(otherData);
    const values = Object.values(otherData);
    
    const result = await this.query(
      `INSERT INTO users (org_id, email, password_hash, role, ${fields.join(', ')})
       VALUES ($1, $2, $3, $4, ${fields.map((_, i) => `$${i + 5}`).join(', ')})
       RETURNING id, email, role, created_at`,
      [orgId, email, passwordHash, role, ...values],
      orgId
    );
    
    return result.rows[0];
  }

  async findUserByEmail(email) {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  async validateUser(email, password) {
    const user = await this.findUserByEmail(email);
    if (!user) return null;
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return null;
    
    // Get organization
    const org = await this.pool.query(
      'SELECT * FROM organizations WHERE id = $1',
      [user.org_id]
    );
    
    return {
      ...user,
      organization: org.rows[0]
    };
  }

  // ==========================================
  // SHARED DATA METHODS (No org_id needed)
  // ==========================================

  async getSharedPricingZones() {
    const result = await this.pool.query(
      'SELECT * FROM pricing_zones ORDER BY zone_name'
    );
    return result.rows;
  }

  async getPropertyTypes() {
    const result = await this.pool.query(
      'SELECT * FROM property_types ORDER BY type_name'
    );
    return result.rows;
  }

  // ==========================================
  // TRANSACTION SUPPORT
  // ==========================================

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ==========================================
  // ANALYTICS METHODS
  // ==========================================

  async getOrganizationStats(orgId) {
    const result = await this.pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM customers WHERE org_id = $1) as customer_count,
        (SELECT COUNT(*) FROM leads WHERE org_id = $1) as lead_count,
        (SELECT COUNT(*) FROM quote_history WHERE org_id = $1) as quote_count,
        (SELECT COUNT(*) FROM users WHERE org_id = $1) as user_count,
        (SELECT COALESCE(SUM(total_price), 0) FROM quote_history 
         WHERE org_id = $1 AND status = 'accepted') as revenue,
        (SELECT jobs_created FROM organization_usage 
         WHERE org_id = $1 AND month = DATE_TRUNC('month', CURRENT_DATE)) as monthly_jobs`,
      [orgId]
    );
    return result.rows[0];
  }

  async getSystemStats() {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total_orgs,
        COUNT(CASE WHEN plan != 'trial' THEN 1 END) as paid_orgs,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_this_week,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_orgs
      FROM organizations
      WHERE deleted_at IS NULL
    `);
    return result.rows[0];
  }

  // ==========================================
  // CLEANUP METHODS
  // ==========================================

  async close() {
    await this.pool.end();
    console.log('Database connection pool closed');
  }
}

module.exports = PostgresDatabaseService;