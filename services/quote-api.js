const express = require('express');
const SchedulingOptimizerService = require('./scheduling-optimizer.service');

const router = express.Router();
const optimizerService = new SchedulingOptimizerService();

// Initialize the service
optimizerService.initialize().catch(console.error);

// =================
// Quote Generation Routes
// =================

// Generate basic location-based quote
router.post('/basic', async (req, res) => {
  try {
    const { quote_request } = req.body;
    
    if (!quote_request.zip_code && !quote_request.city) {
      return res.status(400).json({ error: 'Location information required' });
    }

    const pricing = await optimizerService.calculateLocationBasedPrice(quote_request);
    
    res.json({
      success: true,
      pricing
    });
  } catch (error) {
    console.error('Error generating basic quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate optimized quote with scheduling options
router.post('/optimized', async (req, res) => {
  try {
    const { quote_request, scheduling_preferences } = req.body;
    
    if (!quote_request.zip_code && !quote_request.city) {
      return res.status(400).json({ error: 'Location information required' });
    }

    // Add geocoding coordinates if available (integrate with Google Maps API in production)
    if (quote_request.zip_code) {
      // Simulate coordinates for major ZIP codes (in production, use geocoding API)
      const coords = getCoordinatesForZip(quote_request.zip_code);
      quote_request.latitude = coords.latitude;
      quote_request.longitude = coords.longitude;
    }

    const pricing = await optimizerService.calculateOptimizedPrice(
      quote_request, 
      scheduling_preferences
    );
    
    res.json({
      success: true,
      pricing
    });
  } catch (error) {
    console.error('Error generating optimized quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save quote with customer information
router.post('/save', async (req, res) => {
  try {
    const quoteData = req.body;
    
    // Generate a basic quote first
    const quote_request = {
      address: quoteData.address,
      city: quoteData.city,
      state: quoteData.state,
      zip_code: quoteData.zip_code,
      property_size: quoteData.property_size || 8000,
      fence_perimeter: quoteData.fence_perimeter || 500,
      property_type: quoteData.property_type || 'Standard Residential',
      terrain_type: quoteData.terrain_type || 'Flat/Easy',
      num_pets: quoteData.num_pets || 1,
      selected_tier: quoteData.selected_tier || 'Professional'
    };

    const pricing = await optimizerService.calculateLocationBasedPrice(quote_request);
    
    // Save quote to database
    const quoteId = await optimizerService.saveQuote(quoteData, pricing);
    
    // Create lead in CRM
    const leadData = {
      first_name: quoteData.customer_name?.split(' ')[0] || '',
      last_name: quoteData.customer_name?.split(' ').slice(1).join(' ') || '',
      email: quoteData.customer_email,
      phone: quoteData.customer_phone,
      source: 'Website Quote',
      status: 'new',
      estimated_value: pricing.totals.one_time_installation,
      notes: `Quote generated for ${quoteData.property_type} property at ${quoteData.address}. ${quoteData.selected_tier} tier selected.`
    };

    // Save lead to CRM database
    await optimizerService.db.run(
      `INSERT INTO leads (
        first_name, last_name, email, phone, source, status, estimated_value, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        leadData.first_name, leadData.last_name, leadData.email, leadData.phone,
        leadData.source, leadData.status, leadData.estimated_value, leadData.notes
      ]
    );

    res.json({
      success: true,
      quote_id: quoteId,
      pricing
    });
  } catch (error) {
    console.error('Error saving quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get quote history
router.get('/history', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const quotes = await optimizerService.db.all(`
      SELECT 
        qh.*,
        CASE 
          WHEN qh.converted_to_customer = 1 THEN 'Converted'
          WHEN qh.status = 'pending' AND date(qh.created_at) > date('now', '-30 days') THEN 'Active'
          ELSE 'Expired'
        END as quote_status
      FROM quote_history qh
      ORDER BY qh.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json(quotes);
  } catch (error) {
    console.error('Error fetching quote history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get quote by ID
router.get('/:id', async (req, res) => {
  try {
    const quote = await optimizerService.db.get(
      'SELECT * FROM quote_history WHERE id = ?',
      [req.params.id]
    );

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.json(quote);
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update quote status
router.put('/:id/status', async (req, res) => {
  try {
    const { status, converted_to_customer } = req.body;
    
    await optimizerService.db.run(`
      UPDATE quote_history 
      SET status = ?, converted_to_customer = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, converted_to_customer ? 1 : 0, req.params.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating quote status:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Pricing Zone Management
// =================

// Get pricing zones
router.get('/zones/list', async (req, res) => {
  try {
    const zones = await optimizerService.db.all(`
      SELECT * FROM pricing_zones ORDER BY zone_name
    `);
    res.json(zones);
  } catch (error) {
    console.error('Error fetching pricing zones:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update pricing zone
router.put('/zones/:id', async (req, res) => {
  try {
    const { base_multiplier, labor_rate_hourly, market_demand, competition_level } = req.body;
    
    await optimizerService.db.run(`
      UPDATE pricing_zones 
      SET base_multiplier = ?, labor_rate_hourly = ?, market_demand = ?, 
          competition_level = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [base_multiplier, labor_rate_hourly, market_demand, competition_level, req.params.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating pricing zone:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Scheduling Optimization
// =================

// Get available scheduling options for a location and date
router.post('/scheduling/options', async (req, res) => {
  try {
    const { latitude, longitude, date, radius = 5 } = req.body;
    
    const clusters = await optimizerService.findNearbyJobClusters(
      latitude, longitude, date, date, radius
    );

    res.json({
      available_clusters: clusters,
      optimization_potential: clusters.length > 0
    });
  } catch (error) {
    console.error('Error fetching scheduling options:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new job cluster
router.post('/scheduling/clusters', async (req, res) => {
  try {
    const { technician_id, date, center_latitude, center_longitude } = req.body;
    
    const clusterId = await optimizerService.createJobCluster(
      technician_id, date, center_latitude, center_longitude
    );

    res.json({
      success: true,
      cluster_id: clusterId
    });
  } catch (error) {
    console.error('Error creating job cluster:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add job to cluster
router.post('/scheduling/clusters/:id/jobs', async (req, res) => {
  try {
    const clusterId = req.params.id;
    const jobData = req.body;
    
    const jobId = await optimizerService.addJobToCluster(clusterId, jobData);
    
    // Optimize route after adding job
    const optimizedRoute = await optimizerService.optimizeClusterRoute(clusterId);

    res.json({
      success: true,
      job_id: jobId,
      optimized_route: optimizedRoute
    });
  } catch (error) {
    console.error('Error adding job to cluster:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get cluster details
router.get('/scheduling/clusters/:id', async (req, res) => {
  try {
    const cluster = await optimizerService.db.get(
      'SELECT * FROM job_clusters WHERE id = ?',
      [req.params.id]
    );

    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    const jobs = await optimizerService.getClusterJobs(req.params.id);
    const route = await optimizerService.db.get(
      'SELECT * FROM route_cache WHERE cluster_id = ? ORDER BY optimized_at DESC LIMIT 1',
      [req.params.id]
    );

    res.json({
      cluster,
      jobs,
      route
    });
  } catch (error) {
    console.error('Error fetching cluster details:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Analytics
// =================

// Get pricing analytics
router.get('/analytics/pricing', async (req, res) => {
  try {
    const analytics = await optimizerService.getPricingAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching pricing analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get scheduling analytics
router.get('/analytics/scheduling', async (req, res) => {
  try {
    const analytics = await optimizerService.getSchedulingAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching scheduling analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Helper Functions
// =================

// Simulate geocoding (in production, use Google Maps Geocoding API)
function getCoordinatesForZip(zipCode) {
  const zipCoords = {
    '75201': { latitude: 32.7767, longitude: -96.7970 }, // Dallas
    '77001': { latitude: 29.7604, longitude: -95.3698 }, // Houston
    '78701': { latitude: 30.2672, longitude: -97.7431 }, // Austin
    '94102': { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
    '10001': { latitude: 40.7128, longitude: -74.0060 }, // New York
    '90001': { latitude: 34.0522, longitude: -118.2437 }, // Los Angeles
    '98101': { latitude: 47.6062, longitude: -122.3321 }, // Seattle
    '02101': { latitude: 42.3601, longitude: -71.0589 }, // Boston
    '30301': { latitude: 33.7490, longitude: -84.3880 }, // Atlanta
    '85001': { latitude: 33.4484, longitude: -112.0740 }, // Phoenix
    '80201': { latitude: 39.7392, longitude: -104.9903 }, // Denver
  };
  
  return zipCoords[zipCode] || { latitude: 32.7767, longitude: -96.7970 }; // Default to Dallas
}

module.exports = router;