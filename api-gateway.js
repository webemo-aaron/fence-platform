const express = require('express');
const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'api-gateway' }));
app.get('/', (req, res) => res.json({ 
  platform: 'Fence Platform', 
  services: ['auth', 'pricing', 'crm', 'maps'],
  demo_accounts: [
    'admin@texasfencepro.com / DemoPass123!',
    'admin@austinfence.com / DemoPass123!'
  ]
}));
app.listen(process.env.PORT || 8080, () => console.log('API Gateway running'));
