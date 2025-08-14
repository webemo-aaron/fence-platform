import { google, slides_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { EventEmitter } from 'eventemitter3';
import { ROICalculation } from '../models/tier-input.model';

export interface SlideTemplate {
  title: string;
  content: string[];
  charts?: string[];
  tables?: any[];
}

export class GoogleSlidesService extends EventEmitter {
  private slides?: slides_v1.Slides;
  private auth?: OAuth2Client;
  private presentationId: string = '';

  constructor() {
    super();
  }

  async initialize(credentials: any, token: any): Promise<void> {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]) as any;
    this.auth!.setCredentials(token);
    this.slides = google.slides({ version: 'v1', auth: this.auth as any });
  }

  async createPresentation(): Promise<string> {
    const presentation = await this.slides!.presentations.create({
      requestBody: {
        title: `Invisible Fence Automation ROI - ${new Date().toISOString().split('T')[0]}`
      }
    });

    this.presentationId = presentation.data.presentationId!;
    await this.buildPresentation();
    
    this.emit('presentation-created', { id: this.presentationId });
    return this.presentationId;
  }

  private async buildPresentation(): Promise<void> {
    const slideTemplates = this.getSlideTemplates();
    const requests: slides_v1.Schema$Request[] = [];

    // Create slides
    for (let i = 0; i < slideTemplates.length; i++) {
      const slideId = `slide_${i}`;
      requests.push({
        createSlide: {
          objectId: slideId,
          insertionIndex: i,
          slideLayoutReference: {
            predefinedLayout: i === 0 ? 'TITLE' : 'TITLE_AND_BODY'
          }
        }
      });
    }

    await this.slides!.presentations.batchUpdate({
      presentationId: this.presentationId,
      requestBody: { requests }
    });

    // Add content to slides
    await this.populateSlides(slideTemplates);
  }

  private getSlideTemplates(): SlideTemplate[] {
    return [
      {
        title: 'Invisible Fence Digital Transformation',
        content: ['Automating Success Through Technology']
      },
      {
        title: 'Executive Summary',
        content: [
          'Replace paper-based operations with automated digital workflows',
          'Reduce administrative overhead by up to 75%',
          'Improve customer satisfaction with real-time updates',
          'Achieve ROI in less than 3 months'
        ]
      },
      {
        title: 'Current Pain Points',
        content: [
          '• Manual scheduling leads to conflicts and inefficiencies',
          '• Paper forms result in data entry errors and delays',
          '• No real-time visibility into technician locations',
          '• Missed upsell opportunities during service calls',
          '• Delayed invoicing affects cash flow',
          '• Limited customer communication capabilities'
        ]
      },
      {
        title: 'Digital Workflow Transformation',
        content: [
          '1. Customer requests service via app/web portal',
          '2. AI optimizes technician routing and scheduling',
          '3. Technician receives job details on mobile device',
          '4. Real-time updates sent to customer',
          '5. Digital forms capture service data',
          '6. Automated invoicing and payment processing',
          '7. Follow-up communications scheduled automatically'
        ]
      },
      {
        title: 'Tiered Solution Overview',
        content: [
          'ESSENTIALS ($299/month)',
          '• Core scheduling and dispatch',
          '• Customer notifications',
          '• Digital forms and invoicing',
          '',
          'PROFESSIONAL ($599/month)',
          '• Everything in Essentials plus:',
          '• Route optimization',
          '• Inventory management',
          '• Advanced analytics',
          '',
          'ENTERPRISE ($999/month)',
          '• Everything in Professional plus:',
          '• Predictive maintenance',
          '• Custom integrations',
          '• API access'
        ]
      },
      {
        title: 'Feature Comparison by Tier',
        content: [],
        tables: [this.getFeatureComparisonTable()]
      },
      {
        title: 'Time Savings & Efficiency Gains',
        content: [
          'Administrative Tasks: 20-60 hours/month saved',
          'Travel Time: 10-30 hours/month optimized',
          'Data Entry: Eliminated completely',
          'Scheduling Conflicts: Reduced by 95%',
          'Invoice Processing: From days to minutes'
        ],
        charts: ['time_savings_chart']
      },
      {
        title: 'Customer Service Improvements',
        content: [
          '• Real-time appointment updates',
          '• Automated reminder notifications',
          '• Digital service history access',
          '• Online payment options',
          '• Satisfaction scores increase 40%'
        ]
      },
      {
        title: 'Data Insights & Analytics',
        content: [
          'Track key performance metrics:',
          '• Jobs completed per day',
          '• Average service time',
          '• Customer satisfaction scores',
          '• Revenue per technician',
          '• Inventory turnover',
          '• Predictive maintenance alerts'
        ]
      },
      {
        title: 'ROI Analysis - Essentials Tier',
        content: [],
        charts: ['roi_essentials_chart'],
        tables: [this.getROITable('Essentials')]
      },
      {
        title: 'ROI Analysis - Professional Tier',
        content: [],
        charts: ['roi_professional_chart'],
        tables: [this.getROITable('Professional')]
      },
      {
        title: 'ROI Analysis - Enterprise Tier',
        content: [],
        charts: ['roi_enterprise_chart'],
        tables: [this.getROITable('Enterprise')]
      },
      {
        title: 'Visual ROI Comparison',
        content: [],
        charts: ['roi_comparison_bar', 'roi_comparison_stacked']
      },
      {
        title: 'Implementation Roadmap',
        content: [
          'Week 1-2: Setup and Configuration',
          '• Account creation and user setup',
          '• Data migration from existing systems',
          '• Configure service territories',
          '',
          'Week 3-4: Training and Testing',
          '• Staff training sessions',
          '• Test workflows with pilot group',
          '• Refine processes based on feedback',
          '',
          'Week 5+: Full Deployment',
          '• Roll out to all technicians',
          '• Monitor adoption and usage',
          '• Continuous optimization'
        ]
      },
      {
        title: 'Optional Add-On Modules',
        content: [
          'Pet Health Monitoring ($99/month)',
          '• Track pet behavior patterns',
          '• Alert for boundary breaches',
          '',
          'Customer Portal Plus ($49/month)',
          '• Self-service scheduling',
          '• Service history access',
          '',
          'Advanced Reporting ($79/month)',
          '• Custom report builder',
          '• Automated report distribution'
        ]
      },
      {
        title: 'Why Choose Our Solution',
        content: [
          '✓ Industry-specific features built for Invisible Fence',
          '✓ Proven ROI in less than 3 months',
          '✓ 24/7 support and training included',
          '✓ No long-term contracts required',
          '✓ Seamless integration with existing tools',
          '✓ Regular updates and new features'
        ]
      },
      {
        title: 'Next Steps',
        content: [
          'Schedule a personalized demo',
          'Start with a 30-day free trial',
          'Contact our team:',
          '',
          '📧 sales@invisiblefenceautomation.com',
          '📞 1-800-FENCE-AI',
          '🌐 www.invisiblefenceautomation.com',
          '',
          'Transform your business today!'
        ]
      }
    ];
  }

  private getFeatureComparisonTable(): any {
    return {
      headers: ['Feature', 'Essentials', 'Professional', 'Enterprise'],
      rows: [
        ['Job Scheduling', '✓', '✓', '✓'],
        ['Customer Notifications', '✓', '✓', '✓'],
        ['Digital Forms', '✓', '✓', '✓'],
        ['Route Optimization', '', '✓', '✓'],
        ['Inventory Management', '', '✓', '✓'],
        ['Advanced Analytics', '', '✓', '✓'],
        ['Predictive Maintenance', '', '', '✓'],
        ['Custom Integrations', '', '', '✓'],
        ['API Access', '', '', '✓']
      ]
    };
  }

  private getROITable(tier: string): any {
    return {
      headers: ['Metric', 'Monthly Value', 'Annual Value'],
      rows: [
        ['Admin Savings', '$0', '$0'],
        ['Travel Savings', '$0', '$0'],
        ['Revenue Recovery', '$0', '$0'],
        ['Payment Recovery', '$0', '$0'],
        ['Total ROI', '$0', '$0'],
        ['Payback Period', '0 months', '-']
      ]
    };
  }

  private async populateSlides(templates: SlideTemplate[]): Promise<void> {
    const presentation = await this.slides!.presentations.get({
      presentationId: this.presentationId
    });

    const slides = presentation.data.slides || [];
    const requests: slides_v1.Schema$Request[] = [];

    for (let i = 0; i < templates.length && i < slides.length; i++) {
      const slide = slides[i];
      const template = templates[i];
      const elements = slide.pageElements || [];

      // Update title
      const titleElement = elements.find(e => 
        e.shape?.placeholder?.type === 'TITLE' || 
        e.shape?.placeholder?.type === 'CENTERED_TITLE'
      );
      
      if (titleElement?.objectId) {
        requests.push({
          insertText: {
            objectId: titleElement.objectId,
            text: template.title,
            insertionIndex: 0
          }
        });
      }

      // Update body content
      const bodyElement = elements.find(e => 
        e.shape?.placeholder?.type === 'BODY'
      );
      
      if (bodyElement?.objectId && template.content.length > 0) {
        requests.push({
          insertText: {
            objectId: bodyElement.objectId,
            text: template.content.join('\n'),
            insertionIndex: 0
          }
        });
      }
    }

    if (requests.length > 0) {
      await this.slides!.presentations.batchUpdate({
        presentationId: this.presentationId,
        requestBody: { requests }
      });
    }
  }

  async addChart(slideIndex: number, chartImageUrl: string, chartId: string): Promise<void> {
    const presentation = await this.slides!.presentations.get({
      presentationId: this.presentationId
    });

    const slide = presentation.data.slides?.[slideIndex];
    if (!slide) return;

    const requests: slides_v1.Schema$Request[] = [{
      createImage: {
        objectId: chartId,
        url: chartImageUrl,
        elementProperties: {
          pageObjectId: slide.objectId,
          size: {
            width: { magnitude: 400, unit: 'PT' },
            height: { magnitude: 300, unit: 'PT' }
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: 150,
            translateY: 150,
            unit: 'PT'
          }
        }
      }
    }];

    await this.slides!.presentations.batchUpdate({
      presentationId: this.presentationId,
      requestBody: { requests }
    });

    this.emit('chart-added', { slideIndex, chartId });
  }

  async updateROITable(slideIndex: number, calculation: ROICalculation): Promise<void> {
    const tableData = [
      ['Admin Savings', `$${calculation.adminSavings.toFixed(0)}`, `$${(calculation.adminSavings * 12).toFixed(0)}`],
      ['Travel Savings', `$${calculation.travelSavings.toFixed(0)}`, `$${(calculation.travelSavings * 12).toFixed(0)}`],
      ['Revenue Recovery', `$${calculation.revenueRecovery.toFixed(0)}`, `$${(calculation.revenueRecovery * 12).toFixed(0)}`],
      ['Payment Recovery', `$${calculation.paymentRecovery.toFixed(0)}`, `$${(calculation.paymentRecovery * 12).toFixed(0)}`],
      ['Total ROI', `$${calculation.monthlyROI.toFixed(0)}`, `$${calculation.annualROI.toFixed(0)}`],
      ['Payback Period', `${calculation.paybackPeriod.toFixed(1)} months`, '-']
    ];

    // This would update the table on the slide
    // Implementation would depend on how tables are stored in the slide
    this.emit('table-updated', { slideIndex, tier: calculation.tier, data: tableData });
  }

  getPresentationUrl(): string {
    return `https://docs.google.com/presentation/d/${this.presentationId}`;
  }

  async exportToPDF(): Promise<Buffer> {
    // This would use the Drive API to export the presentation as PDF
    const drive = google.drive({ version: 'v3', auth: this.auth as any });
    
    const response = await drive.files.export({
      fileId: this.presentationId,
      mimeType: 'application/pdf'
    }, { responseType: 'arraybuffer' });

    return Buffer.from(response.data as ArrayBuffer);
  }
}