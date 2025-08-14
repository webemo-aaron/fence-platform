const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class PDFGeneratorService {
  constructor() {
    this.browser = null;
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  async generateROIReport(calculations, customerInfo = null) {
    await this.initialize();
    
    const html = this.createROIReportHTML(calculations, customerInfo);
    const page = await this.browser.newPage();
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });
    
    await page.close();
    return pdf;
  }

  createROIReportHTML(calculations, customerInfo) {
    const date = new Date().toLocaleDateString();
    const customerSection = customerInfo ? `
      <div class="customer-info">
        <h2>Prepared For:</h2>
        <p><strong>${customerInfo.name}</strong></p>
        <p>${customerInfo.company || ''}</p>
        <p>${customerInfo.email}</p>
        <p>${customerInfo.phone || ''}</p>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            color: #333;
            line-height: 1.6;
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
            margin-bottom: 30px;
          }
          
          .header h1 {
            font-size: 36px;
            margin-bottom: 10px;
          }
          
          .header p {
            font-size: 18px;
            opacity: 0.9;
          }
          
          .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 0 20px;
          }
          
          .customer-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          
          .customer-info h2 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 20px;
          }
          
          .executive-summary {
            background: #e8f4f8;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 30px;
            border-left: 4px solid #667eea;
          }
          
          .executive-summary h2 {
            color: #333;
            margin-bottom: 15px;
          }
          
          .tier-comparison {
            margin-bottom: 40px;
          }
          
          .tier-comparison h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 28px;
          }
          
          .tier-card {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .tier-card h3 {
            color: #667eea;
            font-size: 24px;
            margin-bottom: 15px;
          }
          
          .tier-card .price {
            font-size: 32px;
            font-weight: bold;
            color: #333;
            margin-bottom: 20px;
          }
          
          .metrics-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
          }
          
          .metric {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
          }
          
          .metric-label {
            color: #666;
            font-size: 14px;
            margin-bottom: 5px;
          }
          
          .metric-value {
            color: #333;
            font-size: 20px;
            font-weight: bold;
          }
          
          .roi-highlight {
            background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin-top: 20px;
          }
          
          .roi-highlight .label {
            font-size: 16px;
            margin-bottom: 10px;
          }
          
          .roi-highlight .value {
            font-size: 36px;
            font-weight: bold;
          }
          
          .features-list {
            margin-top: 20px;
          }
          
          .features-list h4 {
            color: #333;
            margin-bottom: 10px;
          }
          
          .features-list ul {
            list-style: none;
            padding-left: 0;
          }
          
          .features-list li {
            padding: 8px 0;
            padding-left: 25px;
            position: relative;
          }
          
          .features-list li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #48bb78;
            font-weight: bold;
          }
          
          .footer {
            margin-top: 50px;
            padding: 30px;
            background: #f8f9fa;
            text-align: center;
            border-top: 2px solid #e0e0e0;
          }
          
          .footer h3 {
            color: #667eea;
            margin-bottom: 15px;
          }
          
          .footer p {
            color: #666;
            margin-bottom: 10px;
          }
          
          .page-break {
            page-break-after: always;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Invisible Fence ROI Analysis</h1>
          <p>Digital Transformation Investment Report</p>
          <p style="margin-top: 10px; font-size: 14px;">Generated: ${date}</p>
        </div>
        
        <div class="container">
          ${customerSection}
          
          <div class="executive-summary">
            <h2>Executive Summary</h2>
            <p>This report analyzes the return on investment (ROI) for implementing the Invisible Fence automation system across three service tiers. Our analysis shows significant cost savings and efficiency gains through digital transformation of your operations.</p>
            <ul style="margin-top: 15px; padding-left: 20px;">
              <li>Reduce administrative overhead by up to 75%</li>
              <li>Optimize technician routing and scheduling</li>
              <li>Recover lost revenue through improved billing</li>
              <li>Achieve positive ROI in less than 3 months</li>
            </ul>
          </div>
          
          <div class="tier-comparison">
            <h2>Tier Analysis & ROI Projections</h2>
            
            ${calculations.map(calc => this.createTierSection(calc)).join('')}
          </div>
          
          <div class="footer">
            <h3>Ready to Transform Your Business?</h3>
            <p>Contact our team to schedule a personalized demonstration</p>
            <p><strong>📧 sales@invisiblefence.com | 📞 1-800-FENCE-AI</strong></p>
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
              This report is confidential and proprietary. All calculations are estimates based on provided inputs.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  createTierSection(calc) {
    const features = this.getTierFeatures(calc.tier);
    
    return `
      <div class="tier-card">
        <h3>${calc.tier} Tier</h3>
        <div class="price">$${calc.basePrice || 0}/month</div>
        
        <div class="metrics-grid">
          <div class="metric">
            <div class="metric-label">Admin Savings</div>
            <div class="metric-value">$${(calc.adminSavings || 0).toLocaleString()}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Travel Savings</div>
            <div class="metric-value">$${(calc.travelSavings || 0).toLocaleString()}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Revenue Recovery</div>
            <div class="metric-value">$${(calc.revenueRecovery || 0).toLocaleString()}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Payment Recovery</div>
            <div class="metric-value">$${(calc.paymentRecovery || 0).toLocaleString()}</div>
          </div>
        </div>
        
        <div class="roi-highlight">
          <div class="label">Total Monthly ROI</div>
          <div class="value">$${(calc.monthlyROI || 0).toLocaleString()}</div>
        </div>
        
        <div class="metrics-grid" style="margin-top: 20px;">
          <div class="metric">
            <div class="metric-label">Annual ROI</div>
            <div class="metric-value">$${(calc.annualROI || 0).toLocaleString()}</div>
          </div>
          <div class="metric">
            <div class="metric-label">Payback Period</div>
            <div class="metric-value">${(calc.paybackPeriod || 0).toFixed(1)} months</div>
          </div>
        </div>
        
        <div class="features-list">
          <h4>Included Features:</h4>
          <ul>
            ${features.map(f => `<li>${f}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  getTierFeatures(tier) {
    const features = {
      'Essentials': [
        'Job Scheduling & Dispatch',
        'Customer Notifications',
        'Digital Forms & Documentation',
        'Basic Invoicing Automation',
        'Mobile App for Technicians'
      ],
      'Professional': [
        'Everything in Essentials',
        'Route Optimization',
        'Inventory Management',
        'Advanced Analytics Dashboard',
        'Multi-location Support',
        'Customer Portal',
        'Email Marketing Tools'
      ],
      'Enterprise': [
        'Everything in Professional',
        'Predictive Maintenance',
        'Custom Integrations',
        'API Access',
        'Advanced Reporting',
        'Dedicated Support',
        'Custom Training'
      ]
    };
    
    return features[tier] || features['Essentials'];
  }

  async generateCustomerReport(customer, serviceHistory) {
    await this.initialize();
    
    const html = this.createCustomerReportHTML(customer, serviceHistory);
    const page = await this.browser.newPage();
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      }
    });
    
    await page.close();
    return pdf;
  }

  createCustomerReportHTML(customer, serviceHistory) {
    const date = new Date().toLocaleDateString();
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #333;
            line-height: 1.6;
          }
          
          .header {
            background: #667eea;
            color: white;
            padding: 30px;
            text-align: center;
            margin-bottom: 30px;
          }
          
          .customer-details {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          
          .service-history {
            margin-bottom: 30px;
          }
          
          .service-entry {
            border-left: 3px solid #667eea;
            padding-left: 20px;
            margin-bottom: 20px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          
          th {
            background: #667eea;
            color: white;
            padding: 10px;
            text-align: left;
          }
          
          td {
            padding: 10px;
            border-bottom: 1px solid #e0e0e0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Customer Service Report</h1>
          <p>Generated: ${date}</p>
        </div>
        
        <div class="customer-details">
          <h2>${customer.first_name} ${customer.last_name}</h2>
          <p><strong>Email:</strong> ${customer.email}</p>
          <p><strong>Phone:</strong> ${customer.phone}</p>
          <p><strong>Address:</strong> ${customer.address}, ${customer.city}, ${customer.state} ${customer.zip}</p>
          <p><strong>Pet:</strong> ${customer.pet_name} (${customer.pet_type})</p>
          <p><strong>Service Tier:</strong> ${customer.tier}</p>
        </div>
        
        <div class="service-history">
          <h2>Service History</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Service Type</th>
                <th>Technician</th>
                <th>Duration</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              ${serviceHistory.map(service => `
                <tr>
                  <td>${new Date(service.service_date).toLocaleDateString()}</td>
                  <td>${service.service_type}</td>
                  <td>${service.technician_name || 'N/A'}</td>
                  <td>${service.duration_minutes} min</td>
                  <td>$${service.cost || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = PDFGeneratorService;