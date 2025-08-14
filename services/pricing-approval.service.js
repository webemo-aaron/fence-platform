const DatabaseService = require('./database.service');

class PricingApprovalService extends DatabaseService {
  constructor() {
    super();
    this.approvalThresholds = {
      quote_amount: 15000,        // Quotes over $15k need approval
      discount_percentage: 20,    // Discounts over 20% need approval
      markup_variance: 15,        // Markup variance over 15% from standard
      custom_pricing: true        // All custom pricing requires approval
    };
  }

  async initialize() {
    await super.initialize();
    await this.createApprovalTables();
  }

  async createApprovalTables() {
    const tables = [
      // Approval rules table
      `CREATE TABLE IF NOT EXISTS approval_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_name TEXT NOT NULL,
        rule_type TEXT NOT NULL, -- 'quote_amount', 'discount', 'markup', 'custom'
        threshold_value REAL,
        threshold_percentage REAL,
        approval_level TEXT NOT NULL, -- 'manager', 'director', 'owner'
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
        reason_code TEXT, -- 'competitor_match', 'volume_discount', 'loyalty', 'custom'
        justification TEXT,
        requested_by INTEGER,
        approval_level_required TEXT,
        status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
        approved_by INTEGER,
        approved_at DATETIME,
        expires_at DATETIME DEFAULT (datetime('now', '+7 days')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quote_id) REFERENCES quote_history(id),
        FOREIGN KEY (requested_by) REFERENCES users(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )`,
      
      // Approval workflow steps
      `CREATE TABLE IF NOT EXISTS approval_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        approval_id INTEGER NOT NULL,
        step_order INTEGER NOT NULL,
        approver_level TEXT NOT NULL,
        approver_id INTEGER,
        status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'skipped'
        comments TEXT,
        completed_at DATETIME,
        FOREIGN KEY (approval_id) REFERENCES pricing_approvals(id),
        FOREIGN KEY (approver_id) REFERENCES users(id)
      )`,
      
      // Competitor pricing table
      `CREATE TABLE IF NOT EXISTS competitor_pricing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competitor_name TEXT NOT NULL,
        service_area TEXT,
        base_installation_price REAL,
        monthly_service_price REAL,
        property_type TEXT,
        fence_perimeter_range TEXT,
        pricing_date DATE DEFAULT (date('now')),
        source TEXT, -- 'quote_match', 'market_research', 'customer_report'
        verified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Pricing variance alerts
      `CREATE TABLE IF NOT EXISTS pricing_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_type TEXT NOT NULL,
        quote_id INTEGER,
        alert_message TEXT,
        severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
        auto_resolved BOOLEAN DEFAULT 0,
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (quote_id) REFERENCES quote_history(id)
      )`
    ];

    for (const query of tables) {
      await this.db.run(query);
    }

    await this.seedApprovalData();
  }

  async seedApprovalData() {
    // Check if approval rules exist
    const existing = await this.db.get('SELECT COUNT(*) as count FROM approval_rules');
    if (existing.count > 0) return;

    // Seed approval rules
    const rules = [
      {
        rule_name: 'High Value Quote Approval',
        rule_type: 'quote_amount',
        threshold_value: 15000,
        approval_level: 'manager'
      },
      {
        rule_name: 'Large Discount Approval',
        rule_type: 'discount',
        threshold_percentage: 20,
        approval_level: 'manager'
      },
      {
        rule_name: 'Massive Discount Approval',
        rule_type: 'discount',
        threshold_percentage: 35,
        approval_level: 'director'
      },
      {
        rule_name: 'Custom Pricing Approval',
        rule_type: 'custom',
        approval_level: 'manager'
      },
      {
        rule_name: 'Extreme Value Quote',
        rule_type: 'quote_amount',
        threshold_value: 50000,
        approval_level: 'owner'
      }
    ];

    for (const rule of rules) {
      await this.db.run(`
        INSERT INTO approval_rules (
          rule_name, rule_type, threshold_value, threshold_percentage, approval_level
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        rule.rule_name, rule.rule_type, 
        rule.threshold_value || null, rule.threshold_percentage || null, 
        rule.approval_level
      ]);
    }

    // Seed some competitor pricing data
    const competitors = [
      {
        competitor_name: 'PetSafe',
        service_area: 'Dallas Metro',
        base_installation_price: 1299,
        monthly_service_price: 49,
        property_type: 'Standard Residential'
      },
      {
        competitor_name: 'DogWatch',
        service_area: 'Houston Metro',
        base_installation_price: 1450,
        monthly_service_price: 45,
        property_type: 'Standard Residential'
      },
      {
        competitor_name: 'SportDOG',
        service_area: 'Austin Metro',
        base_installation_price: 1199,
        monthly_service_price: 39,
        property_type: 'Standard Residential'
      }
    ];

    for (const competitor of competitors) {
      await this.db.run(`
        INSERT INTO competitor_pricing (
          competitor_name, service_area, base_installation_price, 
          monthly_service_price, property_type, source
        ) VALUES (?, ?, ?, ?, ?, 'market_research')
      `, [
        competitor.competitor_name, competitor.service_area,
        competitor.base_installation_price, competitor.monthly_service_price,
        competitor.property_type
      ]);
    }
  }

  // Check if pricing requires approval
  async requiresApproval(quoteData, pricingResult) {
    const alerts = [];
    const triggers = [];

    // Check quote amount threshold
    const amountRules = await this.db.all(`
      SELECT * FROM approval_rules 
      WHERE rule_type = 'quote_amount' AND is_active = 1
      ORDER BY threshold_value ASC
    `);

    for (const rule of amountRules) {
      if (pricingResult.totals.one_time_installation >= rule.threshold_value) {
        triggers.push({
          rule_id: rule.id,
          rule_name: rule.rule_name,
          approval_level: rule.approval_level,
          reason: `Quote amount $${pricingResult.totals.one_time_installation.toLocaleString()} exceeds threshold of $${rule.threshold_value.toLocaleString()}`
        });
      }
    }

    // Check discount percentage
    const schedulingOptimization = pricingResult.scheduling_optimization || {};
    const discountPercentage = schedulingOptimization.potential_savings 
      ? (schedulingOptimization.potential_savings / pricingResult.totals.one_time_installation) * 100
      : 0;

    if (discountPercentage > 0) {
      const discountRules = await this.db.all(`
        SELECT * FROM approval_rules 
        WHERE rule_type = 'discount' AND is_active = 1
        ORDER BY threshold_percentage ASC
      `);

      for (const rule of discountRules) {
        if (discountPercentage >= rule.threshold_percentage) {
          triggers.push({
            rule_id: rule.id,
            rule_name: rule.rule_name,
            approval_level: rule.approval_level,
            reason: `Discount of ${discountPercentage.toFixed(1)}% exceeds threshold of ${rule.threshold_percentage}%`
          });
        }
      }
    }

    // Check for pricing anomalies
    const anomalies = await this.detectPricingAnomalies(quoteData, pricingResult);
    alerts.push(...anomalies);

    // Check against competitor pricing
    const competitorAnalysis = await this.analyzeCompetitorPricing(quoteData, pricingResult);
    if (competitorAnalysis.requiresReview) {
      triggers.push({
        rule_name: 'Competitor Pricing Review',
        approval_level: 'manager',
        reason: competitorAnalysis.reason
      });
    }

    return {
      requiresApproval: triggers.length > 0,
      triggers,
      alerts,
      competitorAnalysis,
      discountPercentage
    };
  }

  // Detect pricing anomalies
  async detectPricingAnomalies(quoteData, pricingResult) {
    const alerts = [];

    // Check for unusually high or low pricing
    const similarQuotes = await this.db.all(`
      SELECT total_price, property_type, fence_perimeter
      FROM quote_history
      WHERE property_type = ? 
        AND fence_perimeter BETWEEN ? AND ?
        AND created_at >= date('now', '-90 days')
    `, [
      quoteData.property_type,
      quoteData.fence_perimeter * 0.8,
      quoteData.fence_perimeter * 1.2
    ]);

    if (similarQuotes.length >= 3) {
      const avgPrice = similarQuotes.reduce((sum, q) => sum + q.total_price, 0) / similarQuotes.length;
      const currentPrice = pricingResult.totals.one_time_installation;
      const variance = Math.abs(currentPrice - avgPrice) / avgPrice * 100;

      if (variance > 25) {
        alerts.push({
          type: 'pricing_variance',
          severity: variance > 50 ? 'high' : 'medium',
          message: `Price variance of ${variance.toFixed(1)}% from similar quotes (avg: $${avgPrice.toLocaleString()})`
        });
      }
    }

    // Check for unusual property configurations
    if (quoteData.fence_perimeter > 2000 && quoteData.property_size < 10000) {
      alerts.push({
        type: 'configuration_anomaly',
        severity: 'medium',
        message: 'High fence perimeter relative to property size - verify measurements'
      });
    }

    return alerts;
  }

  // Analyze competitor pricing
  async analyzeCompetitorPricing(quoteData, pricingResult) {
    const competitors = await this.db.all(`
      SELECT * FROM competitor_pricing
      WHERE property_type = ? 
        AND pricing_date >= date('now', '-180 days')
      ORDER BY created_at DESC
    `, [quoteData.property_type]);

    if (competitors.length === 0) {
      return { requiresReview: false, reason: 'No competitor data available' };
    }

    const avgCompetitorPrice = competitors.reduce((sum, c) => sum + c.base_installation_price, 0) / competitors.length;
    const ourPrice = pricingResult.totals.one_time_installation;
    const priceDifference = ((ourPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100;

    const analysis = {
      avgCompetitorPrice,
      ourPrice,
      priceDifference,
      competitorCount: competitors.length,
      requiresReview: false,
      reason: ''
    };

    if (priceDifference > 20) {
      analysis.requiresReview = true;
      analysis.reason = `Our price is ${priceDifference.toFixed(1)}% higher than competitor average ($${avgCompetitorPrice.toLocaleString()})`;
    } else if (priceDifference < -15) {
      analysis.requiresReview = true;
      analysis.reason = `Our price is ${Math.abs(priceDifference).toFixed(1)}% lower than competitor average - verify profitability`;
    }

    return analysis;
  }

  // Create approval request
  async createApprovalRequest(quoteData, pricingResult, requestedBy, customPricing = null) {
    const approvalCheck = await this.requiresApproval(quoteData, pricingResult);
    
    if (!approvalCheck.requiresApproval && !customPricing) {
      return { requiresApproval: false, autoApproved: true };
    }

    const originalPrice = pricingResult.totals.one_time_installation;
    const requestedPrice = customPricing ? customPricing.requestedPrice : originalPrice;
    const discountAmount = originalPrice - requestedPrice;
    const discountPercentage = (discountAmount / originalPrice) * 100;

    // Determine highest approval level required
    const requiredLevel = this.getHighestApprovalLevel(approvalCheck.triggers);

    // Create approval request
    const result = await this.db.run(`
      INSERT INTO pricing_approvals (
        quote_id, customer_name, original_price, requested_price,
        discount_amount, discount_percentage, reason_code, justification,
        requested_by, approval_level_required
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      quoteData.quote_id || null,
      quoteData.customer_name || 'Unknown',
      originalPrice,
      requestedPrice,
      discountAmount,
      discountPercentage,
      customPricing ? customPricing.reasonCode : 'auto_generated',
      customPricing ? customPricing.justification : approvalCheck.triggers.map(t => t.reason).join('; '),
      requestedBy,
      requiredLevel
    ]);

    const approvalId = result.id;

    // Create approval workflow steps
    await this.createApprovalWorkflow(approvalId, requiredLevel);

    // Create pricing alerts
    for (const alert of approvalCheck.alerts) {
      await this.db.run(`
        INSERT INTO pricing_alerts (alert_type, quote_id, alert_message, severity)
        VALUES (?, ?, ?, ?)
      `, [alert.type, quoteData.quote_id || null, alert.message, alert.severity]);
    }

    return {
      requiresApproval: true,
      approvalId,
      approvalLevel: requiredLevel,
      triggers: approvalCheck.triggers,
      alerts: approvalCheck.alerts,
      estimatedApprovalTime: this.getEstimatedApprovalTime(requiredLevel)
    };
  }

  // Get highest approval level required
  getHighestApprovalLevel(triggers) {
    const levels = ['manager', 'director', 'owner'];
    let highestLevel = 'manager';

    for (const trigger of triggers) {
      const currentLevelIndex = levels.indexOf(trigger.approval_level);
      const highestLevelIndex = levels.indexOf(highestLevel);
      
      if (currentLevelIndex > highestLevelIndex) {
        highestLevel = trigger.approval_level;
      }
    }

    return highestLevel;
  }

  // Create approval workflow steps
  async createApprovalWorkflow(approvalId, requiredLevel) {
    const workflows = {
      manager: [{ level: 'manager', order: 1 }],
      director: [
        { level: 'manager', order: 1 },
        { level: 'director', order: 2 }
      ],
      owner: [
        { level: 'manager', order: 1 },
        { level: 'director', order: 2 },
        { level: 'owner', order: 3 }
      ]
    };

    const steps = workflows[requiredLevel] || workflows.manager;

    for (const step of steps) {
      await this.db.run(`
        INSERT INTO approval_steps (approval_id, step_order, approver_level)
        VALUES (?, ?, ?)
      `, [approvalId, step.order, step.level]);
    }
  }

  // Process approval decision
  async processApproval(approvalId, approverId, decision, comments = '') {
    const approval = await this.db.get(`
      SELECT * FROM pricing_approvals WHERE id = ?
    `, [approvalId]);

    if (!approval) {
      throw new Error('Approval request not found');
    }

    if (approval.status !== 'pending') {
      throw new Error('Approval request is no longer pending');
    }

    // Get current approval step
    const currentStep = await this.db.get(`
      SELECT * FROM approval_steps 
      WHERE approval_id = ? AND status = 'pending'
      ORDER BY step_order ASC
      LIMIT 1
    `, [approvalId]);

    if (!currentStep) {
      throw new Error('No pending approval steps found');
    }

    // Update current step
    await this.db.run(`
      UPDATE approval_steps 
      SET status = ?, approver_id = ?, comments = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [decision, approverId, comments, currentStep.id]);

    if (decision === 'rejected') {
      // Reject entire approval
      await this.db.run(`
        UPDATE pricing_approvals 
        SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [approverId, approvalId]);

      return { status: 'rejected', finalDecision: true };
    }

    // Check if there are more steps
    const nextStep = await this.db.get(`
      SELECT * FROM approval_steps 
      WHERE approval_id = ? AND status = 'pending'
      ORDER BY step_order ASC
      LIMIT 1
    `, [approvalId]);

    if (!nextStep) {
      // All steps completed - approve
      await this.db.run(`
        UPDATE pricing_approvals 
        SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [approverId, approvalId]);

      return { status: 'approved', finalDecision: true };
    }

    return { status: 'approved', finalDecision: false, nextApprovalLevel: nextStep.approver_level };
  }

  // Get pending approvals for user level
  async getPendingApprovals(userLevel) {
    const approvals = await this.db.all(`
      SELECT 
        pa.*,
        ast.step_order,
        ast.approver_level as current_level,
        u.username as requested_by_name
      FROM pricing_approvals pa
      JOIN approval_steps ast ON pa.id = ast.approval_id
      LEFT JOIN users u ON pa.requested_by = u.id
      WHERE pa.status = 'pending' 
        AND ast.status = 'pending'
        AND ast.approver_level = ?
        AND pa.expires_at > datetime('now')
      ORDER BY pa.created_at ASC
    `, [userLevel]);

    return approvals;
  }

  // Get approval history
  async getApprovalHistory(limit = 50) {
    const history = await this.db.all(`
      SELECT 
        pa.*,
        u1.username as requested_by_name,
        u2.username as approved_by_name,
        GROUP_CONCAT(
          ast.approver_level || ':' || ast.status || 
          CASE WHEN ast.comments THEN '(' || ast.comments || ')' ELSE '' END,
          ' → '
        ) as approval_chain
      FROM pricing_approvals pa
      LEFT JOIN users u1 ON pa.requested_by = u1.id
      LEFT JOIN users u2 ON pa.approved_by = u2.id
      LEFT JOIN approval_steps ast ON pa.id = ast.approval_id
      WHERE pa.status IN ('approved', 'rejected')
      GROUP BY pa.id
      ORDER BY pa.approved_at DESC
      LIMIT ?
    `, [limit]);

    return history;
  }

  // Get estimated approval time
  getEstimatedApprovalTime(approvalLevel) {
    const estimates = {
      manager: '2-4 hours',
      director: '4-8 hours',
      owner: '1-2 business days'
    };

    return estimates[approvalLevel] || '2-4 hours';
  }

  // Update competitor pricing
  async updateCompetitorPricing(competitorData) {
    const result = await this.db.run(`
      INSERT INTO competitor_pricing (
        competitor_name, service_area, base_installation_price,
        monthly_service_price, property_type, fence_perimeter_range,
        source, verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      competitorData.competitor_name,
      competitorData.service_area,
      competitorData.base_installation_price,
      competitorData.monthly_service_price,
      competitorData.property_type,
      competitorData.fence_perimeter_range,
      competitorData.source,
      competitorData.verified ? 1 : 0
    ]);

    return result.id;
  }

  // Get pricing analytics for approval system
  async getApprovalAnalytics() {
    const pendingCount = await this.db.get(`
      SELECT COUNT(*) as count FROM pricing_approvals 
      WHERE status = 'pending' AND expires_at > datetime('now')
    `);

    const avgApprovalTime = await this.db.get(`
      SELECT AVG(
        (julianday(approved_at) - julianday(created_at)) * 24
      ) as avg_hours
      FROM pricing_approvals 
      WHERE status = 'approved' AND approved_at >= date('now', '-30 days')
    `);

    const approvalRate = await this.db.get(`
      SELECT 
        COUNT(CASE WHEN status = 'approved' THEN 1 END) * 100.0 / COUNT(*) as rate
      FROM pricing_approvals 
      WHERE created_at >= date('now', '-30 days')
        AND status IN ('approved', 'rejected')
    `);

    const topReasons = await this.db.all(`
      SELECT reason_code, COUNT(*) as count
      FROM pricing_approvals
      WHERE created_at >= date('now', '-30 days')
      GROUP BY reason_code
      ORDER BY count DESC
      LIMIT 5
    `);

    return {
      pendingApprovals: pendingCount.count,
      avgApprovalTimeHours: Math.round(avgApprovalTime.avg_hours * 10) / 10,
      approvalRate: Math.round(approvalRate.rate * 10) / 10,
      topReasons
    };
  }
}

module.exports = PricingApprovalService;