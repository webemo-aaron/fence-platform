const express = require('express');
const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'pricing' }));
app.get('/calculate-roi', (req, res) => res.json({ 
  annual_savings: 15000,
  fuel_savings: '25%',
  time_savings: '40%',
  recommendation: 'Professional Plan ($299/mo)'
}));
app.listen(process.env.PORT || 3004, () => console.log('Pricing Service running'));
