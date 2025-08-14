export enum TierLevel {
  ESSENTIALS = 'Essentials',
  PROFESSIONAL = 'Professional',
  ENTERPRISE = 'Enterprise'
}

export interface TierInput {
  tier: TierLevel;
  basePrice: number;
  adminHours: number;
  adminCost: number;
  travelHours: number;
  revenuLeakagePercent: number;
  paymentDelays: number;
  upsellRevenue: number;
  predictiveMaintenance: number;
}

export interface ROICalculation {
  tier: TierLevel;
  adminSavings: number;
  travelSavings: number;
  revenueRecovery: number;
  paymentRecovery: number;
  upsellRevenue: number;
  predictiveMaintenance: number;
  totalROI: number;
  monthlyROI: number;
  annualROI: number;
  paybackPeriod: number;
}

export interface TierFeatures {
  tier: TierLevel;
  features: {
    jobScheduling: boolean;
    customerNotifications: boolean;
    routeOptimization: boolean;
    inventoryManagement: boolean;
    invoicingAutomation: boolean;
    advancedAnalytics: boolean;
    predictiveMaintenance: boolean;
    customIntegrations: boolean;
    multiLocationSupport: boolean;
    apiAccess: boolean;
  };
}

export const DEFAULT_TIER_INPUTS: Record<TierLevel, TierInput> = {
  [TierLevel.ESSENTIALS]: {
    tier: TierLevel.ESSENTIALS,
    basePrice: 299,
    adminHours: 20,
    adminCost: 50,
    travelHours: 10,
    revenuLeakagePercent: 0.05,
    paymentDelays: 500,
    upsellRevenue: 0,
    predictiveMaintenance: 0
  },
  [TierLevel.PROFESSIONAL]: {
    tier: TierLevel.PROFESSIONAL,
    basePrice: 599,
    adminHours: 40,
    adminCost: 75,
    travelHours: 20,
    revenuLeakagePercent: 0.08,
    paymentDelays: 1000,
    upsellRevenue: 500,
    predictiveMaintenance: 0
  },
  [TierLevel.ENTERPRISE]: {
    tier: TierLevel.ENTERPRISE,
    basePrice: 999,
    adminHours: 60,
    adminCost: 100,
    travelHours: 30,
    revenuLeakagePercent: 0.12,
    paymentDelays: 2000,
    upsellRevenue: 1500,
    predictiveMaintenance: 1000
  }
};

export const TIER_FEATURES: Record<TierLevel, TierFeatures> = {
  [TierLevel.ESSENTIALS]: {
    tier: TierLevel.ESSENTIALS,
    features: {
      jobScheduling: true,
      customerNotifications: true,
      routeOptimization: false,
      inventoryManagement: false,
      invoicingAutomation: true,
      advancedAnalytics: false,
      predictiveMaintenance: false,
      customIntegrations: false,
      multiLocationSupport: false,
      apiAccess: false
    }
  },
  [TierLevel.PROFESSIONAL]: {
    tier: TierLevel.PROFESSIONAL,
    features: {
      jobScheduling: true,
      customerNotifications: true,
      routeOptimization: true,
      inventoryManagement: true,
      invoicingAutomation: true,
      advancedAnalytics: true,
      predictiveMaintenance: false,
      customIntegrations: false,
      multiLocationSupport: true,
      apiAccess: false
    }
  },
  [TierLevel.ENTERPRISE]: {
    tier: TierLevel.ENTERPRISE,
    features: {
      jobScheduling: true,
      customerNotifications: true,
      routeOptimization: true,
      inventoryManagement: true,
      invoicingAutomation: true,
      advancedAnalytics: true,
      predictiveMaintenance: true,
      customIntegrations: true,
      multiLocationSupport: true,
      apiAccess: true
    }
  }
};