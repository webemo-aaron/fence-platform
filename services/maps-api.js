const express = require('express');
const MapsIntegrationService = require('./maps-integration.service');

const router = express.Router();
const mapsService = new MapsIntegrationService();

// Initialize the service
mapsService.initialize().catch(console.error);

// =================
// Map Visualization Routes
// =================

// Get map visualization data
router.get('/visualization', async (req, res) => {
  try {
    const { bounds } = req.query;
    
    let boundsObj = null;
    if (bounds) {
      const [south, west, north, east] = bounds.split(',').map(parseFloat);
      boundsObj = { south, west, north, east };
    }

    const mapData = await mapsService.getMapVisualizationData(boundsObj);
    res.json(mapData);
  } catch (error) {
    console.error('Error fetching map visualization data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get analytics data for map
router.get('/analytics', async (req, res) => {
  try {
    const coverage = await mapsService.getServiceCoverageAnalysis();
    
    // Calculate derived metrics
    const totalCustomers = coverage.reduce((sum, area) => sum + area.customers, 0);
    const totalQuotes = coverage.reduce((sum, area) => sum + area.recentQuotes, 0);
    
    const analytics = {
      coverage: {
        totalCustomers,
        activeJobs: totalQuotes,
        serviceTerritories: coverage.length,
        coveragePercentage: Math.round((totalCustomers / (totalCustomers + 100)) * 100) // Simulated
      },
      routing: {
        activeRoutes: 8, // Would come from actual route data
        avgJobsPerRoute: 3.2,
        totalMilesSaved: 156,
        routeEfficiency: 78
      },
      savings: {
        monthlyFuelSavings: 2340,
        routeOptimizationSavings: 1890,
        customerSavings: totalQuotes * 45, // Estimated savings per quote
        totalSavings: 2340 + 1890 + (totalQuotes * 45)
      },
      territories: coverage
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching map analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Geocoding Routes
// =================

// Geocode an address
router.post('/geocode', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const result = await mapsService.geocodeAddress(address);
    res.json(result);
  } catch (error) {
    console.error('Error geocoding address:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch geocode multiple addresses
router.post('/geocode/batch', async (req, res) => {
  try {
    const { addresses } = req.body;
    
    if (!Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses must be an array' });
    }

    const results = [];
    for (const address of addresses) {
      try {
        const result = await mapsService.geocodeAddress(address);
        results.push({ address, ...result });
      } catch (error) {
        results.push({ address, error: error.message });
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error batch geocoding:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Route Optimization Routes
// =================

// Calculate optimal route between points
router.post('/route/optimize', async (req, res) => {
  try {
    const { waypoints } = req.body;
    
    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      return res.status(400).json({ error: 'At least 2 waypoints required' });
    }

    const route = await mapsService.calculateOptimalRoute(waypoints);
    res.json(route);
  } catch (error) {
    console.error('Error calculating optimal route:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update job clusters with geocoded locations
router.post('/update/clusters', async (req, res) => {
  try {
    await mapsService.updateJobClustersWithGeocode();
    res.json({ success: true, message: 'Job clusters updated with geocoded locations' });
  } catch (error) {
    console.error('Error updating job clusters:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Service Territory Management
// =================

// Get service territories
router.get('/territories', async (req, res) => {
  try {
    const territories = await mapsService.db.all(`
      SELECT * FROM service_territories WHERE is_active = 1 ORDER BY territory_name
    `);
    res.json(territories);
  } catch (error) {
    console.error('Error fetching service territories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new service territory
router.post('/territories', async (req, res) => {
  try {
    const { territory_name, center_latitude, center_longitude, radius_miles, technician_id } = req.body;
    
    const result = await mapsService.db.run(`
      INSERT INTO service_territories (
        territory_name, center_latitude, center_longitude, radius_miles, technician_id
      ) VALUES (?, ?, ?, ?, ?)
    `, [territory_name, center_latitude, center_longitude, radius_miles, technician_id]);

    res.json({ success: true, territory_id: result.id });
  } catch (error) {
    console.error('Error creating service territory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update service territory
router.put('/territories/:id', async (req, res) => {
  try {
    const { territory_name, center_latitude, center_longitude, radius_miles, technician_id } = req.body;
    
    await mapsService.db.run(`
      UPDATE service_territories 
      SET territory_name = ?, center_latitude = ?, center_longitude = ?, 
          radius_miles = ?, technician_id = ?
      WHERE id = ?
    `, [territory_name, center_latitude, center_longitude, radius_miles, technician_id, req.params.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating service territory:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Map Markers Management
// =================

// Get map markers
router.get('/markers', async (req, res) => {
  try {
    const { type, bounds } = req.query;
    
    let query = 'SELECT * FROM map_markers';
    let params = [];
    
    if (type) {
      query += ' WHERE marker_type = ?';
      params.push(type);
    }
    
    if (bounds) {
      const [south, west, north, east] = bounds.split(',').map(parseFloat);
      const whereClause = type ? ' AND' : ' WHERE';
      query += `${whereClause} latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`;
      params.push(south, north, west, east);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const markers = await mapsService.db.all(query, params);
    res.json(markers);
  } catch (error) {
    console.error('Error fetching map markers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create map marker
router.post('/markers', async (req, res) => {
  try {
    const { type, reference_id, latitude, longitude, title, description, options = {} } = req.body;
    
    const markerId = await mapsService.createMapMarker(
      type, reference_id, latitude, longitude, title, description, options
    );
    
    res.json({ success: true, marker_id: markerId });
  } catch (error) {
    console.error('Error creating map marker:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete map marker
router.delete('/markers/:id', async (req, res) => {
  try {
    await mapsService.db.run('DELETE FROM map_markers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting map marker:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Service Coverage Analysis
// =================

// Get detailed service coverage
router.get('/coverage', async (req, res) => {
  try {
    const coverage = await mapsService.getServiceCoverageAnalysis();
    res.json(coverage);
  } catch (error) {
    console.error('Error fetching service coverage:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze coverage gaps
router.get('/coverage/gaps', async (req, res) => {
  try {
    // Find areas with high quote activity but low service coverage
    const gaps = await mapsService.db.all(`
      SELECT 
        qh.city,
        qh.state,
        COUNT(*) as quote_count,
        AVG(qh.total_price) as avg_quote_value,
        CASE 
          WHEN COUNT(*) > 10 THEN 'High Demand'
          WHEN COUNT(*) > 5 THEN 'Medium Demand'
          ELSE 'Low Demand'
        END as demand_level
      FROM quote_history qh
      WHERE qh.created_at >= date('now', '-90 days')
        AND qh.converted_to_customer = 0
      GROUP BY qh.city, qh.state
      HAVING quote_count >= 3
      ORDER BY quote_count DESC
    `);

    res.json(gaps);
  } catch (error) {
    console.error('Error analyzing coverage gaps:', error);
    res.status(500).json({ error: error.message });
  }
});

// =================
// Integration with Existing Services
// =================

// Auto-geocode new quotes
router.post('/integration/geocode-quote', async (req, res) => {
  try {
    const { quote_id } = req.body;
    
    // Get quote details
    const quote = await mapsService.db.get(`
      SELECT * FROM quote_history WHERE id = ?
    `, [quote_id]);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Geocode the address
    const fullAddress = `${quote.address}, ${quote.city}, ${quote.state} ${quote.zip_code}`;
    const geocoded = await mapsService.geocodeAddress(fullAddress);

    if (geocoded.latitude && geocoded.longitude) {
      // Create map marker for quote
      await mapsService.createMapMarker(
        'job_site',
        quote_id,
        geocoded.latitude,
        geocoded.longitude,
        `Quote: ${quote.customer_name}`,
        `${quote.address}, ${quote.city}`,
        { icon_type: 'quote', color: 'orange' }
      );

      // Update quote with coordinates
      await mapsService.db.run(`
        UPDATE quote_history 
        SET latitude = ?, longitude = ?, formatted_address = ?
        WHERE id = ?
      `, [geocoded.latitude, geocoded.longitude, geocoded.formatted_address, quote_id]);
    }

    res.json({ success: true, geocoded });
  } catch (error) {
    console.error('Error geocoding quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Auto-geocode customer addresses
router.post('/integration/geocode-customers', async (req, res) => {
  try {
    const customers = await mapsService.db.all(`
      SELECT id, address, city, state, zip_code, first_name, last_name
      FROM customers 
      WHERE address IS NOT NULL AND city IS NOT NULL
    `);

    let geocoded = 0;
    for (const customer of customers) {
      const fullAddress = `${customer.address}, ${customer.city}, ${customer.state} ${customer.zip_code}`;
      const result = await mapsService.geocodeAddress(fullAddress);
      
      if (result.latitude && result.longitude) {
        // Create map marker for customer
        await mapsService.createMapMarker(
          'customer',
          customer.id,
          result.latitude,
          result.longitude,
          `${customer.first_name} ${customer.last_name}`,
          `${customer.address}, ${customer.city}`,
          { icon_type: 'customer', color: 'green' }
        );
        
        geocoded++;
      }
    }

    res.json({ success: true, customers_geocoded: geocoded, total_customers: customers.length });
  } catch (error) {
    console.error('Error geocoding customers:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;