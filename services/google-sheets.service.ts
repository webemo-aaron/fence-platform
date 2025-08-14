import { google, sheets_v4 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { EventEmitter } from 'eventemitter3';
import { TierInput, ROICalculation, TierLevel, DEFAULT_TIER_INPUTS } from '../models/tier-input.model';
import { ROICalculatorService } from './roi-calculator.service';

export class GoogleSheetsService extends EventEmitter {
  private sheets?: sheets_v4.Sheets;
  private auth?: OAuth2Client;
  private spreadsheetId: string = '';
  private calculator: ROICalculatorService;

  constructor(calculator: ROICalculatorService) {
    super();
    this.calculator = calculator;
  }

  async initialize(credentials: any, token: any): Promise<void> {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]) as any;
    this.auth!.setCredentials(token);
    this.sheets = google.sheets({ version: 'v4', auth: this.auth as any });
  }

  async createSpreadsheet(): Promise<string> {
    const resource = {
      properties: {
        title: `Invisible Fence ROI Calculator - ${new Date().toISOString().split('T')[0]}`
      },
      sheets: [
        { properties: { title: 'Tier Inputs', gridProperties: { rowCount: 20, columnCount: 10 } } },
        { properties: { title: 'ROI Calculations', gridProperties: { rowCount: 20, columnCount: 15 } } },
        { properties: { title: 'Comparison', gridProperties: { rowCount: 20, columnCount: 15 } } },
        { properties: { title: 'Config', gridProperties: { rowCount: 10, columnCount: 5 } } }
      ]
    };

    const response = await this.sheets!.spreadsheets.create({
      requestBody: resource
    });

    this.spreadsheetId = response.data.spreadsheetId!;
    await this.setupSheets();
    
    this.emit('spreadsheet-created', { id: this.spreadsheetId });
    return this.spreadsheetId;
  }

  private async setupSheets(): Promise<void> {
    await this.setupInputSheet();
    await this.setupCalculationSheet();
    await this.setupComparisonSheet();
    await this.setupConfigSheet();
  }

  private async setupInputSheet(): Promise<void> {
    const headers = [
      ['Tier', 'Base Price', 'Admin Hours', 'Admin Cost', 'Travel Hours', 
       'Revenue Leakage %', 'Payment Delays', 'Upsell Revenue', 'Predictive Maintenance']
    ];

    const data = Object.values(DEFAULT_TIER_INPUTS).map(input => [
      input.tier,
      input.basePrice,
      input.adminHours,
      input.adminCost,
      input.travelHours,
      input.revenuLeakagePercent,
      input.paymentDelays,
      input.upsellRevenue,
      input.predictiveMaintenance
    ]);

    await this.sheets!.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: 'Tier Inputs!A1:I4',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [...headers, ...data]
      }
    });

    // Add data validation for tier column
    await this.sheets!.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{
          setDataValidation: {
            range: {
              sheetId: 0,
              startRowIndex: 1,
              endRowIndex: 4,
              startColumnIndex: 0,
              endColumnIndex: 1
            },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: [
                  { userEnteredValue: TierLevel.ESSENTIALS },
                  { userEnteredValue: TierLevel.PROFESSIONAL },
                  { userEnteredValue: TierLevel.ENTERPRISE }
                ]
              },
              strict: true
            }
          }
        }]
      }
    });
  }

  private async setupCalculationSheet(): Promise<void> {
    const headers = [
      ['Tier', 'Admin Savings', 'Travel Savings', 'Revenue Recovery', 
       'Payment Recovery', 'Upsell Revenue', 'Predictive Maintenance',
       'Total ROI %', 'Monthly ROI', 'Annual ROI', 'Payback Period (months)']
    ];

    const formulas = [
      [
        '=\'Tier Inputs\'!A2',
        '=(Config!B2*Config!B3)-\'Tier Inputs\'!D2',
        '=((Config!B4-\'Tier Inputs\'!E2)*Config!B2)',
        '=\'Tier Inputs\'!F2*Config!B5',
        '=\'Tier Inputs\'!G2',
        '=\'Tier Inputs\'!H2',
        '=\'Tier Inputs\'!I2',
        '=((I2-\'Tier Inputs\'!B2)/\'Tier Inputs\'!B2)*100',
        '=SUM(B2:G2)',
        '=I2*12',
        '=\'Tier Inputs\'!B2/I2'
      ],
      [
        '=\'Tier Inputs\'!A3',
        '=(Config!B2*Config!B3)-\'Tier Inputs\'!D3',
        '=((Config!B4-\'Tier Inputs\'!E3)*Config!B2)',
        '=\'Tier Inputs\'!F3*Config!B5',
        '=\'Tier Inputs\'!G3',
        '=\'Tier Inputs\'!H3',
        '=\'Tier Inputs\'!I3',
        '=((I3-\'Tier Inputs\'!B3)/\'Tier Inputs\'!B3)*100',
        '=SUM(B3:G3)',
        '=I3*12',
        '=\'Tier Inputs\'!B3/I3'
      ],
      [
        '=\'Tier Inputs\'!A4',
        '=(Config!B2*Config!B3)-\'Tier Inputs\'!D4',
        '=((Config!B4-\'Tier Inputs\'!E4)*Config!B2)',
        '=\'Tier Inputs\'!F4*Config!B5',
        '=\'Tier Inputs\'!G4',
        '=\'Tier Inputs\'!H4',
        '=\'Tier Inputs\'!I4',
        '=((I4-\'Tier Inputs\'!B4)/\'Tier Inputs\'!B4)*100',
        '=SUM(B4:G4)',
        '=I4*12',
        '=\'Tier Inputs\'!B4/I4'
      ]
    ];

    await this.sheets!.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: 'ROI Calculations!A1:K4',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [...headers, ...formulas]
      }
    });

    // Format currency columns
    await this.formatCurrencyColumns('ROI Calculations', [1, 2, 3, 4, 5, 6, 8, 9]);
  }

  private async setupComparisonSheet(): Promise<void> {
    const headers = [
      ['Metric', 'Essentials', 'Professional', 'Enterprise'],
      ['Base Price', '=\'Tier Inputs\'!B2', '=\'Tier Inputs\'!B3', '=\'Tier Inputs\'!B4'],
      ['Admin Savings', '=\'ROI Calculations\'!B2', '=\'ROI Calculations\'!B3', '=\'ROI Calculations\'!B4'],
      ['Travel Savings', '=\'ROI Calculations\'!C2', '=\'ROI Calculations\'!C3', '=\'ROI Calculations\'!C4'],
      ['Revenue Recovery', '=\'ROI Calculations\'!D2', '=\'ROI Calculations\'!D3', '=\'ROI Calculations\'!D4'],
      ['Payment Recovery', '=\'ROI Calculations\'!E2', '=\'ROI Calculations\'!E3', '=\'ROI Calculations\'!E4'],
      ['Upsell Revenue', '=\'ROI Calculations\'!F2', '=\'ROI Calculations\'!F3', '=\'ROI Calculations\'!F4'],
      ['Predictive Maintenance', '=\'ROI Calculations\'!G2', '=\'ROI Calculations\'!G3', '=\'ROI Calculations\'!G4'],
      ['Total Monthly ROI', '=\'ROI Calculations\'!I2', '=\'ROI Calculations\'!I3', '=\'ROI Calculations\'!I4'],
      ['Annual ROI', '=\'ROI Calculations\'!J2', '=\'ROI Calculations\'!J3', '=\'ROI Calculations\'!J4'],
      ['ROI %', '=\'ROI Calculations\'!H2', '=\'ROI Calculations\'!H3', '=\'ROI Calculations\'!H4'],
      ['Payback Period', '=\'ROI Calculations\'!K2', '=\'ROI Calculations\'!K3', '=\'ROI Calculations\'!K4']
    ];

    await this.sheets!.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: 'Comparison!A1:D12',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: headers
      }
    });

    // Create sparkline chart
    await this.sheets!.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: 'Comparison!F2',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['=SPARKLINE(B8:D8,{"charttype","bar";"max",MAX(B8:D8)})']]
      }
    });
  }

  private async setupConfigSheet(): Promise<void> {
    const config = [
      ['Configuration', 'Value'],
      ['Hourly Rate ($)', 35],
      ['Manual Admin Hours/Month', 80],
      ['Manual Travel Hours/Month', 40],
      ['Monthly Revenue ($)', 50000]
    ];

    await this.sheets!.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: 'Config!A1:B5',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: config
      }
    });
  }

  private async formatCurrencyColumns(sheetName: string, columns: number[]): Promise<void> {
    const sheetId = await this.getSheetId(sheetName);
    
    const requests = columns.map(col => ({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: col,
          endColumnIndex: col + 1
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: 'CURRENCY',
              pattern: '"$"#,##0.00'
            }
          }
        },
        fields: 'userEnteredFormat.numberFormat'
      }
    }));

    await this.sheets!.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests }
    });
  }

  private async getSheetId(sheetName: string): Promise<number> {
    const response = await this.sheets!.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });

    const sheet = response.data.sheets?.find(s => s.properties?.title === sheetName);
    return sheet?.properties?.sheetId || 0;
  }

  async updateTierInput(tier: TierLevel, input: TierInput): Promise<void> {
    const rowIndex = this.getTierRowIndex(tier);
    
    await this.sheets!.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Tier Inputs!A${rowIndex}:I${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          input.tier,
          input.basePrice,
          input.adminHours,
          input.adminCost,
          input.travelHours,
          input.revenuLeakagePercent,
          input.paymentDelays,
          input.upsellRevenue,
          input.predictiveMaintenance
        ]]
      }
    });

    this.emit('tier-updated', { tier, input });
  }

  async updateConfig(config: any): Promise<void> {
    await this.sheets!.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: 'Config!B2:B5',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [config.hourlyRate],
          [config.manualAdminHours],
          [config.manualTravelHours],
          [config.monthlyRevenue]
        ]
      }
    });

    this.emit('config-updated', config);
  }

  private getTierRowIndex(tier: TierLevel): number {
    switch (tier) {
      case TierLevel.ESSENTIALS: return 2;
      case TierLevel.PROFESSIONAL: return 3;
      case TierLevel.ENTERPRISE: return 4;
      default: return 2;
    }
  }

  getSpreadsheetUrl(): string {
    return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}`;
  }
}