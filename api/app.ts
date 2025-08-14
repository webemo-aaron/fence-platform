import express from 'express';
import cors from 'cors';
import { AutomationOrchestrator } from '../services/automation-orchestrator';
import { TierInput, TierLevel } from '../models/tier-input.model';

const app = express();
const orchestrator = new AutomationOrchestrator();

app.use(cors());
app.use(express.json());

// Initialize orchestrator on startup
orchestrator.initialize().then(() => {
  console.log('Automation orchestrator initialized');
}).catch(error => {
  console.error('Failed to initialize orchestrator:', error);
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json(orchestrator.getStatus());
});

// Get all calculations
app.get('/api/calculations', (req, res) => {
  const data = orchestrator.exportData();
  res.json(data);
});

// Update tier input
app.post('/api/tiers/:tier', async (req, res) => {
  try {
    const tier = req.params.tier as TierLevel;
    const input: TierInput = {
      tier,
      ...req.body
    };
    
    await orchestrator.updateTierInput(input);
    res.json({ success: true, tier });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update configuration
app.post('/api/config', async (req, res) => {
  try {
    await orchestrator.updateConfiguration(req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Generate scenario
app.post('/api/scenarios', async (req, res) => {
  try {
    const { name, inputs } = req.body;
    const result = await orchestrator.generateScenario(name, inputs);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Export data
app.get('/api/export', async (req, res) => {
  try {
    const data = await orchestrator.exportData();
    res.json(data);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Event stream for real-time updates
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Listen to orchestrator events
  orchestrator.on('processing-update', (data) => sendEvent('processing', data));
  orchestrator.on('tier-update-complete', (data) => sendEvent('tier-updated', data));
  orchestrator.on('config-update-complete', (data) => sendEvent('config-updated', data));
  orchestrator.on('all-charts-ready', (data) => sendEvent('charts-ready', data));
  orchestrator.on('scenario-generated', (data) => sendEvent('scenario', data));

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    orchestrator.removeAllListeners();
  });
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Invisible Fence Automation API running on port ${PORT}`);
});