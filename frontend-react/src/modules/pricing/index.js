// Pricing Module - Enterprise ROI & Pricing System
export { default as Pricing } from '../../pages/Pricing'
export { pricingService } from '../../services/api'

// Pricing configuration
export const pricingConfig = {
  tiers: ['starter', 'essential', 'professional', 'enterprise'],
  defaultCalculation: {
    current_jobs_per_month: 25,
    average_job_value: 850,
    current_fuel_cost: 600,
    current_labor_hours: 180,
    hourly_rate: 28
  }
}

// Pricing API endpoints
export const pricingEndpoints = {
  tiers: '/api/pricing/tiers',
  calculateROI: '/api/pricing/calculate-roi',
  customQuote: '/api/pricing/custom-quote',
  compare: '/api/pricing/compare'
}

// ROI calculation utilities
export const roiUtils = {
  formatCurrency: (amount) => `$${amount.toLocaleString()}`,
  formatPercentage: (percent) => `${percent}%`,
  calculatePaybackPeriod: (investment, monthlyBenefit) => 
    Math.ceil(investment / monthlyBenefit)
}