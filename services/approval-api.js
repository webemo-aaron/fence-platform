const express = require('express');
const PricingApprovalService = require('./pricing-approval.service');

const router = express.Router();
const approvalService = new PricingApprovalService();

// Initialize the service
approvalService.initialize().catch(console.error);

// =================
// Approval Request Routes
// =================

// Check if pricing requires approval
router.post('/check', async (req, res) => {
  try {
    const { quoteData, pricingResult } = req.body;
    
    const approvalCheck = await approvalService.requiresApproval(quoteData, pricingResult);
    res.json(approvalCheck);
  } catch (error) {
    console.error('Error checking approval requirements:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create approval request
router.post('/request', async (req, res) => {
  try {
    const { quoteData, pricingResult, requestedBy, customPricing } = req.body;
    
    const approvalRequest = await approvalService.createApprovalRequest(
      quoteData, pricingResult, requestedBy, customPricing
    );
    
    res.json(approvalRequest);
  } catch (error) {
    console.error('Error creating approval request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process approval decision
router.post('/:id/decision', async (req, res) => {
  try {
    const { decision, comments, approverId } = req.body;
    const approvalId = req.params.id;
    
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be "approved" or "rejected"' });
    }
    
    const result = await approvalService.processApproval(
      approvalId, approverId, decision, comments
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error processing approval:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get approval details
router.get('/:id', async (req, res) => {
  try {
    const approval = await approvalService.db.get(`
      SELECT 
        pa.*,
        u1.username as requested_by_name,
        u2.username as approved_by_name
      FROM pricing_approvals pa
      LEFT JOIN users u1 ON pa.requested_by = u1.id
      LEFT JOIN users u2 ON pa.approved_by = u2.id
      WHERE pa.id = ?
    `, [req.params.id]);

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    // Get approval steps
    const steps = await approvalService.db.all(`
      SELECT 
        ast.*,
        u.username as approver_name
      FROM approval_steps ast
      LEFT JOIN users u ON ast.approver_id = u.id
      WHERE ast.approval_id = ?
      ORDER BY ast.step_order
    `, [req.params.id]);

    res.json({ ...approval, steps });
  } catch (error) {
    console.error('Error fetching approval details:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Pending Approvals Dashboard
// =================

// Get pending approvals for user level
router.get('/pending/:userLevel', async (req, res) => {
  try {
    const userLevel = req.params.userLevel;
    const pendingApprovals = await approvalService.getPendingApprovals(userLevel);
    
    res.json(pendingApprovals);
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all pending approvals (admin view)
router.get('/pending', async (req, res) => {
  try {
    const allPending = await approvalService.db.all(`
      SELECT 
        pa.*,
        ast.approver_level as current_level,
        ast.step_order,
        u.username as requested_by_name,
        CASE 
          WHEN pa.expires_at < datetime('now') THEN 'expired'
          WHEN ast.approver_level = 'manager' THEN 'manager_review'
          WHEN ast.approver_level = 'director' THEN 'director_review'
          WHEN ast.approver_level = 'owner' THEN 'owner_review'
          ELSE 'unknown'
        END as status_category
      FROM pricing_approvals pa
      JOIN approval_steps ast ON pa.id = ast.approval_id
      LEFT JOIN users u ON pa.requested_by = u.id
      WHERE pa.status = 'pending' AND ast.status = 'pending'
      ORDER BY pa.created_at ASC
    `);

    res.json(allPending);
  } catch (error) {
    console.error('Error fetching all pending approvals:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Approval History
// =================

// Get approval history
router.get('/history/list', async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    
    let whereClause = '';
    let params = [];
    
    if (status && ['approved', 'rejected', 'expired'].includes(status)) {
      whereClause = 'WHERE pa.status = ?';
      params.push(status);
    }
    
    const history = await approvalService.db.all(`
      SELECT 
        pa.*,
        u1.username as requested_by_name,
        u2.username as approved_by_name
      FROM pricing_approvals pa
      LEFT JOIN users u1 ON pa.requested_by = u1.id
      LEFT JOIN users u2 ON pa.approved_by = u2.id
      ${whereClause}
      ORDER BY pa.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json(history);
  } catch (error) {
    console.error('Error fetching approval history:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Competitor Pricing Management
// =================

// Get competitor pricing data
router.get('/competitors/pricing', async (req, res) => {
  try {
    const { service_area, property_type } = req.query;
    
    let query = 'SELECT * FROM competitor_pricing';
    let params = [];
    const conditions = [];
    
    if (service_area) {
      conditions.push('service_area = ?');
      params.push(service_area);
    }
    
    if (property_type) {
      conditions.push('property_type = ?');
      params.push(property_type);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY pricing_date DESC';
    
    const competitors = await approvalService.db.all(query, params);
    res.json(competitors);
  } catch (error) {
    console.error('Error fetching competitor pricing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add competitor pricing data
router.post('/competitors/pricing', async (req, res) => {
  try {
    const competitorId = await approvalService.updateCompetitorPricing(req.body);
    res.json({ success: true, competitor_id: competitorId });
  } catch (error) {
    console.error('Error adding competitor pricing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update competitor pricing verification
router.put('/competitors/pricing/:id/verify', async (req, res) => {
  try {
    const { verified } = req.body;
    
    await approvalService.db.run(`
      UPDATE competitor_pricing 
      SET verified = ?, pricing_date = date('now')
      WHERE id = ?
    `, [verified ? 1 : 0, req.params.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating competitor verification:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Approval Rules Management
// =================

// Get approval rules
router.get('/rules', async (req, res) => {
  try {
    const rules = await approvalService.db.all(`
      SELECT * FROM approval_rules 
      WHERE is_active = 1 
      ORDER BY rule_type, threshold_value, threshold_percentage
    `);
    
    res.json(rules);
  } catch (error) {
    console.error('Error fetching approval rules:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create approval rule
router.post('/rules', async (req, res) => {
  try {
    const { rule_name, rule_type, threshold_value, threshold_percentage, approval_level } = req.body;
    
    const result = await approvalService.db.run(`
      INSERT INTO approval_rules (
        rule_name, rule_type, threshold_value, threshold_percentage, approval_level
      ) VALUES (?, ?, ?, ?, ?)
    `, [rule_name, rule_type, threshold_value, threshold_percentage, approval_level]);

    res.json({ success: true, rule_id: result.id });
  } catch (error) {
    console.error('Error creating approval rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update approval rule
router.put('/rules/:id', async (req, res) => {
  try {
    const { rule_name, threshold_value, threshold_percentage, approval_level, is_active } = req.body;
    
    await approvalService.db.run(`
      UPDATE approval_rules 
      SET rule_name = ?, threshold_value = ?, threshold_percentage = ?, 
          approval_level = ?, is_active = ?
      WHERE id = ?
    `, [rule_name, threshold_value, threshold_percentage, approval_level, is_active ? 1 : 0, req.params.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating approval rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Analytics and Reporting
// =================

// Get approval analytics
router.get('/analytics/overview', async (req, res) => {
  try {
    const analytics = await approvalService.getApprovalAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching approval analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get pricing alerts
router.get('/alerts', async (req, res) => {
  try {
    const { severity, limit = 50 } = req.query;
    
    let query = `
      SELECT pa.*, qh.customer_name, qh.address
      FROM pricing_alerts pa
      LEFT JOIN quote_history qh ON pa.quote_id = qh.id
    `;
    let params = [];
    
    if (severity) {
      query += ' WHERE pa.severity = ?';
      params.push(severity);
    }
    
    query += ' ORDER BY pa.created_at DESC LIMIT ?';
    params.push(limit);
    
    const alerts = await approvalService.db.all(query, params);
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching pricing alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resolve pricing alert
router.put('/alerts/:id/resolve', async (req, res) => {
  try {
    await approvalService.db.run(`
      UPDATE pricing_alerts 
      SET auto_resolved = 1, resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.params.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Bulk Operations
// =================

// Expire old pending approvals
router.post('/maintenance/expire', async (req, res) => {
  try {
    const result = await approvalService.db.run(`
      UPDATE pricing_approvals 
      SET status = 'expired'
      WHERE status = 'pending' AND expires_at < datetime('now')
    `);

    res.json({ 
      success: true, 
      expired_count: result.changes,
      message: `Expired ${result.changes} old approval requests`
    });
  } catch (error) {
    console.error('Error expiring old approvals:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get approval summary for dashboard
router.get('/summary', async (req, res) => {
  try {
    const summary = await approvalService.db.get(`
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'approved' AND approved_at >= date('now', '-7 days') THEN 1 END) as approved_week,
        COUNT(CASE WHEN status = 'rejected' AND approved_at >= date('now', '-7 days') THEN 1 END) as rejected_week,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_count,
        AVG(CASE WHEN status = 'approved' THEN discount_percentage END) as avg_approved_discount,
        MAX(CASE WHEN status = 'pending' THEN requested_price END) as highest_pending_amount
      FROM pricing_approvals
      WHERE created_at >= date('now', '-30 days')
    `);

    const urgentCount = await approvalService.db.get(`
      SELECT COUNT(*) as count
      FROM pricing_approvals pa
      JOIN approval_steps ast ON pa.id = ast.approval_id
      WHERE pa.status = 'pending' 
        AND ast.status = 'pending'
        AND pa.requested_price > 20000
        AND pa.expires_at < datetime('now', '+2 days')
    `);

    res.json({
      ...summary,
      urgent_approvals: urgentCount.count
    });
  } catch (error) {
    console.error('Error fetching approval summary:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;