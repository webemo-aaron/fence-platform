/**
 * Enterprise Tenant Progression Engine
 * AI-driven system for natural progression through service tiers
 * Allows tenants to dynamically upgrade/downgrade based on comfort and usage
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

class TenantProgressionEngine {
  constructor(databaseUrl) {
    this.db = new Pool({ connectionString: databaseUrl });
    
    // Service progression tiers
    this.serviceTiers = {
      starter: {
        name: 'Starter Package',
        description: 'Basic fence business management',
        services: ['auth-service', 'customer-portal', 'frontend-service'],
        monthlyPrice: 49,
        features: [
          'Basic customer management',
          'Simple quote generation',
          'Standard support'
        ],
        automationLevel: 0.2
      },
      essential: {
        name: 'Essential Pro',
        description: 'Enhanced operations with basic automation',
        services: ['auth-service', 'customer-portal', 'pricing-service', 'notification-service', 'frontend-service'],
        monthlyPrice: 149,
        features: [
          'Advanced pricing engine',
          'Automated notifications',
          'ROI calculations',
          'Priority support'
        ],
        automationLevel: 0.5,
        prerequisites: {
          minMonthsOnPrevious: 1,
          minTransactions: 10,
          comfortScore: 0.7
        }
      },
      professional: {
        name: 'Professional Suite',
        description: 'Full-featured with location intelligence',
        services: ['auth-service', 'customer-portal', 'pricing-service', 'notification-service', 'crm-service', 'maps-service', 'storage-service', 'frontend-service'],
        monthlyPrice: 299,
        features: [
          'Complete CRM integration',
          'Google Maps integration',
          'Advanced analytics',
          'Document management',
          '24/7 support'
        ],
        automationLevel: 0.75,
        prerequisites: {
          minMonthsOnPrevious: 2,
          minTransactions: 50,
          comfortScore: 0.8,
          avgSessionLength: 300 // 5 minutes
        }
      },
      enterprise: {
        name: 'Enterprise AI',
        description: 'Full automation with AI orchestration',
        services: Object.keys(require('./service-definitions.json')),
        monthlyPrice: 599,
        features: [
          'Full workflow automation',
          'AI-powered orchestration',
          'Predictive analytics',
          'Custom integrations',
          'Dedicated account manager'
        ],
        automationLevel: 0.95,
        prerequisites: {
          minMonthsOnPrevious: 3,
          minTransactions: 200,
          comfortScore: 0.9,
          avgSessionLength: 600, // 10 minutes
          revenueGrowth: 0.25 // 25% revenue growth
        }
      }
    };
  }

  async initialize() {
    await this.createProgressionTables();
  }

  async createProgressionTables() {
    const createTenantProgressionTable = `
      CREATE TABLE IF NOT EXISTS tenant_progression (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        current_tier VARCHAR(50) NOT NULL DEFAULT 'starter',
        previous_tier VARCHAR(50),
        progression_score DECIMAL(3,2) DEFAULT 0.0,
        comfort_score DECIMAL(3,2) DEFAULT 0.0,
        usage_metrics JSONB DEFAULT '{}',
        tier_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_evaluation_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        next_evaluation_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '7 days',
        auto_progression_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createProgressionEventsTable = `
      CREATE TABLE IF NOT EXISTS progression_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB,
        comfort_impact DECIMAL(3,2) DEFAULT 0.0,
        progression_impact DECIMAL(3,2) DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createTierRecommendationsTable = `
      CREATE TABLE IF NOT EXISTS tier_recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        current_tier VARCHAR(50),
        recommended_tier VARCHAR(50),
        recommendation_reason TEXT,
        confidence_score DECIMAL(3,2),
        benefits TEXT[],
        risks TEXT[],
        estimated_roi DECIMAL(10,2),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days'
      );
    `;

    await this.db.query(createTenantProgressionTable);
    await this.db.query(createProgressionEventsTable);
    await this.db.query(createTierRecommendationsTable);
  }

  /**
   * Track user interaction events to build comfort and progression scores
   */
  async trackEvent(tenantId, eventType, eventData = {}) {
    const comfortImpact = this.calculateComfortImpact(eventType, eventData);
    const progressionImpact = this.calculateProgressionImpact(eventType, eventData);

    const query = `
      INSERT INTO progression_events (
        tenant_id, event_type, event_data, comfort_impact, progression_impact
      ) VALUES ($1, $2, $3, $4, $5)
    `;

    await this.db.query(query, [
      tenantId,
      eventType,
      JSON.stringify(eventData),
      comfortImpact,
      progressionImpact
    ]);

    // Update tenant progression scores
    await this.updateProgressionScores(tenantId);
  }

  calculateComfortImpact(eventType, eventData) {
    const impacts = {
      'feature_used': 0.1,
      'feature_completed': 0.2,
      'automation_accepted': 0.3,
      'automation_rejected': -0.1,
      'help_requested': -0.05,
      'error_encountered': -0.15,
      'positive_feedback': 0.25,
      'negative_feedback': -0.2,
      'session_completed': 0.05,
      'long_session': 0.1, // > 10 minutes
      'quick_completion': 0.15, // Task completed quickly
      'repeat_usage': 0.2 // Using same feature repeatedly
    };

    return impacts[eventType] || 0;
  }

  calculateProgressionImpact(eventType, eventData) {
    const impacts = {
      'quote_generated': 0.1,
      'customer_added': 0.15,
      'invoice_sent': 0.2,
      'payment_received': 0.25,
      'automation_workflow_completed': 0.3,
      'integration_successful': 0.35,
      'revenue_milestone': 0.4,
      'efficiency_improved': 0.3
    };

    return impacts[eventType] || 0;
  }

  async updateProgressionScores(tenantId) {
    // Calculate comfort score (last 30 days)
    const comfortQuery = `
      SELECT AVG(comfort_impact) as avg_comfort
      FROM progression_events 
      WHERE tenant_id = $1 
      AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
    `;

    // Calculate progression score (last 90 days)
    const progressionQuery = `
      SELECT AVG(progression_impact) as avg_progression
      FROM progression_events 
      WHERE tenant_id = $1 
      AND created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'
    `;

    const [comfortResult, progressionResult] = await Promise.all([
      this.db.query(comfortQuery, [tenantId]),
      this.db.query(progressionQuery, [tenantId])
    ]);

    const comfortScore = Math.max(0, Math.min(1, 
      (comfortResult.rows[0]?.avg_comfort || 0) + 0.5
    ));
    
    const progressionScore = Math.max(0, Math.min(1, 
      (progressionResult.rows[0]?.avg_progression || 0) + 0.3
    ));

    // Update tenant progression
    const updateQuery = `
      UPDATE tenant_progression 
      SET 
        comfort_score = $2,
        progression_score = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1
    `;

    await this.db.query(updateQuery, [tenantId, comfortScore, progressionScore]);

    // Check if ready for tier recommendation
    await this.evaluateTierProgression(tenantId);
  }

  async evaluateTierProgression(tenantId) {
    const query = `
      SELECT * FROM tenant_progression 
      WHERE tenant_id = $1
    `;
    
    const result = await this.db.query(query, [tenantId]);
    if (!result.rows.length) return;

    const progression = result.rows[0];
    const currentTier = this.serviceTiers[progression.current_tier];
    
    // Get usage metrics
    const usageMetrics = await this.getUsageMetrics(tenantId);
    
    // Find next appropriate tier
    const tiers = Object.keys(this.serviceTiers);
    const currentIndex = tiers.indexOf(progression.current_tier);
    
    for (let i = currentIndex + 1; i < tiers.length; i++) {
      const nextTierKey = tiers[i];
      const nextTier = this.serviceTiers[nextTierKey];
      
      if (this.isReadyForTier(progression, usageMetrics, nextTier)) {
        await this.createTierRecommendation(tenantId, progression.current_tier, nextTierKey, usageMetrics);
        break;
      }
    }
  }

  isReadyForTier(progression, usageMetrics, targetTier) {
    if (!targetTier.prerequisites) return true;

    const prereqs = targetTier.prerequisites;
    
    // Check minimum time on current tier
    const monthsOnCurrent = this.getMonthsSince(progression.tier_started_at);
    if (monthsOnCurrent < prereqs.minMonthsOnPrevious) return false;

    // Check comfort score
    if (progression.comfort_score < prereqs.comfortScore) return false;

    // Check usage metrics
    if (prereqs.minTransactions && usageMetrics.transactions < prereqs.minTransactions) return false;
    if (prereqs.avgSessionLength && usageMetrics.avgSessionLength < prereqs.avgSessionLength) return false;
    if (prereqs.revenueGrowth && usageMetrics.revenueGrowth < prereqs.revenueGrowth) return false;

    return true;
  }

  async getUsageMetrics(tenantId) {
    // This would connect to your analytics database
    // For now, returning simulated data
    const query = `
      SELECT 
        COUNT(CASE WHEN event_type LIKE '%transaction%' THEN 1 END) as transactions,
        AVG(EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at)))) as avg_session_length,
        COUNT(DISTINCT DATE(created_at)) as active_days
      FROM progression_events 
      WHERE tenant_id = $1 
      AND created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'
    `;

    const result = await this.db.query(query, [tenantId]);
    return {
      transactions: parseInt(result.rows[0]?.transactions || 0),
      avgSessionLength: parseInt(result.rows[0]?.avg_session_length || 0),
      activeDays: parseInt(result.rows[0]?.active_days || 0),
      revenueGrowth: Math.random() * 0.5 // Simulated - would come from business metrics
    };
  }

  async createTierRecommendation(tenantId, currentTier, recommendedTier, usageMetrics) {
    const recommendation = this.generateRecommendation(currentTier, recommendedTier, usageMetrics);
    
    const query = `
      INSERT INTO tier_recommendations (
        tenant_id, current_tier, recommended_tier, recommendation_reason,
        confidence_score, benefits, risks, estimated_roi
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await this.db.query(query, [
      tenantId,
      currentTier,
      recommendedTier,
      recommendation.reason,
      recommendation.confidence,
      recommendation.benefits,
      recommendation.risks,
      recommendation.estimatedROI
    ]);

    // Send notification to tenant about upgrade opportunity
    await this.notifyTenantOfRecommendation(tenantId, recommendation);
  }

  generateRecommendation(currentTier, recommendedTier, usageMetrics) {
    const current = this.serviceTiers[currentTier];
    const recommended = this.serviceTiers[recommendedTier];
    
    const benefits = [
      `Increase automation from ${current.automationLevel * 100}% to ${recommended.automationLevel * 100}%`,
      'Access to new features and capabilities',
      'Improved efficiency and time savings',
      'Enhanced customer experience'
    ];

    const risks = [
      'Learning curve for new features',
      `Price increase from $${current.monthlyPrice} to $${recommended.monthlyPrice}/month`,
      'Initial setup time required'
    ];

    // Calculate estimated ROI based on automation improvement
    const automationGain = recommended.automationLevel - current.automationLevel;
    const timeSavings = automationGain * 40; // hours per month
    const estimatedROI = (timeSavings * 50) - (recommended.monthlyPrice - current.monthlyPrice);

    return {
      reason: `Your usage patterns and comfort level indicate you're ready for ${recommended.name}`,
      confidence: 0.85,
      benefits,
      risks,
      estimatedROI
    };
  }

  async notifyTenantOfRecommendation(tenantId, recommendation) {
    // This would integrate with your notification service
    console.log(`Notification: Tenant ${tenantId} ready for upgrade`, recommendation);
    
    // Track the recommendation event
    await this.trackEvent(tenantId, 'tier_recommendation_generated', recommendation);
  }

  async acceptTierRecommendation(tenantId, recommendationId) {
    const query = `
      UPDATE tier_recommendations 
      SET status = 'accepted'
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;

    const result = await this.db.query(query, [recommendationId, tenantId]);
    if (!result.rows.length) throw new Error('Recommendation not found');

    const recommendation = result.rows[0];
    
    // Update tenant tier
    await this.upgradeTenant(tenantId, recommendation.recommended_tier);
    
    // Track acceptance
    await this.trackEvent(tenantId, 'tier_upgrade_accepted', {
      from: recommendation.current_tier,
      to: recommendation.recommended_tier
    });

    return recommendation;
  }

  async upgradeTenant(tenantId, newTier) {
    const query = `
      UPDATE tenant_progression 
      SET 
        previous_tier = current_tier,
        current_tier = $2,
        tier_started_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = $1
    `;

    await this.db.query(query, [tenantId, newTier]);

    // Enable new services for the tenant
    await this.enableTierServices(tenantId, newTier);
  }

  async enableTierServices(tenantId, tier) {
    const services = this.serviceTiers[tier].services;
    
    // This would update service access permissions
    console.log(`Enabling services for tenant ${tenantId}:`, services);
    
    // Update tenant configuration to enable new services
    const updateQuery = `
      UPDATE organizations 
      SET 
        enabled_services = $2,
        subscription_tier = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await this.db.query(updateQuery, [tenantId, JSON.stringify(services), tier]);
  }

  getMonthsSince(date) {
    const now = new Date();
    const past = new Date(date);
    return Math.floor((now - past) / (1000 * 60 * 60 * 24 * 30));
  }

  /**
   * Get tenant's current tier and progression status
   */
  async getTenantStatus(tenantId) {
    const query = `
      SELECT 
        tp.*,
        tr.recommended_tier,
        tr.confidence_score as recommendation_confidence,
        tr.benefits,
        tr.estimated_roi
      FROM tenant_progression tp
      LEFT JOIN tier_recommendations tr ON tp.tenant_id = tr.tenant_id 
        AND tr.status = 'pending'
        AND tr.expires_at > CURRENT_TIMESTAMP
      WHERE tp.tenant_id = $1
    `;

    const result = await this.db.query(query, [tenantId]);
    if (!result.rows.length) {
      // Create initial progression record
      await this.initializeTenantProgression(tenantId);
      return this.getTenantStatus(tenantId);
    }

    const status = result.rows[0];
    const currentTierInfo = this.serviceTiers[status.current_tier];

    return {
      ...status,
      tierInfo: currentTierInfo,
      availableUpgrades: this.getAvailableUpgrades(status.current_tier),
      progressToNext: this.calculateProgressToNext(status)
    };
  }

  async initializeTenantProgression(tenantId) {
    const query = `
      INSERT INTO tenant_progression (tenant_id, current_tier)
      VALUES ($1, 'starter')
    `;
    
    await this.db.query(query, [tenantId]);
  }

  getAvailableUpgrades(currentTier) {
    const tiers = Object.keys(this.serviceTiers);
    const currentIndex = tiers.indexOf(currentTier);
    
    return tiers.slice(currentIndex + 1).map(tier => ({
      tier,
      info: this.serviceTiers[tier]
    }));
  }

  calculateProgressToNext(status) {
    const tiers = Object.keys(this.serviceTiers);
    const currentIndex = tiers.indexOf(status.current_tier);
    
    if (currentIndex === tiers.length - 1) {
      return { progress: 1.0, message: 'Maximum tier reached' };
    }

    const nextTier = tiers[currentIndex + 1];
    const nextTierInfo = this.serviceTiers[nextTier];
    
    if (!nextTierInfo.prerequisites) {
      return { progress: 1.0, message: 'Ready to upgrade' };
    }

    // Calculate progress percentage based on prerequisites
    let totalProgress = 0;
    let requirements = 0;

    const prereqs = nextTierInfo.prerequisites;
    
    if (prereqs.comfortScore) {
      requirements++;
      totalProgress += Math.min(1, status.comfort_score / prereqs.comfortScore);
    }

    if (prereqs.minMonthsOnPrevious) {
      requirements++;
      const months = this.getMonthsSince(status.tier_started_at);
      totalProgress += Math.min(1, months / prereqs.minMonthsOnPrevious);
    }

    const progress = requirements > 0 ? totalProgress / requirements : 0;
    
    return {
      progress,
      message: progress >= 1.0 ? 'Ready to upgrade' : 'Building experience...'
    };
  }
}

module.exports = TenantProgressionEngine;