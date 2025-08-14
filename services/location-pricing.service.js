const DatabaseService = require('./database.service');

class LocationPricingService {
  constructor() {
    this.db = new DatabaseService();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    await this.db.initialize();
    await this.createTables();
    await this.seedPricingData();
    this.initialized = true;
  }

  async createTables() {
    const tables = [
      // Pricing zones table
      `CREATE TABLE IF NOT EXISTS pricing_zones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone_name TEXT NOT NULL,
        state TEXT NOT NULL,
        city TEXT,
        zip_code TEXT,
        base_multiplier REAL DEFAULT 1.0,
        labor_rate_hourly REAL DEFAULT 35,
        material_markup REAL DEFAULT 1.2,
        market_demand TEXT DEFAULT 'normal',
        competition_level TEXT DEFAULT 'moderate',
        average_property_size INTEGER DEFAULT 8000,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Service centers table
      `CREATE TABLE IF NOT EXISTS service_centers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip_code TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        max_service_radius_miles INTEGER DEFAULT 50,
        technician_count INTEGER DEFAULT 5,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Property types and pricing
      `CREATE TABLE IF NOT EXISTS property_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type_name TEXT NOT NULL,
        base_price REAL NOT NULL,
        per_foot_price REAL DEFAULT 0.50,
        difficulty_multiplier REAL DEFAULT 1.0,
        typical_install_hours REAL DEFAULT 4,
        description TEXT
      )`,
      
      // Terrain modifiers
      `CREATE TABLE IF NOT EXISTS terrain_modifiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        terrain_type TEXT NOT NULL,
        difficulty_multiplier REAL DEFAULT 1.0,
        additional_hours REAL DEFAULT 0,
        description TEXT
      )`,
      
      // Distance pricing tiers
      `CREATE TABLE IF NOT EXISTS distance_pricing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        min_miles REAL NOT NULL,
        max_miles REAL NOT NULL,
        trip_charge REAL DEFAULT 0,
        per_mile_charge REAL DEFAULT 0,
        description TEXT
      )`,
      
      // Quote history
      `CREATE TABLE IF NOT EXISTS quote_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT,
        customer_email TEXT,
        customer_phone TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip_code TEXT,
        property_size INTEGER,
        property_type TEXT,
        terrain_type TEXT,
        fence_perimeter INTEGER,
        num_pets INTEGER DEFAULT 1,
        selected_tier TEXT,
        base_price REAL,
        location_multiplier REAL,
        distance_charge REAL,
        terrain_charge REAL,
        total_price REAL,
        quote_valid_days INTEGER DEFAULT 30,
        status TEXT DEFAULT 'pending',
        converted_to_customer BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Competitor pricing (for market analysis)
      `CREATE TABLE IF NOT EXISTS competitor_pricing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competitor_name TEXT NOT NULL,
        zip_code TEXT,
        city TEXT,
        state TEXT,
        service_type TEXT,
        price_low REAL,
        price_high REAL,
        last_updated DATE,
        source TEXT,
        notes TEXT
      )`
    ];

    for (const query of tables) {
      await this.db.run(query);
    }
  }

  async seedPricingData() {
    // Check if data already exists
    const existing = await this.db.get('SELECT COUNT(*) as count FROM pricing_zones');
    if (existing.count > 0) return;

    // Seed pricing zones (major US markets)
    const zones = [
      // High-cost markets
      { zone_name: 'San Francisco Bay Area', state: 'CA', city: 'San Francisco', zip_code: '94102', base_multiplier: 1.45, labor_rate_hourly: 65, market_demand: 'high', competition_level: 'high' },
      { zone_name: 'New York Metro', state: 'NY', city: 'New York', zip_code: '10001', base_multiplier: 1.40, labor_rate_hourly: 60, market_demand: 'high', competition_level: 'high' },
      { zone_name: 'Los Angeles', state: 'CA', city: 'Los Angeles', zip_code: '90001', base_multiplier: 1.35, labor_rate_hourly: 55, market_demand: 'high', competition_level: 'high' },
      { zone_name: 'Seattle', state: 'WA', city: 'Seattle', zip_code: '98101', base_multiplier: 1.30, labor_rate_hourly: 52, market_demand: 'high', competition_level: 'moderate' },
      { zone_name: 'Boston', state: 'MA', city: 'Boston', zip_code: '02101', base_multiplier: 1.32, labor_rate_hourly: 54, market_demand: 'high', competition_level: 'high' },
      
      // Mid-cost markets
      { zone_name: 'Dallas-Fort Worth', state: 'TX', city: 'Dallas', zip_code: '75201', base_multiplier: 1.10, labor_rate_hourly: 42, market_demand: 'high', competition_level: 'moderate' },
      { zone_name: 'Atlanta', state: 'GA', city: 'Atlanta', zip_code: '30301', base_multiplier: 1.08, labor_rate_hourly: 40, market_demand: 'normal', competition_level: 'moderate' },
      { zone_name: 'Phoenix', state: 'AZ', city: 'Phoenix', zip_code: '85001', base_multiplier: 1.05, labor_rate_hourly: 38, market_demand: 'normal', competition_level: 'moderate' },
      { zone_name: 'Denver', state: 'CO', city: 'Denver', zip_code: '80201', base_multiplier: 1.15, labor_rate_hourly: 44, market_demand: 'high', competition_level: 'moderate' },
      { zone_name: 'Austin', state: 'TX', city: 'Austin', zip_code: '78701', base_multiplier: 1.18, labor_rate_hourly: 45, market_demand: 'high', competition_level: 'low' },
      
      // Lower-cost markets
      { zone_name: 'Kansas City', state: 'MO', city: 'Kansas City', zip_code: '64101', base_multiplier: 0.95, labor_rate_hourly: 35, market_demand: 'normal', competition_level: 'low' },
      { zone_name: 'Columbus', state: 'OH', city: 'Columbus', zip_code: '43201', base_multiplier: 0.92, labor_rate_hourly: 34, market_demand: 'normal', competition_level: 'low' },
      { zone_name: 'Memphis', state: 'TN', city: 'Memphis', zip_code: '38101', base_multiplier: 0.88, labor_rate_hourly: 32, market_demand: 'low', competition_level: 'low' },
      { zone_name: 'Rural Texas', state: 'TX', city: null, zip_code: '79901', base_multiplier: 0.85, labor_rate_hourly: 30, market_demand: 'low', competition_level: 'low' },
      { zone_name: 'Rural Midwest', state: 'IA', city: null, zip_code: '50301', base_multiplier: 0.82, labor_rate_hourly: 28, market_demand: 'low', competition_level: 'low' }
    ];

    for (const zone of zones) {
      await this.db.run(
        `INSERT INTO pricing_zones (zone_name, state, city, zip_code, base_multiplier, labor_rate_hourly, market_demand, competition_level) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [zone.zone_name, zone.state, zone.city, zone.zip_code, zone.base_multiplier, zone.labor_rate_hourly, zone.market_demand, zone.competition_level]
      );
    }

    // Seed property types
    const propertyTypes = [
      { type_name: 'Small Residential', base_price: 1500, per_foot_price: 0.45, difficulty_multiplier: 1.0, typical_install_hours: 3 },
      { type_name: 'Standard Residential', base_price: 2500, per_foot_price: 0.50, difficulty_multiplier: 1.0, typical_install_hours: 4 },
      { type_name: 'Large Residential', base_price: 3500, per_foot_price: 0.55, difficulty_multiplier: 1.1, typical_install_hours: 6 },
      { type_name: 'Estate Property', base_price: 5000, per_foot_price: 0.60, difficulty_multiplier: 1.2, typical_install_hours: 8 },
      { type_name: 'Commercial', base_price: 7500, per_foot_price: 0.75, difficulty_multiplier: 1.3, typical_install_hours: 12 },
      { type_name: 'Farm/Ranch', base_price: 4000, per_foot_price: 0.35, difficulty_multiplier: 1.15, typical_install_hours: 10 }
    ];

    for (const type of propertyTypes) {
      await this.db.run(
        `INSERT INTO property_types (type_name, base_price, per_foot_price, difficulty_multiplier, typical_install_hours) 
         VALUES (?, ?, ?, ?, ?)`,
        [type.type_name, type.base_price, type.per_foot_price, type.difficulty_multiplier, type.typical_install_hours]
      );
    }

    // Seed terrain modifiers
    const terrains = [
      { terrain_type: 'Flat/Easy', difficulty_multiplier: 1.0, additional_hours: 0 },
      { terrain_type: 'Slight Slope', difficulty_multiplier: 1.1, additional_hours: 0.5 },
      { terrain_type: 'Moderate Hills', difficulty_multiplier: 1.2, additional_hours: 1 },
      { terrain_type: 'Steep Terrain', difficulty_multiplier: 1.35, additional_hours: 2 },
      { terrain_type: 'Rocky Ground', difficulty_multiplier: 1.4, additional_hours: 2.5 },
      { terrain_type: 'Heavily Wooded', difficulty_multiplier: 1.3, additional_hours: 1.5 }
    ];

    for (const terrain of terrains) {
      await this.db.run(
        `INSERT INTO terrain_modifiers (terrain_type, difficulty_multiplier, additional_hours) 
         VALUES (?, ?, ?)`,
        [terrain.terrain_type, terrain.difficulty_multiplier, terrain.additional_hours]
      );
    }

    // Seed distance pricing
    const distances = [
      { min_miles: 0, max_miles: 10, trip_charge: 0, per_mile_charge: 0 },
      { min_miles: 10, max_miles: 25, trip_charge: 25, per_mile_charge: 1.50 },
      { min_miles: 25, max_miles: 50, trip_charge: 50, per_mile_charge: 2.00 },
      { min_miles: 50, max_miles: 75, trip_charge: 100, per_mile_charge: 2.50 },
      { min_miles: 75, max_miles: 100, trip_charge: 150, per_mile_charge: 3.00 }
    ];

    for (const dist of distances) {
      await this.db.run(
        `INSERT INTO distance_pricing (min_miles, max_miles, trip_charge, per_mile_charge) 
         VALUES (?, ?, ?, ?)`,
        [dist.min_miles, dist.max_miles, dist.trip_charge, dist.per_mile_charge]
      );
    }

    // Seed sample service centers
    const centers = [
      { name: 'Dallas Main', address: '123 Main St', city: 'Dallas', state: 'TX', zip_code: '75201', latitude: 32.7767, longitude: -96.7970 },
      { name: 'Houston Branch', address: '456 Oak Ave', city: 'Houston', state: 'TX', zip_code: '77001', latitude: 29.7604, longitude: -95.3698 },
      { name: 'Austin Hub', address: '789 Pine Rd', city: 'Austin', state: 'TX', zip_code: '78701', latitude: 30.2672, longitude: -97.7431 }
    ];

    for (const center of centers) {
      await this.db.run(
        `INSERT INTO service_centers (name, address, city, state, zip_code, latitude, longitude) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [center.name, center.address, center.city, center.state, center.zip_code, center.latitude, center.longitude]
      );
    }
  }

  // Calculate distance between two points using Haversine formula
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  // Get pricing zone by ZIP code or city/state
  async getPricingZone(location) {
    let zone;
    
    // Try ZIP code first
    if (location.zip_code) {
      zone = await this.db.get(
        'SELECT * FROM pricing_zones WHERE zip_code = ?',
        [location.zip_code]
      );
    }
    
    // Try city/state
    if (!zone && location.city && location.state) {
      zone = await this.db.get(
        'SELECT * FROM pricing_zones WHERE city = ? AND state = ?',
        [location.city, location.state]
      );
    }
    
    // Try just state for rural areas
    if (!zone && location.state) {
      zone = await this.db.get(
        'SELECT * FROM pricing_zones WHERE state = ? AND city IS NULL',
        [location.state]
      );
    }
    
    // Default zone if nothing matches
    if (!zone) {
      zone = {
        zone_name: 'Default',
        base_multiplier: 1.0,
        labor_rate_hourly: 35,
        material_markup: 1.2,
        market_demand: 'normal',
        competition_level: 'moderate'
      };
    }
    
    return zone;
  }

  // Find nearest service center
  async getNearestServiceCenter(latitude, longitude) {
    const centers = await this.db.all('SELECT * FROM service_centers WHERE is_active = 1');
    
    let nearest = null;
    let minDistance = Infinity;
    
    for (const center of centers) {
      if (center.latitude && center.longitude) {
        const distance = this.calculateDistance(
          latitude, longitude,
          center.latitude, center.longitude
        );
        
        if (distance < minDistance && distance <= center.max_service_radius_miles) {
          minDistance = distance;
          nearest = { ...center, distance };
        }
      }
    }
    
    return nearest;
  }

  // Calculate distance charge
  async getDistanceCharge(miles) {
    const tier = await this.db.get(
      'SELECT * FROM distance_pricing WHERE ? >= min_miles AND ? <= max_miles',
      [miles, miles]
    );
    
    if (!tier) return 0;
    
    return tier.trip_charge + (miles * tier.per_mile_charge);
  }

  // Get property type pricing
  async getPropertyTypePricing(propertyType) {
    const type = await this.db.get(
      'SELECT * FROM property_types WHERE type_name = ?',
      [propertyType]
    );
    
    return type || {
      type_name: 'Standard Residential',
      base_price: 2500,
      per_foot_price: 0.50,
      difficulty_multiplier: 1.0,
      typical_install_hours: 4
    };
  }

  // Get terrain modifier
  async getTerrainModifier(terrainType) {
    const terrain = await this.db.get(
      'SELECT * FROM terrain_modifiers WHERE terrain_type = ?',
      [terrainType]
    );
    
    return terrain || {
      terrain_type: 'Flat/Easy',
      difficulty_multiplier: 1.0,
      additional_hours: 0
    };
  }

  // Main pricing calculation function
  async calculateLocationBasedPrice(quoteRequest) {
    const {
      address,
      city,
      state,
      zip_code,
      property_size = 8000, // square feet
      fence_perimeter = 500, // linear feet
      property_type = 'Standard Residential',
      terrain_type = 'Flat/Easy',
      num_pets = 1,
      selected_tier = 'Professional',
      latitude,
      longitude
    } = quoteRequest;

    // Get pricing zone
    const zone = await this.getPricingZone({ zip_code, city, state });
    
    // Get property type pricing
    const propertyPricing = await this.getPropertyTypePricing(property_type);
    
    // Get terrain modifier
    const terrainModifier = await this.getTerrainModifier(terrain_type);
    
    // Calculate base installation price
    let basePrice = propertyPricing.base_price + (fence_perimeter * propertyPricing.per_foot_price);
    
    // Apply zone multiplier
    basePrice *= zone.base_multiplier;
    
    // Apply terrain difficulty
    basePrice *= terrainModifier.difficulty_multiplier;
    
    // Calculate labor cost
    const totalHours = propertyPricing.typical_install_hours + terrainModifier.additional_hours;
    const laborCost = totalHours * zone.labor_rate_hourly;
    
    // Add tier-specific monthly service
    const tierPrices = {
      'Essentials': 299,
      'Professional': 599,
      'Enterprise': 999
    };
    const monthlyService = tierPrices[selected_tier] || 599;
    
    // Calculate distance charge if coordinates provided
    let distanceCharge = 0;
    if (latitude && longitude) {
      const nearestCenter = await this.getNearestServiceCenter(latitude, longitude);
      if (nearestCenter) {
        distanceCharge = await this.getDistanceCharge(nearestCenter.distance);
      }
    }
    
    // Add pet-specific adjustments
    const petMultiplier = 1 + ((num_pets - 1) * 0.1); // 10% per additional pet
    basePrice *= petMultiplier;
    
    // Calculate total one-time installation cost
    const installationCost = basePrice + laborCost + distanceCharge;
    
    // Market demand adjustment
    const demandMultipliers = {
      'low': 0.95,
      'normal': 1.0,
      'high': 1.08
    };
    const finalInstallCost = installationCost * (demandMultipliers[zone.market_demand] || 1.0);
    
    // Prepare detailed breakdown
    const breakdown = {
      // Location details
      location: {
        address,
        city,
        state,
        zip_code,
        zone_name: zone.zone_name,
        market_demand: zone.market_demand,
        competition_level: zone.competition_level
      },
      
      // Property details
      property: {
        type: property_type,
        size_sqft: property_size,
        fence_perimeter_ft: fence_perimeter,
        terrain: terrain_type,
        num_pets
      },
      
      // Pricing breakdown
      pricing: {
        base_equipment_cost: propertyPricing.base_price,
        perimeter_wire_cost: fence_perimeter * propertyPricing.per_foot_price,
        location_multiplier: zone.base_multiplier,
        terrain_multiplier: terrainModifier.difficulty_multiplier,
        pet_multiplier: petMultiplier,
        labor_hours: totalHours,
        labor_rate: zone.labor_rate_hourly,
        labor_cost: laborCost,
        distance_charge: distanceCharge,
        installation_subtotal: installationCost,
        market_adjustment: demandMultipliers[zone.market_demand] || 1.0,
        total_installation: finalInstallCost,
        monthly_service: monthlyService,
        selected_tier
      },
      
      // Total costs
      totals: {
        one_time_installation: Math.round(finalInstallCost),
        monthly_service: monthlyService,
        first_year_total: Math.round(finalInstallCost + (monthlyService * 12)),
        estimated_install_time: `${totalHours} hours`
      },
      
      // Competitive analysis
      market_analysis: {
        price_position: this.getPricePosition(finalInstallCost, zone.competition_level),
        confidence_score: this.getConfidenceScore(zone, propertyPricing),
        recommended_discount: this.getRecommendedDiscount(zone.market_demand, zone.competition_level)
      }
    };
    
    return breakdown;
  }

  // Helper function to determine price position
  getPricePosition(price, competitionLevel) {
    const positions = {
      'low': 'Premium pricing - low competition',
      'moderate': 'Competitive pricing - moderate competition',
      'high': 'Value pricing - high competition'
    };
    return positions[competitionLevel] || 'Standard pricing';
  }

  // Calculate confidence score (0-100)
  getConfidenceScore(zone, propertyPricing) {
    let score = 70; // Base score
    
    // Adjust based on market demand
    if (zone.market_demand === 'high') score += 15;
    else if (zone.market_demand === 'low') score -= 10;
    
    // Adjust based on competition
    if (zone.competition_level === 'low') score += 10;
    else if (zone.competition_level === 'high') score -= 5;
    
    return Math.min(100, Math.max(0, score));
  }

  // Get recommended discount based on market conditions
  getRecommendedDiscount(marketDemand, competitionLevel) {
    if (marketDemand === 'low' && competitionLevel === 'high') {
      return { percentage: 15, reason: 'High competition in low demand market' };
    } else if (marketDemand === 'low') {
      return { percentage: 10, reason: 'Low market demand' };
    } else if (competitionLevel === 'high') {
      return { percentage: 8, reason: 'High competition' };
    } else if (marketDemand === 'high' && competitionLevel === 'low') {
      return { percentage: 0, reason: 'Strong market position' };
    }
    return { percentage: 5, reason: 'Standard promotional discount' };
  }

  // Save quote to history
  async saveQuote(quoteData, breakdown) {
    const result = await this.db.run(
      `INSERT INTO quote_history (
        customer_name, customer_email, customer_phone,
        address, city, state, zip_code,
        property_size, property_type, terrain_type,
        fence_perimeter, num_pets, selected_tier,
        base_price, location_multiplier, distance_charge,
        terrain_charge, total_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quoteData.customer_name,
        quoteData.customer_email,
        quoteData.customer_phone,
        quoteData.address,
        quoteData.city,
        quoteData.state,
        quoteData.zip_code,
        quoteData.property_size,
        quoteData.property_type,
        quoteData.terrain_type,
        quoteData.fence_perimeter,
        quoteData.num_pets,
        quoteData.selected_tier,
        breakdown.pricing.base_equipment_cost,
        breakdown.pricing.location_multiplier,
        breakdown.pricing.distance_charge,
        breakdown.pricing.terrain_multiplier,
        breakdown.totals.one_time_installation
      ]
    );
    
    return result.id;
  }

  // Get competitor pricing for a location
  async getCompetitorPricing(zipCode) {
    const competitors = await this.db.all(
      'SELECT * FROM competitor_pricing WHERE zip_code = ? ORDER BY last_updated DESC',
      [zipCode]
    );
    
    return competitors;
  }

  // Get pricing analytics
  async getPricingAnalytics() {
    const avgByZone = await this.db.all(`
      SELECT 
        pz.zone_name,
        pz.state,
        COUNT(qh.id) as quote_count,
        AVG(qh.total_price) as avg_price,
        MIN(qh.total_price) as min_price,
        MAX(qh.total_price) as max_price,
        SUM(CASE WHEN qh.converted_to_customer = 1 THEN 1 ELSE 0 END) as conversions
      FROM pricing_zones pz
      LEFT JOIN quote_history qh ON pz.zip_code = qh.zip_code
      GROUP BY pz.zone_name, pz.state
    `);
    
    const conversionByTier = await this.db.all(`
      SELECT 
        selected_tier,
        COUNT(*) as total_quotes,
        SUM(CASE WHEN converted_to_customer = 1 THEN 1 ELSE 0 END) as conversions,
        AVG(total_price) as avg_price
      FROM quote_history
      GROUP BY selected_tier
    `);
    
    return {
      byZone: avgByZone,
      byTier: conversionByTier
    };
  }
}

module.exports = LocationPricingService;