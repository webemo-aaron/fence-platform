const express = require('express');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;

// Security middleware
app.use(helmet());
app.use(express.json());

// Pricing tiers
const pricingTiers = {
  starter: {
    name: 'Starter',
    price: 49,
    features: [
      '5 Active Jobs',
      'Basic Route Optimization',
      'Customer Portal',
      'Email Support'
    ],
    limits: {
      jobs: 5,
      users: 2,
      storage: '5GB'
    }
  },
  essential: {
    name: 'Essential',
    price: 149,
    features: [
      '25 Active Jobs',
      'Advanced Route Optimization',
      'Photo Documentation',
      'Customer Portal',
      'Invoicing & Payments',
      'Priority Support'
    ],
    limits: {
      jobs: 25,
      users: 5,
      storage: '25GB'
    }
  },
  professional: {
    name: 'Professional',
    price: 299,
    features: [
      'Unlimited Jobs',
      'AI-Powered Route Optimization',
      'Advanced Analytics',
      'Multi-crew Management',
      'Custom Branding',
      'API Access',
      'Phone Support'
    ],
    limits: {
      jobs: -1,
      users: 15,
      storage: '100GB'
    }
  },
  enterprise: {
    name: 'Enterprise',
    price: 599,
    features: [
      'Everything in Professional',
      'Custom Integrations',
      'Dedicated Account Manager',
      'SLA Guarantee',
      'Advanced Security',
      'Custom Training',
      'White-label Options'
    ],
    limits: {
      jobs: -1,
      users: -1,
      storage: 'Unlimited'
    }
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'pricing-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Get all pricing tiers
app.get('/tiers', (req, res) => {
  res.json(pricingTiers);
});

// Get specific tier
app.get('/tiers/:tier', (req, res) => {
  const tier = pricingTiers[req.params.tier];
  if (!tier) {
    return res.status(404).json({ error: 'Tier not found' });
  }
  res.json(tier);
});

// Calculate ROI
app.post('/calculate-roi', (req, res) => {
  const {
    current_jobs_per_month = 20,
    average_job_value = 800,
    current_fuel_cost = 500,
    current_labor_hours = 160,
    hourly_rate = 25
  } = req.body;

  // Calculate potential savings and improvements
  const optimized_fuel_cost = current_fuel_cost * 0.75; // 25% fuel savings
  const optimized_labor_hours = current_labor_hours * 0.60; // 40% time savings
  const additional_jobs_capacity = Math.floor(current_jobs_per_month * 0.30); // 30% more jobs

  const fuel_savings = current_fuel_cost - optimized_fuel_cost;
  const labor_savings = (current_labor_hours - optimized_labor_hours) * hourly_rate;
  const additional_revenue = additional_jobs_capacity * average_job_value;
  
  const monthly_savings = fuel_savings + labor_savings;
  const annual_savings = monthly_savings * 12;
  const annual_additional_revenue = additional_revenue * 12;
  const total_annual_benefit = annual_savings + annual_additional_revenue;

  // Recommend tier based on job volume
  let recommended_tier = 'starter';
  if (current_jobs_per_month > 50) {
    recommended_tier = 'professional';
  } else if (current_jobs_per_month > 20) {
    recommended_tier = 'essential';
  }

  res.json({
    current_metrics: {
      jobs_per_month: current_jobs_per_month,
      average_job_value,
      monthly_fuel_cost: current_fuel_cost,
      monthly_labor_hours: current_labor_hours
    },
    projected_improvements: {
      fuel_savings_percent: '25%',
      time_savings_percent: '40%',
      capacity_increase_percent: '30%',
      additional_jobs_per_month: additional_jobs_capacity
    },
    financial_impact: {
      monthly_fuel_savings: Math.round(fuel_savings),
      monthly_labor_savings: Math.round(labor_savings),
      monthly_additional_revenue: Math.round(additional_revenue),
      total_monthly_benefit: Math.round(monthly_savings + additional_revenue),
      total_annual_benefit: Math.round(total_annual_benefit)
    },
    roi_metrics: {
      payback_period_months: Math.ceil(pricingTiers[recommended_tier].price / (monthly_savings + additional_revenue)),
      annual_roi_percent: Math.round((total_annual_benefit / (pricingTiers[recommended_tier].price * 12)) * 100)
    },
    recommendation: {
      tier: recommended_tier,
      monthly_cost: pricingTiers[recommended_tier].price,
      annual_cost: pricingTiers[recommended_tier].price * 12,
      net_annual_benefit: Math.round(total_annual_benefit - (pricingTiers[recommended_tier].price * 12))
    }
  });
});

// Calculate custom quote
app.post('/custom-quote', (req, res) => {
  const {
    users,
    jobs_per_month,
    features_needed = [],
    integration_requirements = []
  } = req.body;

  // Base pricing logic
  let base_price = 299; // Start with professional
  
  if (users > 50) {
    base_price = 599; // Enterprise
  } else if (users > 15) {
    base_price = 499; // Custom professional
  }

  // Add-on pricing
  let add_on_cost = 0;
  if (integration_requirements.includes('quickbooks')) add_on_cost += 50;
  if (integration_requirements.includes('salesforce')) add_on_cost += 100;
  if (features_needed.includes('white_label')) add_on_cost += 200;
  if (features_needed.includes('custom_training')) add_on_cost += 150;

  const total_monthly = base_price + add_on_cost;

  res.json({
    quote: {
      base_monthly_price: base_price,
      add_ons_monthly: add_on_cost,
      total_monthly_price: total_monthly,
      total_annual_price: total_monthly * 12,
      annual_discount_available: Math.round(total_monthly * 12 * 0.15), // 15% annual discount
      discounted_annual_price: Math.round(total_monthly * 12 * 0.85)
    },
    included_features: {
      users,
      jobs: 'Unlimited',
      storage: users > 50 ? 'Unlimited' : '500GB',
      support: users > 50 ? 'Dedicated Account Manager' : 'Priority Support',
      training: features_needed.includes('custom_training') ? 'Custom On-site Training' : 'Online Training'
    },
    next_steps: [
      'Schedule a demo',
      'Start 14-day free trial',
      'Speak with sales team'
    ]
  });
});

// Compare tiers
app.get('/compare', (req, res) => {
  const comparison = Object.entries(pricingTiers).map(([key, tier]) => ({
    tier_id: key,
    ...tier
  }));
  
  res.json({
    tiers: comparison,
    popular: 'professional',
    best_value: 'essential'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    service: 'pricing-service'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Pricing service error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    service: 'pricing-service'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Pricing Service running on port ${PORT}`);
  console.log(`Available tiers: ${Object.keys(pricingTiers).join(', ')}`);
});