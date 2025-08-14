const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(express.static('ui'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    version: '2.0.0',
    message: 'Fence Platform Multi-Tenant System'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fence Platform - Multi-Tenant SaaS</title>
      <style>
        body { font-family: Arial; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .container { max-width: 800px; margin: 0 auto; text-align: center; }
        h1 { font-size: 48px; margin-bottom: 20px; }
        .demo-links { margin-top: 40px; }
        .demo-links a { display: inline-block; margin: 10px; padding: 15px 30px; background: white; color: #667eea; text-decoration: none; border-radius: 5px; font-weight: bold; }
        .demo-links a:hover { background: #f0f0f0; }
        .features { margin-top: 40px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .feature { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🚀 Fence Platform</h1>
        <h2>Multi-Tenant SaaS for Fence Installation Businesses</h2>
        
        <div class="demo-links">
          <a href="/ui/demo-landing.html">Demo Portal</a>
          <a href="/ui/signup.html">Sign Up</a>
          <a href="/ui/index.html">Dashboard</a>
          <a href="/health">API Health</a>
        </div>
        
        <div class="features">
          <div class="feature">
            <h3>💰 ROI Calculator</h3>
            <p>Show customers $15,000+ annual savings</p>
          </div>
          <div class="feature">
            <h3>🗺️ Route Optimization</h3>
            <p>Save 25% on fuel costs</p>
          </div>
          <div class="feature">
            <h3>📊 Multi-Tenant</h3>
            <p>Serve unlimited fence businesses</p>
          </div>
        </div>
        
        <p style="margin-top: 40px;">
          <strong>Demo Accounts:</strong><br>
          Texas Fence Pro: admin@texasfencepro.com / DemoPass123!<br>
          Austin Invisible: admin@austinfence.com / DemoPass123!<br>
          Hill Country: admin@hillcountryfence.com / DemoPass123!
        </p>
      </div>
    </body>
    </html>
  `);
});

// API endpoints
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'operational',
    platform: 'Fence Platform Multi-Tenant',
    capabilities: ['ROI Calculator', 'Route Optimization', 'Multi-Tenant', 'Import Wizard']
  });
});

app.listen(PORT, () => {
  console.log(`Fence Platform running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
});
