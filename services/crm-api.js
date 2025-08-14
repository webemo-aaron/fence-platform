const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const DatabaseService = require('./database.service');

const router = express.Router();
const db = new DatabaseService();

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'invisible-fence-secret-key-2024';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Initialize database
db.initialize().catch(console.error);

// =================
// Auth Routes
// =================

// Login
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await db.get(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Register
router.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;
    
    // Check if user exists
    const existing = await db.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.run(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, role]
    );

    res.json({
      success: true,
      userId: result.id,
      message: 'User registered successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================
// Customer Routes
// =================

// Get all customers
router.get('/customers', authenticateToken, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const customers = await db.getCustomers(parseInt(limit), parseInt(offset));
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer by ID
router.get('/customers/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await db.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create customer
router.post('/customers', authenticateToken, async (req, res) => {
  try {
    const result = await db.createCustomer(req.body);
    res.json({ success: true, customerId: result.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update customer
router.put('/customers/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.updateCustomer(req.params.id, req.body);
    res.json({ success: true, changes: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer interactions
router.get('/customers/:id/interactions', authenticateToken, async (req, res) => {
  try {
    const interactions = await db.getInteractions(req.params.id, null);
    res.json(interactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================
// Lead Routes
// =================

// Get all leads
router.get('/leads', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const leads = await db.getLeads(status);
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create lead
router.post('/leads', authenticateToken, async (req, res) => {
  try {
    const leadData = {
      ...req.body,
      assigned_to: req.body.assigned_to || req.user.id
    };
    const result = await db.createLead(leadData);
    res.json({ success: true, leadId: result.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update lead stage
router.put('/leads/:id/stage', authenticateToken, async (req, res) => {
  try {
    const { stageId } = req.body;
    await db.moveLeadStage(req.params.id, stageId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Convert lead to customer
router.post('/leads/:id/convert', authenticateToken, async (req, res) => {
  try {
    const lead = await db.get('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Create customer from lead
    const customerData = {
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      ...req.body // Additional customer data
    };

    const result = await db.createCustomer(customerData);
    
    // Update lead status
    await db.run('UPDATE leads SET status = ? WHERE id = ?', ['converted', req.params.id]);
    
    // Move to closed won stage
    await db.moveLeadStage(req.params.id, 5);

    res.json({ 
      success: true, 
      customerId: result.id,
      message: 'Lead converted to customer successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================
// Interaction Routes
// =================

// Log interaction
router.post('/interactions', authenticateToken, async (req, res) => {
  try {
    const interactionData = {
      ...req.body,
      user_id: req.user.id
    };
    const result = await db.logInteraction(interactionData);
    res.json({ success: true, interactionId: result.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get interactions
router.get('/interactions', authenticateToken, async (req, res) => {
  try {
    const { customerId, leadId } = req.query;
    const interactions = await db.getInteractions(customerId, leadId);
    res.json(interactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================
// Appointment Routes
// =================

// Create appointment
router.post('/appointments', authenticateToken, async (req, res) => {
  try {
    const result = await db.createAppointment(req.body);
    res.json({ success: true, appointmentId: result.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get appointments
router.get('/appointments', authenticateToken, async (req, res) => {
  try {
    const { date, technicianId } = req.query;
    const appointments = await db.getAppointments(date, technicianId);
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update appointment status
router.put('/appointments/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    await db.run(
      'UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================
// Analytics Routes
// =================

// Get dashboard metrics
router.get('/analytics/dashboard', authenticateToken, async (req, res) => {
  try {
    const [customerMetrics, leadMetrics] = await Promise.all([
      db.getCustomerMetrics(),
      db.getLeadMetrics()
    ]);

    // Get recent activities
    const recentInteractions = await db.all(`
      SELECT i.*, u.username, c.first_name || ' ' || c.last_name as customer_name
      FROM interactions i
      LEFT JOIN users u ON i.user_id = u.id
      LEFT JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at DESC
      LIMIT 10
    `);

    // Get upcoming appointments
    const upcomingAppointments = await db.all(`
      SELECT a.*, c.first_name || ' ' || c.last_name as customer_name,
             u.username as technician_name
      FROM appointments a
      LEFT JOIN customers c ON a.customer_id = c.id
      LEFT JOIN users u ON a.technician_id = u.id
      WHERE a.scheduled_date >= datetime('now')
        AND a.status = 'scheduled'
      ORDER BY a.scheduled_date ASC
      LIMIT 10
    `);

    res.json({
      customers: customerMetrics,
      leads: leadMetrics,
      recentInteractions,
      upcomingAppointments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get pipeline analytics
router.get('/analytics/pipeline', authenticateToken, async (req, res) => {
  try {
    const pipeline = await db.all(`
      SELECT ps.*, 
             COUNT(lp.lead_id) as lead_count,
             SUM(l.estimated_value) as total_value
      FROM pipeline_stages ps
      LEFT JOIN lead_pipeline lp ON ps.id = lp.stage_id
      LEFT JOIN leads l ON lp.lead_id = l.id
      GROUP BY ps.id
      ORDER BY ps.order_index
    `);

    res.json(pipeline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get revenue analytics
router.get('/analytics/revenue', authenticateToken, async (req, res) => {
  try {
    const revenue = await db.all(`
      SELECT 
        tier,
        COUNT(*) as customer_count,
        SUM(monthly_revenue) as monthly_revenue,
        SUM(lifetime_value) as total_lifetime_value,
        AVG(lifetime_value) as avg_lifetime_value
      FROM customers
      WHERE status = 'active'
      GROUP BY tier
    `);

    const totalRevenue = await db.get(`
      SELECT 
        SUM(monthly_revenue) as total_monthly,
        SUM(monthly_revenue) * 12 as total_annual,
        COUNT(*) as total_customers
      FROM customers
      WHERE status = 'active'
    `);

    res.json({
      byTier: revenue,
      total: totalRevenue
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save ROI calculation
router.post('/analytics/roi', authenticateToken, async (req, res) => {
  try {
    const result = await db.saveROICalculation(req.body);
    res.json({ success: true, calculationId: result.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ROI history
router.get('/analytics/roi/history', authenticateToken, async (req, res) => {
  try {
    const history = await db.all(`
      SELECT * FROM roi_calculations
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;