const DatabaseService = require('./database.service');

class MapsIntegrationService extends DatabaseService {
  constructor() {
    super();
    this.geocodingCache = new Map();
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || 'demo-key';
    this.isDemo = !process.env.GOOGLE_MAPS_API_KEY;
  }

  async initialize() {
    await super.initialize();
    await this.createMapsIntegrationTables();
  }

  async createMapsIntegrationTables() {
    const tables = [
      // Geocoding cache table
      `CREATE TABLE IF NOT EXISTS geocoding_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        address TEXT NOT NULL UNIQUE,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        formatted_address TEXT,
        place_id TEXT,
        cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME DEFAULT (datetime('now', '+30 days'))
      )`,
      
      // Service territories table
      `CREATE TABLE IF NOT EXISTS service_territories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        territory_name TEXT NOT NULL,
        center_latitude REAL NOT NULL,
        center_longitude REAL NOT NULL,
        radius_miles REAL DEFAULT 25,
        boundary_coordinates TEXT, -- JSON polygon coordinates
        technician_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (technician_id) REFERENCES users(id)
      )`,
      
      // Map markers for visualization
      `CREATE TABLE IF NOT EXISTS map_markers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        marker_type TEXT NOT NULL, -- 'customer', 'job_site', 'service_center', 'cluster'
        reference_id INTEGER,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        title TEXT,
        description TEXT,
        icon_type TEXT DEFAULT 'default',
        color TEXT DEFAULT 'blue',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const query of tables) {
      await this.db.run(query);
    }

    await this.seedServiceTerritories();
  }

  async seedServiceTerritories() {
    // Check if territories exist
    const existing = await this.db.get('SELECT COUNT(*) as count FROM service_territories');
    if (existing.count > 0) return;

    // Create default service territories
    const territories = [
      {
        territory_name: 'Dallas Metro',
        center_latitude: 32.7767,
        center_longitude: -96.7970,
        radius_miles: 30
      },
      {
        territory_name: 'Houston Metro',
        center_latitude: 29.7604,
        center_longitude: -95.3698,
        radius_miles: 35
      },
      {
        territory_name: 'Austin Metro',
        center_latitude: 30.2672,
        center_longitude: -97.7431,
        radius_miles: 25
      },
      {
        territory_name: 'San Antonio Metro',
        center_latitude: 29.4241,
        center_longitude: -98.4936,
        radius_miles: 30
      }
    ];

    for (const territory of territories) {
      await this.db.run(`
        INSERT INTO service_territories (
          territory_name, center_latitude, center_longitude, radius_miles
        ) VALUES (?, ?, ?, ?)
      `, [
        territory.territory_name,
        territory.center_latitude,
        territory.center_longitude,
        territory.radius_miles
      ]);
    }
  }

  // Geocode an address using Google Maps API or demo data
  async geocodeAddress(address) {
    // Check cache first
    const cached = await this.getCachedGeocoding(address);
    if (cached) return cached;

    let result;
    
    if (this.isDemo) {
      // Use demo geocoding for development
      result = this.getDemoGeocode(address);
    } else {
      // Use actual Google Maps Geocoding API
      result = await this.callGoogleGeocodingAPI(address);
    }

    // Cache the result
    if (result.latitude && result.longitude) {
      await this.cacheGeocodingResult(address, result);
    }

    return result;
  }

  async getCachedGeocoding(address) {
    const cached = await this.db.get(`
      SELECT * FROM geocoding_cache 
      WHERE address = ? AND expires_at > datetime('now')
    `, [address.toLowerCase()]);

    if (cached) {
      return {
        latitude: cached.latitude,
        longitude: cached.longitude,
        formatted_address: cached.formatted_address,
        place_id: cached.place_id
      };
    }

    return null;
  }

  async cacheGeocodingResult(address, result) {
    await this.db.run(`
      INSERT OR REPLACE INTO geocoding_cache (
        address, latitude, longitude, formatted_address, place_id
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      address.toLowerCase(),
      result.latitude,
      result.longitude,
      result.formatted_address,
      result.place_id
    ]);
  }

  // Demo geocoding for development (simulates real data)
  getDemoGeocode(address) {
    const lowerAddress = address.toLowerCase();
    
    // Common city/ZIP mappings for demo
    if (lowerAddress.includes('dallas') || lowerAddress.includes('75')) {
      return {
        latitude: 32.7767 + (Math.random() - 0.5) * 0.2,
        longitude: -96.7970 + (Math.random() - 0.5) * 0.2,
        formatted_address: `${address}, Dallas, TX`,
        place_id: `demo_${Date.now()}`
      };
    }
    
    if (lowerAddress.includes('houston') || lowerAddress.includes('77')) {
      return {
        latitude: 29.7604 + (Math.random() - 0.5) * 0.2,
        longitude: -95.3698 + (Math.random() - 0.5) * 0.2,
        formatted_address: `${address}, Houston, TX`,
        place_id: `demo_${Date.now()}`
      };
    }
    
    if (lowerAddress.includes('austin') || lowerAddress.includes('78')) {
      return {
        latitude: 30.2672 + (Math.random() - 0.5) * 0.2,
        longitude: -97.7431 + (Math.random() - 0.5) * 0.2,
        formatted_address: `${address}, Austin, TX`,
        place_id: `demo_${Date.now()}`
      };
    }

    // Default to Dallas area
    return {
      latitude: 32.7767 + (Math.random() - 0.5) * 0.3,
      longitude: -96.7970 + (Math.random() - 0.5) * 0.3,
      formatted_address: `${address}, TX`,
      place_id: `demo_${Date.now()}`
    };
  }

  // Call actual Google Maps Geocoding API
  async callGoogleGeocodingAPI(address) {
    try {
      const fetch = require('node-fetch');
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        return {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          formatted_address: result.formatted_address,
          place_id: result.place_id
        };
      }
      
      throw new Error(`Geocoding failed: ${data.status}`);
    } catch (error) {
      console.error('Geocoding API error:', error);
      // Fallback to demo data
      return this.getDemoGeocode(address);
    }
  }

  // Create a map marker for visualization
  async createMapMarker(type, referenceId, latitude, longitude, title, description, options = {}) {
    const result = await this.db.run(`
      INSERT INTO map_markers (
        marker_type, reference_id, latitude, longitude, title, description, icon_type, color
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      type,
      referenceId,
      latitude,
      longitude,
      title,
      description,
      options.icon_type || 'default',
      options.color || 'blue'
    ]);

    return result.id;
  }

  // Get map data for visualization
  async getMapVisualizationData(bounds = null) {
    // Get all map markers
    let markersQuery = 'SELECT * FROM map_markers ORDER BY created_at DESC';
    let markersParams = [];

    if (bounds) {
      markersQuery = `
        SELECT * FROM map_markers 
        WHERE latitude BETWEEN ? AND ? 
          AND longitude BETWEEN ? AND ?
        ORDER BY created_at DESC
      `;
      markersParams = [bounds.south, bounds.north, bounds.west, bounds.east];
    }

    const markers = await this.db.all(markersQuery, markersParams);

    // Get service territories
    const territories = await this.db.all(`
      SELECT * FROM service_territories WHERE is_active = 1
    `);

    // Get active job clusters
    const clusters = await this.db.all(`
      SELECT 
        jc.*,
        COUNT(cj.id) as job_count,
        GROUP_CONCAT(cj.latitude || ',' || cj.longitude) as job_coordinates
      FROM job_clusters jc
      LEFT JOIN cluster_jobs cj ON jc.id = cj.cluster_id
      WHERE jc.status = 'active'
      GROUP BY jc.id
    `);

    return {
      markers: markers.map(marker => ({
        id: marker.id,
        type: marker.marker_type,
        position: {
          lat: marker.latitude,
          lng: marker.longitude
        },
        title: marker.title,
        description: marker.description,
        icon: {
          type: marker.icon_type,
          color: marker.color
        }
      })),
      territories: territories.map(territory => ({
        id: territory.id,
        name: territory.territory_name,
        center: {
          lat: territory.center_latitude,
          lng: territory.center_longitude
        },
        radius: territory.radius_miles
      })),
      clusters: clusters.map(cluster => {
        const jobCoords = cluster.job_coordinates 
          ? cluster.job_coordinates.split(',').map(coord => parseFloat(coord))
          : [];
        
        const jobs = [];
        for (let i = 0; i < jobCoords.length; i += 2) {
          if (jobCoords[i] && jobCoords[i + 1]) {
            jobs.push({
              lat: jobCoords[i],
              lng: jobCoords[i + 1]
            });
          }
        }

        return {
          id: cluster.id,
          date: cluster.cluster_date,
          center: {
            lat: cluster.center_latitude,
            lng: cluster.center_longitude
          },
          jobCount: cluster.job_count,
          jobs,
          savings: cluster.total_travel_savings || 0
        };
      })
    };
  }

  // Calculate optimal route between multiple points
  async calculateOptimalRoute(waypoints) {
    if (waypoints.length < 2) {
      return { distance: 0, duration: 0, route: waypoints };
    }

    if (this.isDemo) {
      return this.getDemoRoute(waypoints);
    }

    // Use Google Directions API for production
    return await this.callGoogleDirectionsAPI(waypoints);
  }

  // Demo route calculation
  getDemoRoute(waypoints) {
    let totalDistance = 0;
    let totalDuration = 0;

    // Simple straight-line distance calculation for demo
    for (let i = 0; i < waypoints.length - 1; i++) {
      const distance = this.calculateDistance(
        waypoints[i].lat, waypoints[i].lng,
        waypoints[i + 1].lat, waypoints[i + 1].lng
      );
      totalDistance += distance;
      totalDuration += distance * 2; // 2 minutes per mile (demo)
    }

    return {
      distance: Math.round(totalDistance * 10) / 10,
      duration: Math.round(totalDuration),
      route: waypoints,
      polyline: this.generateDemoPolyline(waypoints)
    };
  }

  // Generate a simple polyline for demo visualization
  generateDemoPolyline(waypoints) {
    return waypoints.map(point => `${point.lat},${point.lng}`).join('|');
  }

  // Call Google Directions API
  async callGoogleDirectionsAPI(waypoints) {
    try {
      const fetch = require('node-fetch');
      const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
      const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;
      
      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${this.apiKey}`;
      
      if (waypoints.length > 2) {
        const waypointsStr = waypoints.slice(1, -1)
          .map(wp => `${wp.lat},${wp.lng}`)
          .join('|');
        url += `&waypoints=optimize:true|${waypointsStr}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        return {
          distance: leg.distance.value / 1609.34, // Convert meters to miles
          duration: leg.duration.value / 60, // Convert seconds to minutes
          route: waypoints,
          polyline: route.overview_polyline.points
        };
      }
      
      throw new Error(`Directions API failed: ${data.status}`);
    } catch (error) {
      console.error('Directions API error:', error);
      // Fallback to demo calculation
      return this.getDemoRoute(waypoints);
    }
  }

  // Update job cluster locations with actual coordinates
  async updateJobClustersWithGeocode() {
    const clusters = await this.db.all(`
      SELECT jc.*, cj.quote_id, qh.address, qh.city, qh.state, qh.zip_code
      FROM job_clusters jc
      LEFT JOIN cluster_jobs cj ON jc.id = cj.cluster_id
      LEFT JOIN quote_history qh ON cj.quote_id = qh.id
      WHERE jc.status = 'active' AND qh.address IS NOT NULL
    `);

    for (const cluster of clusters) {
      if (cluster.address) {
        const fullAddress = `${cluster.address}, ${cluster.city}, ${cluster.state} ${cluster.zip_code}`;
        const geocoded = await this.geocodeAddress(fullAddress);
        
        if (geocoded.latitude && geocoded.longitude) {
          // Update cluster job with actual coordinates
          await this.db.run(`
            UPDATE cluster_jobs 
            SET latitude = ?, longitude = ?
            WHERE cluster_id = ? AND quote_id = ?
          `, [geocoded.latitude, geocoded.longitude, cluster.id, cluster.quote_id]);
          
          // Create map marker for visualization
          await this.createMapMarker(
            'job_site',
            cluster.quote_id,
            geocoded.latitude,
            geocoded.longitude,
            `Installation: ${cluster.address}`,
            `Cluster ${cluster.id} - ${cluster.cluster_date}`,
            { icon_type: 'installation', color: 'green' }
          );
        }
      }
    }
  }

  // Get service coverage analysis
  async getServiceCoverageAnalysis() {
    const territories = await this.db.all(`
      SELECT * FROM service_territories WHERE is_active = 1
    `);

    const coverage = [];

    for (const territory of territories) {
      // Count customers in territory
      const customersInTerritory = await this.db.get(`
        SELECT COUNT(*) as count
        FROM customers c
        WHERE EXISTS (
          SELECT 1 FROM geocoding_cache gc
          WHERE gc.formatted_address LIKE '%' || c.city || '%'
            AND (
              (gc.latitude - ?) * (gc.latitude - ?) + 
              (gc.longitude - ?) * (gc.longitude - ?)
            ) <= (? * 0.0145)
        )
      `, [
        territory.center_latitude, territory.center_latitude,
        territory.center_longitude, territory.center_longitude,
        territory.radius_miles
      ]);

      // Count recent quotes in territory
      const quotesInTerritory = await this.db.get(`
        SELECT COUNT(*) as count
        FROM quote_history qh
        WHERE qh.created_at >= date('now', '-30 days')
          AND EXISTS (
            SELECT 1 FROM geocoding_cache gc
            WHERE gc.formatted_address LIKE '%' || qh.city || '%'
              AND (
                (gc.latitude - ?) * (gc.latitude - ?) + 
                (gc.longitude - ?) * (gc.longitude - ?)
              ) <= (? * 0.0145)
          )
      `, [
        territory.center_latitude, territory.center_latitude,
        territory.center_longitude, territory.center_longitude,
        territory.radius_miles
      ]);

      coverage.push({
        territory: territory.territory_name,
        customers: customersInTerritory.count,
        recentQuotes: quotesInTerritory.count,
        coverage_radius: territory.radius_miles,
        center: {
          lat: territory.center_latitude,
          lng: territory.center_longitude
        }
      });
    }

    return coverage;
  }

  // Calculate distance between two points (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

module.exports = MapsIntegrationService;