const express = require('express');
const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'auth' }));
app.post('/login', (req, res) => res.json({ token: 'demo-jwt-token', user: req.body.email }));
app.post('/signup', (req, res) => res.json({ success: true, tenant_id: 'demo-tenant' }));
app.listen(process.env.PORT || 3001, () => console.log('Auth Service running'));
