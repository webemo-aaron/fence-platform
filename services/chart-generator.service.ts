import { ChartConfiguration } from 'chart.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { EventEmitter } from 'eventemitter3';
import { ROICalculation } from '../models/tier-input.model';

export class ChartGeneratorService extends EventEmitter {
  private chartJSNodeCanvas: ChartJSNodeCanvas;

  constructor() {
    super();
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: 800,
      height: 600,
      backgroundColour: 'white'
    });
  }

  async generateBarChart(calculations: ROICalculation[]): Promise<Buffer> {
    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: calculations.map(c => c.tier),
        datasets: [
          {
            label: 'Admin Savings',
            data: calculations.map(c => c.adminSavings),
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          },
          {
            label: 'Travel Savings',
            data: calculations.map(c => c.travelSavings),
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          },
          {
            label: 'Revenue Recovery',
            data: calculations.map(c => c.revenueRecovery),
            backgroundColor: 'rgba(255, 206, 86, 0.5)',
            borderColor: 'rgba(255, 206, 86, 1)',
            borderWidth: 1
          },
          {
            label: 'Payment Recovery',
            data: calculations.map(c => c.paymentRecovery),
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          },
          {
            label: 'Upsell Revenue',
            data: calculations.map(c => c.upsellRevenue),
            backgroundColor: 'rgba(153, 102, 255, 0.5)',
            borderColor: 'rgba(153, 102, 255, 1)',
            borderWidth: 1
          },
          {
            label: 'Predictive Maintenance',
            data: calculations.map(c => c.predictiveMaintenance),
            backgroundColor: 'rgba(255, 159, 64, 0.5)',
            borderColor: 'rgba(255, 159, 64, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'ROI Breakdown by Tier',
            font: { size: 18 }
          },
          legend: {
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Monthly Savings ($)'
            }
          }
        }
      }
    };

    const buffer = await this.chartJSNodeCanvas.renderToBuffer(config);
    this.emit('chart-generated', { type: 'bar', buffer });
    return buffer;
  }

  async generateStackedBarChart(calculations: ROICalculation[]): Promise<Buffer> {
    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: calculations.map(c => c.tier),
        datasets: [
          {
            label: 'Admin Savings',
            data: calculations.map(c => c.adminSavings),
            backgroundColor: 'rgba(54, 162, 235, 0.8)'
          },
          {
            label: 'Travel Savings',
            data: calculations.map(c => c.travelSavings),
            backgroundColor: 'rgba(255, 99, 132, 0.8)'
          },
          {
            label: 'Revenue Recovery',
            data: calculations.map(c => c.revenueRecovery),
            backgroundColor: 'rgba(255, 206, 86, 0.8)'
          },
          {
            label: 'Payment Recovery',
            data: calculations.map(c => c.paymentRecovery),
            backgroundColor: 'rgba(75, 192, 192, 0.8)'
          },
          {
            label: 'Upsell Revenue',
            data: calculations.map(c => c.upsellRevenue),
            backgroundColor: 'rgba(153, 102, 255, 0.8)'
          },
          {
            label: 'Predictive Maintenance',
            data: calculations.map(c => c.predictiveMaintenance),
            backgroundColor: 'rgba(255, 159, 64, 0.8)'
          }
        ]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Cumulative ROI by Tier',
            font: { size: 18 }
          }
        },
        scales: {
          x: {
            stacked: true
          },
          y: {
            stacked: true,
            title: {
              display: true,
              text: 'Total Monthly ROI ($)'
            }
          }
        }
      }
    };

    const buffer = await this.chartJSNodeCanvas.renderToBuffer(config);
    this.emit('chart-generated', { type: 'stacked-bar', buffer });
    return buffer;
  }

  async generatePieChart(calculation: ROICalculation): Promise<Buffer> {
    const config: ChartConfiguration = {
      type: 'pie',
      data: {
        labels: [
          'Admin Savings',
          'Travel Savings',
          'Revenue Recovery',
          'Payment Recovery',
          'Upsell Revenue',
          'Predictive Maintenance'
        ],
        datasets: [{
          data: [
            calculation.adminSavings,
            calculation.travelSavings,
            calculation.revenueRecovery,
            calculation.paymentRecovery,
            calculation.upsellRevenue,
            calculation.predictiveMaintenance
          ],
          backgroundColor: [
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 99, 132, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)',
            'rgba(255, 159, 64, 0.8)'
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: `${calculation.tier} ROI Distribution`,
            font: { size: 18 }
          },
          legend: {
            position: 'right'
          }
        }
      }
    };

    const buffer = await this.chartJSNodeCanvas.renderToBuffer(config);
    this.emit('chart-generated', { type: 'pie', tier: calculation.tier, buffer });
    return buffer;
  }

  async generateHorizontalBarChart(calculations: ROICalculation[]): Promise<Buffer> {
    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: calculations.map(c => c.tier),
        datasets: [{
          label: 'Total Monthly ROI',
          data: calculations.map(c => c.monthlyROI),
          backgroundColor: calculations.map((_, i) => {
            const colors = [
              'rgba(54, 162, 235, 0.8)',
              'rgba(255, 206, 86, 0.8)',
              'rgba(75, 192, 192, 0.8)'
            ];
            return colors[i] || colors[0];
          }),
          borderColor: calculations.map((_, i) => {
            const colors = [
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)'
            ];
            return colors[i] || colors[0];
          }),
          borderWidth: 2
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Total Monthly ROI Comparison',
            font: { size: 18 }
          },
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Monthly ROI ($)'
            }
          }
        }
      }
    };

    const buffer = await this.chartJSNodeCanvas.renderToBuffer(config);
    this.emit('chart-generated', { type: 'horizontal-bar', buffer });
    return buffer;
  }

  async generateAllCharts(calculations: ROICalculation[]): Promise<{
    bar: Buffer;
    stackedBar: Buffer;
    pies: Map<string, Buffer>;
    horizontalBar: Buffer;
  }> {
    const [bar, stackedBar, horizontalBar] = await Promise.all([
      this.generateBarChart(calculations),
      this.generateStackedBarChart(calculations),
      this.generateHorizontalBarChart(calculations)
    ]);

    const pies = new Map<string, Buffer>();
    for (const calc of calculations) {
      const pieBuffer = await this.generatePieChart(calc);
      pies.set(calc.tier, pieBuffer);
    }

    this.emit('all-charts-generated', { 
      count: 3 + pies.size,
      types: ['bar', 'stacked-bar', 'pie', 'horizontal-bar'] 
    });

    return { bar, stackedBar, pies, horizontalBar };
  }
}