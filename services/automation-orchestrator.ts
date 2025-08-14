import { EventEmitter } from 'eventemitter3';
import { ROICalculatorService } from './roi-calculator.service';
import { ChartGeneratorService } from './chart-generator.service';
import { GoogleSheetsService } from './google-sheets.service';
import { GoogleSlidesService } from './google-slides.service';
import { TierInput, ROICalculation, DEFAULT_TIER_INPUTS, TierLevel } from '../models/tier-input.model';

export class AutomationOrchestrator extends EventEmitter {
  private calculator: ROICalculatorService;
  private chartGenerator: ChartGeneratorService;
  private sheetsService: GoogleSheetsService;
  private slidesService: GoogleSlidesService;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.calculator = new ROICalculatorService();
    this.chartGenerator = new ChartGeneratorService();
    this.sheetsService = new GoogleSheetsService(this.calculator);
    this.slidesService = new GoogleSlidesService();
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen to calculator events
    this.calculator.on('input-changed', async (data) => {
      this.emit('processing-update', { status: 'Recalculating ROI...' });
      await this.handleInputChange(data);
    });

    this.calculator.on('calculation-updated', async (data) => {
      this.emit('processing-update', { status: 'Updating charts...' });
      await this.handleCalculationUpdate(data);
    });

    this.calculator.on('config-changed', async (config) => {
      this.emit('processing-update', { status: 'Updating configuration...' });
      await this.handleConfigChange(config);
    });

    // Listen to chart generator events
    this.chartGenerator.on('chart-generated', (data) => {
      this.emit('chart-ready', data);
    });

    this.chartGenerator.on('all-charts-generated', (data) => {
      this.emit('all-charts-ready', data);
    });

    // Listen to Google Sheets events
    this.sheetsService.on('tier-updated', (data) => {
      this.emit('sheets-updated', data);
    });

    this.sheetsService.on('config-updated', (config) => {
      this.emit('sheets-config-updated', config);
    });

    // Listen to Google Slides events
    this.slidesService.on('chart-added', (data) => {
      this.emit('slides-chart-added', data);
    });

    this.slidesService.on('table-updated', (data) => {
      this.emit('slides-table-updated', data);
    });
  }

  async initialize(googleCredentials?: any, googleToken?: any): Promise<void> {
    try {
      this.emit('initialization-started');
      
      // Initialize with default tier inputs
      Object.values(DEFAULT_TIER_INPUTS).forEach(input => {
        this.calculator.setTierInput(input);
      });

      // Initialize Google services if credentials provided
      if (googleCredentials && googleToken) {
        await this.sheetsService.initialize(googleCredentials, googleToken);
        await this.slidesService.initialize(googleCredentials, googleToken);
        
        // Create initial spreadsheet and presentation
        const [spreadsheetId, presentationId] = await Promise.all([
          this.sheetsService.createSpreadsheet(),
          this.slidesService.createPresentation()
        ]);

        this.emit('google-services-ready', {
          spreadsheetUrl: this.sheetsService.getSpreadsheetUrl(),
          presentationUrl: this.slidesService.getPresentationUrl()
        });
      }

      // Generate initial charts
      await this.generateAllCharts();
      
      this.isInitialized = true;
      this.emit('initialization-complete');
    } catch (error) {
      this.emit('initialization-error', error);
      throw error;
    }
  }

  async updateTierInput(input: TierInput): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Orchestrator not initialized');
    }

    this.emit('processing-update', { 
      status: `Updating ${input.tier} tier...`,
      tier: input.tier 
    });

    // Update calculator
    this.calculator.setTierInput(input);

    // Update Google Sheets if connected
    if (this.sheetsService) {
      await this.sheetsService.updateTierInput(input.tier, input);
    }

    this.emit('tier-update-complete', { tier: input.tier });
  }

  async updateConfiguration(config: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Orchestrator not initialized');
    }

    this.emit('processing-update', { 
      status: 'Updating configuration...'
    });

    // Update calculator config
    this.calculator.setConfig(config);

    // Update Google Sheets if connected
    if (this.sheetsService) {
      await this.sheetsService.updateConfig(config);
    }

    this.emit('config-update-complete', config);
  }

  private async handleInputChange(data: any): Promise<void> {
    // Generate new charts for the updated tier
    const calculation = this.calculator.getCalculation(data.tier);
    if (calculation) {
      await this.generateChartsForTier(calculation);
    }
  }

  private async handleCalculationUpdate(data: any): Promise<void> {
    const { tier, calculation } = data;
    
    // Update presentation ROI table if connected
    if (this.slidesService) {
      const slideIndex = this.getSlideIndexForTier(tier);
      await this.slidesService.updateROITable(slideIndex, calculation);
    }
  }

  private async handleConfigChange(config: any): Promise<void> {
    // Regenerate all charts with new config
    await this.generateAllCharts();
  }

  private async generateChartsForTier(calculation: ROICalculation): Promise<void> {
    const pieChart = await this.chartGenerator.generatePieChart(calculation);
    
    // Update slide with new chart if connected
    if (this.slidesService) {
      // Note: In production, you'd upload the image to a CDN or Google Drive
      // and get a public URL to use in the slides
      const chartUrl = await this.uploadChartImage(pieChart);
      const slideIndex = this.getSlideIndexForTier(calculation.tier);
      await this.slidesService.addChart(slideIndex, chartUrl, `pie_${calculation.tier}`);
    }

    this.emit('tier-charts-generated', { tier: calculation.tier });
  }

  private async generateAllCharts(): Promise<void> {
    const calculations = this.calculator.getAllCalculations();
    if (calculations.length === 0) return;

    this.emit('processing-update', { status: 'Generating all charts...' });

    const charts = await this.chartGenerator.generateAllCharts(calculations);
    
    // Store charts for later use
    this.emit('all-charts-generated', {
      bar: charts.bar,
      stackedBar: charts.stackedBar,
      horizontalBar: charts.horizontalBar,
      pies: Array.from(charts.pies.entries())
    });
  }

  private getSlideIndexForTier(tier: TierLevel): number {
    switch (tier) {
      case TierLevel.ESSENTIALS: return 9;
      case TierLevel.PROFESSIONAL: return 10;
      case TierLevel.ENTERPRISE: return 11;
      default: return 9;
    }
  }

  private async uploadChartImage(buffer: Buffer): Promise<string> {
    // In production, this would upload to Google Drive or a CDN
    // For now, return a placeholder
    return 'https://via.placeholder.com/800x600';
  }

  async exportData(): Promise<any> {
    return {
      calculations: this.calculator.exportToJSON(),
      spreadsheetUrl: this.sheetsService?.getSpreadsheetUrl(),
      presentationUrl: this.slidesService?.getPresentationUrl()
    };
  }

  async generateScenario(scenarioName: string, inputs: Record<TierLevel, TierInput>): Promise<any> {
    this.emit('processing-update', { 
      status: `Generating scenario: ${scenarioName}...`
    });

    // Create a new calculator instance for this scenario
    const scenarioCalculator = new ROICalculatorService();
    
    // Apply inputs
    Object.values(inputs).forEach(input => {
      scenarioCalculator.setTierInput(input);
    });

    // Get calculations
    const calculations = scenarioCalculator.getAllCalculations();
    
    // Generate charts
    const charts = await this.chartGenerator.generateAllCharts(calculations);

    const result = {
      name: scenarioName,
      inputs,
      calculations,
      comparison: scenarioCalculator.getComparisonData(),
      charts: {
        generated: true,
        count: 3 + charts.pies.size
      }
    };

    this.emit('scenario-generated', result);
    return result;
  }

  getStatus(): any {
    return {
      initialized: this.isInitialized,
      tiers: Array.from(this.calculator['tierInputs'].keys()),
      hasGoogleServices: !!this.sheetsService && !!this.slidesService,
      spreadsheetUrl: this.sheetsService?.getSpreadsheetUrl(),
      presentationUrl: this.slidesService?.getPresentationUrl()
    };
  }
}