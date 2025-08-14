const express = require('express');
const cors = require('cors');
const { EventEmitter } = require('eventemitter3');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Simple in-memory storage for demo
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

// Routes
app.get('/api/status', (req, res) => {
  res.json({
    initialized: true,
    tiers: Object.keys(tierData),
    message: 'Invisible Fence ROI Calculator API is running'
  });
});

// Google Maps API Configuration endpoint
app.get('/api/maps-config', (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
  const isConfigured = apiKey && apiKey !== 'YOUR_API_KEY_HERE';
  
  res.json({
    configured: isConfigured,
    apiKey: isConfigured ? apiKey : null,
    libraries: ['drawing', 'places', 'geometry'],
    defaultCenter: { lat: 32.7767, lng: -96.7970 }, // Dallas
    defaultZoom: 18,
    message: isConfigured ? 'Google Maps API configured' : 'Google Maps API key not configured. Please set GOOGLE_MAPS_API_KEY in .env file'
  });
});

app.get('/api/calculations', (req, res) => {
  const calculations = getAllCalculations();
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

app.get('/api/export', (req, res) => {
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

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Invisible Fence ROI Calculator API running on port ${PORT}`);
  console.log(`API Status: http://localhost:${PORT}/api/status`);
  console.log(`Web UI: http://localhost:9090`);
});