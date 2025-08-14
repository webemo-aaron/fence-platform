const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const db = new sqlite3.Database(path.join(__dirname, 'data/invisible-fence.db'), (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// API Status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        database: 'connected',
        timestamp: new Date().toISOString()
    });
});

// CUSTOMERS ENDPOINTS
app.get('/api/customers', (req, res) => {
    db.all('SELECT * FROM customers ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            customers: rows,
            count: rows.length
        });
    });
});

app.get('/api/customers/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM customers WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Customer not found' });
            return;
        }
        res.json(row);
    });
});

app.post('/api/customers', (req, res) => {
    const { first_name, last_name, email, phone, address, city, state, zip, pet_name, pet_type, fence_type, tier } = req.body;
    
    const sql = `INSERT INTO customers (first_name, last_name, email, phone, address, city, state, zip, pet_name, pet_type, fence_type, tier) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [first_name, last_name, email, phone, address, city, state, zip, pet_name, pet_type, fence_type, tier || 'Essentials'], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            id: this.lastID,
            message: 'Customer created successfully'
        });
    });
});

app.put('/api/customers/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    const sql = `UPDATE customers SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    db.run(sql, values, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            message: 'Customer updated successfully',
            changes: this.changes
        });
    });
});

app.delete('/api/customers/:id', (req, res) => {
    const { id } = req.params;
    
    db.run('DELETE FROM customers WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            message: 'Customer deleted successfully',
            changes: this.changes
        });
    });
});

// LEADS ENDPOINTS
app.get('/api/leads', (req, res) => {
    db.all('SELECT * FROM leads ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            leads: rows,
            count: rows.length
        });
    });
});

app.get('/api/leads/:id', (req, res) => {
    const { id } = req.params;
    db.get('SELECT * FROM leads WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Lead not found' });
            return;
        }
        res.json(row);
    });
});

app.post('/api/leads', (req, res) => {
    const { first_name, last_name, email, phone, source, status, score, estimated_value, notes } = req.body;
    
    const sql = `INSERT INTO leads (first_name, last_name, email, phone, source, status, score, estimated_value, notes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [first_name, last_name, email, phone, source, status || 'new', score || 0, estimated_value, notes], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            id: this.lastID,
            message: 'Lead created successfully'
        });
    });
});

app.put('/api/leads/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    const sql = `UPDATE leads SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    db.run(sql, values, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            message: 'Lead updated successfully',
            changes: this.changes
        });
    });
});

// APPOINTMENTS ENDPOINTS
app.get('/api/appointments', (req, res) => {
    const sql = `
        SELECT a.*, 
               c.first_name || ' ' || c.last_name as customer_name,
               l.first_name || ' ' || l.last_name as lead_name
        FROM appointments a
        LEFT JOIN customers c ON a.customer_id = c.id
        LEFT JOIN leads l ON a.lead_id = l.id
        ORDER BY a.scheduled_date DESC
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            appointments: rows,
            count: rows.length
        });
    });
});

app.get('/api/appointments/:id', (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT a.*, 
               c.first_name || ' ' || c.last_name as customer_name,
               l.first_name || ' ' || l.last_name as lead_name
        FROM appointments a
        LEFT JOIN customers c ON a.customer_id = c.id
        LEFT JOIN leads l ON a.lead_id = l.id
        WHERE a.id = ?
    `;
    
    db.get(sql, [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Appointment not found' });
            return;
        }
        res.json(row);
    });
});

app.post('/api/appointments', (req, res) => {
    const { customer_id, lead_id, type, scheduled_date, duration_minutes, status, address, notes } = req.body;
    
    const sql = `INSERT INTO appointments (customer_id, lead_id, type, scheduled_date, duration_minutes, status, address, notes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [customer_id, lead_id, type, scheduled_date, duration_minutes || 60, status || 'scheduled', address, notes], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            id: this.lastID,
            message: 'Appointment created successfully'
        });
    });
});

app.put('/api/appointments/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    
    const sql = `UPDATE appointments SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    db.run(sql, values, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            message: 'Appointment updated successfully',
            changes: this.changes
        });
    });
});

// DASHBOARD STATS
app.get('/api/dashboard/stats', (req, res) => {
    const stats = {};
    
    // Get customer count
    db.get('SELECT COUNT(*) as count FROM customers WHERE status = "active"', [], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        stats.activeCustomers = row.count;
        
        // Get lead count
        db.get('SELECT COUNT(*) as count FROM leads WHERE status IN ("new", "contacted", "qualified")', [], (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            stats.activeLeads = row.count;
            
            // Get today's appointments
            db.get('SELECT COUNT(*) as count FROM appointments WHERE DATE(scheduled_date) = DATE("now")', [], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                stats.todayAppointments = row.count;
                
                // Get this week's appointments
                db.get('SELECT COUNT(*) as count FROM appointments WHERE DATE(scheduled_date) >= DATE("now", "-7 days")', [], (err, row) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    stats.weekAppointments = row.count;
                    
                    // Get monthly revenue (simulated)
                    db.get('SELECT SUM(monthly_revenue) as total FROM customers WHERE status = "active"', [], (err, row) => {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        stats.monthlyRevenue = row.total || 15750; // Default if no data
                        
                        res.json(stats);
                    });
                });
            });
        });
    });
});

// PIPELINE STATS
app.get('/api/pipeline/stats', (req, res) => {
    const sql = `
        SELECT status, COUNT(*) as count, SUM(estimated_value) as value
        FROM leads
        GROUP BY status
    `;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        const pipeline = {
            'new': { count: 0, value: 0 },
            'contacted': { count: 0, value: 0 },
            'qualified': { count: 0, value: 0 },
            'proposal': { count: 0, value: 0 },
            'negotiation': { count: 0, value: 0 },
            'closed': { count: 0, value: 0 }
        };
        
        rows.forEach(row => {
            if (pipeline[row.status]) {
                pipeline[row.status] = {
                    count: row.count,
                    value: row.value || 0
                };
            }
        });
        
        res.json(pipeline);
    });
});

// PROPERTY DESIGNS (saved fence designs)
app.post('/api/property-designs', (req, res) => {
    const { customer_id, design_data } = req.body;
    
    // Store design in a simple JSON field (you could create a separate table for this)
    const sql = `UPDATE customers SET fence_design = ? WHERE id = ?`;
    
    db.run(sql, [JSON.stringify(design_data), customer_id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            message: 'Design saved successfully',
            customer_id: customer_id
        });
    });
});

app.get('/api/property-designs/:customer_id', (req, res) => {
    const { customer_id } = req.params;
    
    db.get('SELECT fence_design FROM customers WHERE id = ?', [customer_id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row || !row.fence_design) {
            res.status(404).json({ error: 'No design found for this customer' });
            return;
        }
        res.json(JSON.parse(row.fence_design));
    });
});

// Google Maps Configuration
app.get('/api/maps-config', (req, res) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    const isConfigured = apiKey && apiKey !== 'YOUR_API_KEY_HERE';
    
    res.json({
        configured: isConfigured,
        apiKey: isConfigured ? apiKey : null,
        libraries: ['drawing', 'places', 'geometry'],
        defaultCenter: { lat: 32.7767, lng: -96.7970 },
        defaultZoom: 18,
        message: isConfigured ? 'Google Maps API configured' : 'Google Maps API key not configured'
    });
});

// Start server
const PORT = process.env.PORT || 3334;
app.listen(PORT, () => {
    console.log(`Database API Server running on port ${PORT}`);
    console.log(`API Status: http://localhost:${PORT}/api/status`);
    console.log(`Customers: http://localhost:${PORT}/api/customers`);
    console.log(`Leads: http://localhost:${PORT}/api/leads`);
    console.log(`Appointments: http://localhost:${PORT}/api/appointments`);
    console.log(`Dashboard Stats: http://localhost:${PORT}/api/dashboard/stats`);
});