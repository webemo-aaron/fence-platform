const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;

// Import services
const DatabaseService = require('./services/database.service');
const PDFGeneratorService = require('./services/pdf-generator.service');
const crmRoutes = require('./services/crm-api');
const quoteRoutes = require('./services/quote-api');
const mapsRoutes = require('./services/maps-api');
const approvalRoutes = require('./services/approval-api');
const authRoutes = require('./services/auth-api');

const app = express();
const PORT = process.env.PORT || 3333;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('ui'));

// Initialize services
const pdfGenerator = new PDFGeneratorService();
const db = new DatabaseService();
db.initialize().catch(console.error);

// Create data directory if it doesn't exist
async function ensureDataDir() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}
ensureDataDir();

// =================
// ROI Calculator Routes
// =================

// In-memory storage for ROI data
let tierData = {
  Essentials: {
    basePrice: 299,
    adminHours: 20,
    adminCost: 50,
    travelHours: 10,
    revenuLeakagePercent: 0.05,
    paymentDelays: 500,
    upsellRevenue: 0,
    predictiveMaintenance: 0
  },
  Professional: {
    basePrice: 599,
    adminHours: 40,
    adminCost: 75,
    travelHours: 20,
    revenuLeakagePercent: 0.08,
    paymentDelays: 1000,
    upsellRevenue: 500,
    predictiveMaintenance: 0
  },
  Enterprise: {
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

let config = {
  hourlyRate: 35,
  monthlyRevenue: 50000,
  manualAdminHours: 80,
  manualTravelHours: 40
};

// ROI calculation function
function calculateROI(tier, input) {
  const adminSavings = (config.manualAdminHours * config.hourlyRate) - input.adminCost;
  const travelSavings = ((config.manualTravelHours - input.travelHours) * config.hourlyRate);
  const revenueRecovery = input.revenuLeakagePercent * config.monthlyRevenue;
  const paymentRecovery = input.paymentDelays;
  
  const monthlyROI = adminSavings + travelSavings + revenueRecovery + 
                    paymentRecovery + input.upsellRevenue + input.predictiveMaintenance;
  
  const annualROI = monthlyROI * 12;
  const paybackPeriod = input.basePrice / monthlyROI;
  const totalROI = ((monthlyROI - input.basePrice) / input.basePrice) * 100;

  return {
    tier,
    basePrice: input.basePrice,
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

// Get all calculations
function getAllCalculations() {
  return Object.entries(tierData).map(([tier, input]) => 
    calculateROI(tier, input)
  );
}

// ROI Routes
app.get('/api/status', (req, res) => {
  res.json({
    initialized: true,
    tiers: Object.keys(tierData),
    services: {
      roi_calculator: true,
      crm: true,
      pdf_generator: true,
      database: true
    },
    message: 'Invisible Fence Complete Platform is running'
  });
});

app.get('/api/calculations', (req, res) => {
  const calculations = getAllCalculations();
  
  // Save to database for history
  calculations.forEach(calc => {
    db.saveROICalculation({
      ...calc,
      ...tierData[calc.tier]
    }).catch(console.error);
  });
  
  res.json({
    calculations: {
      config,
      inputs: Object.values(tierData),
      calculations,
      comparison: {
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
      }
    }
  });
});

app.post('/api/tiers/:tier', (req, res) => {
  const tier = req.params.tier;
  if (!tierData[tier]) {
    return res.status(400).json({ error: 'Invalid tier' });
  }
  
  tierData[tier] = {
    ...tierData[tier],
    ...req.body
  };
  
  const calculation = calculateROI(tier, tierData[tier]);
  res.json({ success: true, tier, calculation });
});

app.post('/api/config', (req, res) => {
  config = {
    ...config,
    ...req.body
  };
  
  res.json({ success: true, config });
});

app.post('/api/scenarios', (req, res) => {
  const { name, inputs } = req.body;
  
  const calculations = Object.entries(inputs).map(([tier, input]) =>
    calculateROI(tier, input)
  );
  
  res.json({
    name,
    inputs,
    calculations,
    comparison: {
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
    }
  });
});

// PDF Generation Route
app.post('/api/reports/roi-pdf', async (req, res) => {
  try {
    const { customerInfo } = req.body;
    const calculations = getAllCalculations();
    
    const pdf = await pdfGenerator.generateROIReport(calculations, customerInfo);
    
    res.contentType('application/pdf');
    res.send(pdf);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excel Export Route
app.get('/api/export/excel', async (req, res) => {
  const XLSX = require('xlsx');
  
  try {
    const calculations = getAllCalculations();
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create calculations sheet
    const calcData = calculations.map(calc => ({
      Tier: calc.tier,
      'Base Price': calc.basePrice,
      'Admin Savings': calc.adminSavings,
      'Travel Savings': calc.travelSavings,
      'Revenue Recovery': calc.revenueRecovery,
      'Payment Recovery': calc.paymentRecovery,
      'Upsell Revenue': calc.upsellRevenue,
      'Predictive Maintenance': calc.predictiveMaintenance,
      'Monthly ROI': calc.monthlyROI,
      'Annual ROI': calc.annualROI,
      'Payback Period (months)': calc.paybackPeriod,
      'ROI %': calc.totalROI
    }));
    
    const ws = XLSX.utils.json_to_sheet(calcData);
    XLSX.utils.book_append_sheet(wb, ws, 'ROI Calculations');
    
    // Create config sheet
    const configData = [{
      'Hourly Rate': config.hourlyRate,
      'Monthly Revenue': config.monthlyRevenue,
      'Manual Admin Hours': config.manualAdminHours,
      'Manual Travel Hours': config.manualTravelHours
    }];
    
    const ws2 = XLSX.utils.json_to_sheet(configData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Configuration');
    
    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Disposition', 'attachment; filename="invisible-fence-roi.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export', async (req, res) => {
  const calculations = getAllCalculations();
  res.json({
    config,
    inputs: tierData,
    calculations,
    timestamp: new Date().toISOString()
  });
});

// Server-sent events for real-time updates
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send initial connection message
  res.write('event: connected\n');
  res.write('data: {"message": "Connected to event stream"}\n\n');

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// =================
// CRM Routes
// =================
app.use('/api/crm', crmRoutes);

// =================
// Quote Generation Routes
// =================
app.use('/api/quote', quoteRoutes);

// =================
// Maps Integration Routes
// =================
app.use('/api/maps', mapsRoutes);

// =================
// Pricing Approval Routes
// =================
app.use('/api/approval', approvalRoutes);

// =================
// Authentication Routes
// =================
app.use('/api/auth', authRoutes);

// =================
// Static File Serving
// =================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'index.html'));
});

app.get('/crm', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'crm-dashboard.html'));
});

app.get('/quote', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'quote-generator.html'));
});

app.get('/map', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'map-visualizer.html'));
});

app.get('/approvals', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'pricing-approvals.html'));
});

app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'auth.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'auth.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🚀 Invisible Fence Complete Platform Running! 🚀      ║
║                                                            ║
║     API Server:    http://localhost:${PORT}               ║
║     ROI Calculator: http://localhost:${PORT}               ║
║     CRM Dashboard: http://localhost:${PORT}/crm            ║
║     Quote Generator: http://localhost:${PORT}/quote        ║
║     Service Map: http://localhost:${PORT}/map              ║
║     Pricing Approvals: http://localhost:${PORT}/approvals ║
║     Authentication: http://localhost:${PORT}/auth          ║
║                                                            ║
║     Features:                                              ║
║     ✅ ROI Calculator with 3 pricing tiers                ║
║     ✅ Complete CRM with customer management              ║
║     ✅ Lead tracking and pipeline management              ║
║     ✅ Appointment scheduling system                      ║
║     ✅ Location-based pricing engine                      ║
║     ✅ Smart scheduling with fuel savings                 ║
║     ✅ Instant quote generator                            ║
║     ✅ PDF report generation                              ║
║     ✅ Excel export functionality                         ║
║     ✅ SQLite database persistence                        ║
║     ✅ Authentication & security                          ║
║     ✅ Maps integration & visualization                   ║
║     ✅ Pricing approval workflow                          ║
║     ✅ Firebase authentication (Google/Facebook)         ║
║                                                            ║
║     Default Login:                                         ║
║     Username: admin                                        ║
║     Password: admin123                                     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await db.close();
  await pdfGenerator.close();
  process.exit(0);
});