const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      const dbPath = path.join(__dirname, '../data/invisible-fence.db');
      
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Customers table
      `CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        pet_name TEXT,
        pet_type TEXT,
        fence_type TEXT,
        installation_date DATE,
        tier TEXT DEFAULT 'Essentials',
        status TEXT DEFAULT 'active',
        monthly_revenue REAL DEFAULT 0,
        lifetime_value REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Leads table
      `CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        source TEXT,
        status TEXT DEFAULT 'new',
        score INTEGER DEFAULT 0,
        estimated_value REAL,
        assigned_to INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )`,
      
      // Interactions table
      `CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        lead_id INTEGER,
        user_id INTEGER,
        type TEXT NOT NULL,
        subject TEXT,
        description TEXT,
        outcome TEXT,
        next_action TEXT,
        next_action_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (lead_id) REFERENCES leads(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      
      // Appointments table
      `CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        lead_id INTEGER,
        technician_id INTEGER,
        type TEXT NOT NULL,
        scheduled_date DATETIME NOT NULL,
        duration_minutes INTEGER DEFAULT 60,
        status TEXT DEFAULT 'scheduled',
        address TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (lead_id) REFERENCES leads(id),
        FOREIGN KEY (technician_id) REFERENCES users(id)
      )`,
      
      // Service History table
      `CREATE TABLE IF NOT EXISTS service_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        appointment_id INTEGER,
        service_type TEXT NOT NULL,
        technician_id INTEGER,
        service_date DATE NOT NULL,
        duration_minutes INTEGER,
        parts_used TEXT,
        cost REAL,
        revenue REAL,
        notes TEXT,
        satisfaction_rating INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (appointment_id) REFERENCES appointments(id),
        FOREIGN KEY (technician_id) REFERENCES users(id)
      )`,
      
      // ROI Calculations History
      `CREATE TABLE IF NOT EXISTS roi_calculations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tier TEXT NOT NULL,
        base_price REAL,
        admin_hours REAL,
        admin_cost REAL,
        travel_hours REAL,
        revenue_leakage_percent REAL,
        payment_delays REAL,
        upsell_revenue REAL,
        predictive_maintenance REAL,
        monthly_roi REAL,
        annual_roi REAL,
        payback_period REAL,
        total_roi_percent REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Pipeline Stages
      `CREATE TABLE IF NOT EXISTS pipeline_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        probability REAL DEFAULT 0,
        typical_duration_days INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Lead Pipeline
      `CREATE TABLE IF NOT EXISTS lead_pipeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        stage_id INTEGER NOT NULL,
        entered_stage_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expected_close_date DATE,
        expected_value REAL,
        notes TEXT,
        FOREIGN KEY (lead_id) REFERENCES leads(id),
        FOREIGN KEY (stage_id) REFERENCES pipeline_stages(id)
      )`,
      
      // Approval rules table
      `CREATE TABLE IF NOT EXISTS approval_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_name TEXT NOT NULL,
        rule_type TEXT NOT NULL,
        threshold_value REAL,
        threshold_percentage REAL,
        approval_level TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Pricing approvals table
      `CREATE TABLE IF NOT EXISTS pricing_approvals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quote_id INTEGER,
        customer_name TEXT,
        original_price REAL NOT NULL,
        requested_price REAL NOT NULL,
        discount_amount REAL DEFAULT 0,
        discount_percentage REAL DEFAULT 0,
        reason_code TEXT,
        justification TEXT,
        requested_by INTEGER,
        approval_level_required TEXT,
        status TEXT DEFAULT 'pending',
        approved_by INTEGER,
        approved_at DATETIME,
        expires_at DATETIME DEFAULT (datetime('now', '+7 days')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requested_by) REFERENCES users(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )`,
      
      // Approval steps table
      `CREATE TABLE IF NOT EXISTS approval_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        approval_id INTEGER NOT NULL,
        step_level TEXT NOT NULL,
        assigned_to INTEGER,
        status TEXT DEFAULT 'pending',
        decision TEXT,
        comments TEXT,
        decided_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (approval_id) REFERENCES pricing_approvals(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )`,
      
      // Competitor pricing table
      `CREATE TABLE IF NOT EXISTS competitor_pricing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competitor_name TEXT NOT NULL,
        service_type TEXT,
        price REAL NOT NULL,
        market_area TEXT,
        notes TEXT,
        valid_until DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const query of tables) {
      await this.run(query);
    }

    // Insert default pipeline stages
    await this.initializePipelineStages();
    
    // Create default admin user
    await this.createDefaultAdmin();
  }

  async initializePipelineStages() {
    const stages = [
      { name: 'New Lead', order_index: 1, probability: 0.1, typical_duration_days: 1 },
      { name: 'Qualified', order_index: 2, probability: 0.25, typical_duration_days: 3 },
      { name: 'Proposal Sent', order_index: 3, probability: 0.5, typical_duration_days: 7 },
      { name: 'Negotiation', order_index: 4, probability: 0.75, typical_duration_days: 5 },
      { name: 'Closed Won', order_index: 5, probability: 1.0, typical_duration_days: 0 },
      { name: 'Closed Lost', order_index: 6, probability: 0, typical_duration_days: 0 }
    ];

    const existing = await this.get('SELECT COUNT(*) as count FROM pipeline_stages');
    if (existing.count === 0) {
      for (const stage of stages) {
        await this.run(
          'INSERT INTO pipeline_stages (name, order_index, probability, typical_duration_days) VALUES (?, ?, ?, ?)',
          [stage.name, stage.order_index, stage.probability, stage.typical_duration_days]
        );
      }
    }
  }

  async createDefaultAdmin() {
    const existing = await this.get('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
    if (existing.count === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await this.run(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['admin', 'admin@invisiblefence.com', hashedPassword, 'admin']
      );
      console.log('Default admin user created (username: admin, password: admin123)');
    }
  }

  // Database helper methods
  async run(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  async get(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async all(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Customer methods
  async createCustomer(customerData) {
    const query = `
      INSERT INTO customers (
        first_name, last_name, email, phone, address, city, state, zip,
        pet_name, pet_type, fence_type, installation_date, tier, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      customerData.first_name, customerData.last_name, customerData.email,
      customerData.phone, customerData.address, customerData.city,
      customerData.state, customerData.zip, customerData.pet_name,
      customerData.pet_type, customerData.fence_type, customerData.installation_date,
      customerData.tier || 'Essentials', customerData.status || 'active'
    ];
    return await this.run(query, params);
  }

  async getCustomers(limit = 100, offset = 0) {
    const query = `
      SELECT * FROM customers 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    return await this.all(query, [limit, offset]);
  }

  async getCustomerById(id) {
    return await this.get('SELECT * FROM customers WHERE id = ?', [id]);
  }

  async updateCustomer(id, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    const query = `UPDATE customers SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    return await this.run(query, values);
  }

  // Lead methods
  async createLead(leadData) {
    const query = `
      INSERT INTO leads (
        first_name, last_name, email, phone, source, status, score,
        estimated_value, assigned_to, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      leadData.first_name, leadData.last_name, leadData.email,
      leadData.phone, leadData.source, leadData.status || 'new',
      leadData.score || 0, leadData.estimated_value, leadData.assigned_to,
      leadData.notes
    ];
    const result = await this.run(query, params);
    
    // Add to pipeline
    if (result.id) {
      await this.run(
        'INSERT INTO lead_pipeline (lead_id, stage_id) VALUES (?, 1)',
        [result.id]
      );
    }
    
    return result;
  }

  async getLeads(status = null) {
    let query = `
      SELECT l.*, ps.name as stage_name, u.username as assigned_to_name
      FROM leads l
      LEFT JOIN lead_pipeline lp ON l.id = lp.lead_id
      LEFT JOIN pipeline_stages ps ON lp.stage_id = ps.id
      LEFT JOIN users u ON l.assigned_to = u.id
    `;
    
    const params = [];
    if (status) {
      query += ' WHERE l.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY l.created_at DESC';
    return await this.all(query, params);
  }

  async moveLeadStage(leadId, newStageId) {
    await this.run(
      'UPDATE lead_pipeline SET stage_id = ?, entered_stage_at = CURRENT_TIMESTAMP WHERE lead_id = ?',
      [newStageId, leadId]
    );
    
    // Update lead status based on stage
    const stage = await this.get('SELECT name FROM pipeline_stages WHERE id = ?', [newStageId]);
    if (stage.name === 'Closed Won') {
      await this.run('UPDATE leads SET status = ? WHERE id = ?', ['converted', leadId]);
    } else if (stage.name === 'Closed Lost') {
      await this.run('UPDATE leads SET status = ? WHERE id = ?', ['lost', leadId]);
    }
  }

  // Interaction methods
  async logInteraction(interactionData) {
    const query = `
      INSERT INTO interactions (
        customer_id, lead_id, user_id, type, subject, description,
        outcome, next_action, next_action_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      interactionData.customer_id, interactionData.lead_id, interactionData.user_id,
      interactionData.type, interactionData.subject, interactionData.description,
      interactionData.outcome, interactionData.next_action, interactionData.next_action_date
    ];
    return await this.run(query, params);
  }

  async getInteractions(customerId = null, leadId = null) {
    let query = `
      SELECT i.*, u.username 
      FROM interactions i
      LEFT JOIN users u ON i.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (customerId) {
      query += ' AND customer_id = ?';
      params.push(customerId);
    }
    if (leadId) {
      query += ' AND lead_id = ?';
      params.push(leadId);
    }
    
    query += ' ORDER BY created_at DESC';
    return await this.all(query, params);
  }

  // Appointment methods
  async createAppointment(appointmentData) {
    const query = `
      INSERT INTO appointments (
        customer_id, lead_id, technician_id, type, scheduled_date,
        duration_minutes, status, address, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      appointmentData.customer_id, appointmentData.lead_id, appointmentData.technician_id,
      appointmentData.type, appointmentData.scheduled_date, appointmentData.duration_minutes || 60,
      appointmentData.status || 'scheduled', appointmentData.address, appointmentData.notes
    ];
    return await this.run(query, params);
  }

  async getAppointments(date = null, technicianId = null) {
    let query = `
      SELECT a.*, c.first_name || ' ' || c.last_name as customer_name,
             l.first_name || ' ' || l.last_name as lead_name,
             u.username as technician_name
      FROM appointments a
      LEFT JOIN customers c ON a.customer_id = c.id
      LEFT JOIN leads l ON a.lead_id = l.id
      LEFT JOIN users u ON a.technician_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (date) {
      query += ' AND DATE(scheduled_date) = DATE(?)';
      params.push(date);
    }
    if (technicianId) {
      query += ' AND technician_id = ?';
      params.push(technicianId);
    }
    
    query += ' ORDER BY scheduled_date ASC';
    return await this.all(query, params);
  }

  // Analytics methods
  async getCustomerMetrics() {
    const metrics = await this.get(`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_customers,
        SUM(monthly_revenue) as total_monthly_revenue,
        AVG(lifetime_value) as avg_lifetime_value,
        COUNT(CASE WHEN tier = 'Essentials' THEN 1 END) as essentials_count,
        COUNT(CASE WHEN tier = 'Professional' THEN 1 END) as professional_count,
        COUNT(CASE WHEN tier = 'Enterprise' THEN 1 END) as enterprise_count
      FROM customers
    `);
    return metrics;
  }

  async getLeadMetrics() {
    const metrics = await this.get(`
      SELECT 
        COUNT(*) as total_leads,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new_leads,
        COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified_leads,
        COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_leads,
        AVG(score) as avg_lead_score,
        SUM(estimated_value) as total_pipeline_value
      FROM leads
    `);
    return metrics;
  }

  async saveROICalculation(calculation) {
    const query = `
      INSERT INTO roi_calculations (
        tier, base_price, admin_hours, admin_cost, travel_hours,
        revenue_leakage_percent, payment_delays, upsell_revenue,
        predictive_maintenance, monthly_roi, annual_roi, payback_period,
        total_roi_percent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      calculation.tier, calculation.basePrice, calculation.adminHours,
      calculation.adminCost, calculation.travelHours, calculation.revenuLeakagePercent,
      calculation.paymentDelays, calculation.upsellRevenue, calculation.predictiveMaintenance,
      calculation.monthlyROI, calculation.annualROI, calculation.paybackPeriod,
      calculation.totalROI
    ];
    return await this.run(query, params);
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = DatabaseService;