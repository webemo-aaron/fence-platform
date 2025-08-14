import { EventEmitter } from 'eventemitter3';
import { TierInput, ROICalculation, TierLevel } from '../models/tier-input.model';

export interface CalculationConfig {
  hourlyRate: number;
  monthlyRevenue: number;
  manualAdminHours: number;
  manualTravelHours: number;
}

export class ROICalculatorService extends EventEmitter {
  private config: CalculationConfig = {
    hourlyRate: 35,
    monthlyRevenue: 50000,
    manualAdminHours: 80,
    manualTravelHours: 40
  };

  private tierInputs: Map<TierLevel, TierInput> = new Map();
  private calculations: Map<TierLevel, ROICalculation> = new Map();

  constructor() {
    super();
  }

  setConfig(config: Partial<CalculationConfig>): void {
    this.config = { ...this.config, ...config };
    this.recalculateAll();
    this.emit('config-changed', this.config);
  }

  setTierInput(input: TierInput): void {
    this.tierInputs.set(input.tier, input);
    const calculation = this.calculateROI(input);
    this.calculations.set(input.tier, calculation);
    
    this.emit('input-changed', { tier: input.tier, input });
    this.emit('calculation-updated', { tier: input.tier, calculation });
  }

  calculateROI(input: TierInput): ROICalculation {
    const { hourlyRate, monthlyRevenue, manualAdminHours, manualTravelHours } = this.config;
    
    // Calculate savings
    const adminSavings = (manualAdminHours * hourlyRate) - input.adminCost;
    const travelSavings = ((manualTravelHours - input.travelHours) * hourlyRate);
    const revenueRecovery = input.revenuLeakagePercent * monthlyRevenue;
    const paymentRecovery = input.paymentDelays;
    
    // Total monthly ROI
    const monthlyROI = adminSavings + travelSavings + revenueRecovery + 
                      paymentRecovery + input.upsellRevenue + input.predictiveMaintenance;
    
    // Annual ROI
    const annualROI = monthlyROI * 12;
    
    // Payback period in months
    const paybackPeriod = input.basePrice / monthlyROI;
    
    // Total ROI percentage
    const totalROI = ((monthlyROI - input.basePrice) / input.basePrice) * 100;

    return {
      tier: input.tier,
      adminSavings,
      travelSavings,
      revenueRecovery,
      paymentRecovery,
      upsellRevenue: input.upsellRevenue,
      predictiveMaintenance: input.predictiveMaintenance,
      totalROI,
      monthlyROI,
      annualROI,
      paybackPeriod
    };
  }

  recalculateAll(): void {
    this.tierInputs.forEach((input, tier) => {
      const calculation = this.calculateROI(input);
      this.calculations.set(tier, calculation);
      this.emit('calculation-updated', { tier, calculation });
    });
  }

  getCalculation(tier: TierLevel): ROICalculation | undefined {
    return this.calculations.get(tier);
  }

  getAllCalculations(): ROICalculation[] {
    return Array.from(this.calculations.values());
  }

  getComparisonData(): any {
    const calculations = this.getAllCalculations();
    
    return {
      tiers: calculations.map(c => c.tier),
      metrics: {
        adminSavings: calculations.map(c => c.adminSavings),
        travelSavings: calculations.map(c => c.travelSavings),
        revenueRecovery: calculations.map(c => c.revenueRecovery),
        paymentRecovery: calculations.map(c => c.paymentRecovery),
        upsellRevenue: calculations.map(c => c.upsellRevenue),
        predictiveMaintenance: calculations.map(c => c.predictiveMaintenance),
        totalROI: calculations.map(c => c.totalROI),
        monthlyROI: calculations.map(c => c.monthlyROI),
        annualROI: calculations.map(c => c.annualROI)
      }
    };
  }

  exportToJSON(): any {
    return {
      config: this.config,
      inputs: Array.from(this.tierInputs.values()),
      calculations: Array.from(this.calculations.values()),
      comparison: this.getComparisonData()
    };
  }
}