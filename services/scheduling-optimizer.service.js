const LocationPricingService = require('./location-pricing.service');

class SchedulingOptimizerService extends LocationPricingService {
  constructor() {
    super();
    this.clusterRadius = 5; // miles - jobs within this radius can be clustered
    this.maxJobsPerDay = 6; // maximum jobs per technician per day
    this.travelTimePerMile = 2; // minutes per mile travel time
  }

  async initialize() {
    await super.initialize();
    await this.createSchedulingTables();
  }

  async createSchedulingTables() {
    const tables = [
      // Job clusters table
      `CREATE TABLE IF NOT EXISTS job_clusters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cluster_date DATE NOT NULL,
        technician_id INTEGER,
        center_latitude REAL NOT NULL,
        center_longitude REAL NOT NULL,
        radius_miles REAL DEFAULT 5,
        job_count INTEGER DEFAULT 0,
        total_travel_savings REAL DEFAULT 0,
        fuel_cost_savings REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (technician_id) REFERENCES users(id)
      )`,
      
      // Job cluster assignments
      `CREATE TABLE IF NOT EXISTS cluster_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cluster_id INTEGER NOT NULL,
        appointment_id INTEGER,
        quote_id INTEGER,
        latitude REAL,
        longitude REAL,
        distance_from_center REAL,
        schedule_order INTEGER,
        estimated_duration_hours REAL DEFAULT 4,
        FOREIGN KEY (cluster_id) REFERENCES job_clusters(id),
        FOREIGN KEY (appointment_id) REFERENCES appointments(id),
        FOREIGN KEY (quote_id) REFERENCES quote_history(id)
      )`,
      
      // Scheduling discounts
      `CREATE TABLE IF NOT EXISTS scheduling_discounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discount_type TEXT NOT NULL,
        min_jobs INTEGER DEFAULT 2,
        max_jobs INTEGER DEFAULT 6,
        discount_percentage REAL DEFAULT 0,
        discount_fixed_amount REAL DEFAULT 0,
        fuel_savings_share REAL DEFAULT 0.5,
        description TEXT,
        is_active BOOLEAN DEFAULT 1
      )`,
      
      // Route optimization cache
      `CREATE TABLE IF NOT EXISTS route_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cluster_id INTEGER NOT NULL,
        route_order TEXT, -- JSON array of job IDs in optimal order
        total_distance_miles REAL,
        total_travel_time_minutes REAL,
        fuel_cost_estimated REAL,
        optimized_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cluster_id) REFERENCES job_clusters(id)
      )`
    ];

    for (const query of tables) {
      await this.db.run(query);
    }

    await this.seedSchedulingData();
  }

  async seedSchedulingData() {
    // Check if discount data exists
    const existing = await this.db.get('SELECT COUNT(*) as count FROM scheduling_discounts');
    if (existing.count > 0) return;

    // Seed scheduling discounts
    const discounts = [
      {
        discount_type: 'Two Job Cluster',
        min_jobs: 2,
        max_jobs: 2,
        discount_percentage: 8,
        fuel_savings_share: 0.6,
        description: 'Discount for scheduling 2 jobs in same area'
      },
      {
        discount_type: 'Three Job Cluster',
        min_jobs: 3,
        max_jobs: 3,
        discount_percentage: 12,
        fuel_savings_share: 0.7,
        description: 'Discount for scheduling 3 jobs in same area'
      },
      {
        discount_type: 'Four+ Job Cluster',
        min_jobs: 4,
        max_jobs: 6,
        discount_percentage: 18,
        fuel_savings_share: 0.8,
        description: 'Maximum discount for 4+ jobs in same area'
      },
      {
        discount_type: 'Same Day Add-On',
        min_jobs: 1,
        max_jobs: 1,
        discount_fixed_amount: 150,
        fuel_savings_share: 1.0,
        description: 'Fixed discount for adding job to existing route'
      },
      {
        discount_type: 'Flex Scheduling',
        min_jobs: 2,
        max_jobs: 6,
        discount_percentage: 5,
        fuel_savings_share: 0.4,
        description: 'Small discount for flexible scheduling within 2 weeks'
      }
    ];

    for (const discount of discounts) {
      await this.db.run(
        `INSERT INTO scheduling_discounts (
          discount_type, min_jobs, max_jobs, discount_percentage, 
          discount_fixed_amount, fuel_savings_share, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          discount.discount_type, discount.min_jobs, discount.max_jobs,
          discount.discount_percentage, discount.discount_fixed_amount || 0,
          discount.fuel_savings_share, discount.description
        ]
      );
    }
  }

  // Find existing job clusters in the area for a given date range
  async findNearbyJobClusters(latitude, longitude, startDate, endDate, radiusMiles = 5) {
    const clusters = await this.db.all(`
      SELECT 
        jc.*,
        COUNT(cj.id) as current_job_count,
        AVG(cj.distance_from_center) as avg_distance,
        u.username as technician_name
      FROM job_clusters jc
      LEFT JOIN cluster_jobs cj ON jc.id = cj.cluster_id
      LEFT JOIN users u ON jc.technician_id = u.id
      WHERE jc.cluster_date BETWEEN ? AND ?
        AND jc.status = 'active'
        AND jc.job_count < ?
      GROUP BY jc.id
      HAVING current_job_count < jc.job_count OR jc.job_count = 0
    `, [startDate, endDate, this.maxJobsPerDay]);

    const nearbyClusters = [];
    
    for (const cluster of clusters) {
      const distance = this.calculateDistance(
        latitude, longitude,
        cluster.center_latitude, cluster.center_longitude
      );
      
      if (distance <= radiusMiles) {
        nearbyClusters.push({
          ...cluster,
          distance_from_job: distance,
          available_spots: this.maxJobsPerDay - cluster.current_job_count
        });
      }
    }

    return nearbyClusters.sort((a, b) => a.distance_from_job - b.distance_from_job);
  }

  // Calculate potential savings from joining an existing cluster
  async calculateClusterSavings(clusterJobs, newJobLocation, basePrice) {
    if (clusterJobs.length < 1) return { savings: 0, discount: 0 };

    // Calculate fuel savings
    const avgFuelCostPerMile = 0.15; // $0.15 per mile (gas + vehicle wear)
    const baseTripDistance = 25; // average distance to job site
    
    // Estimate fuel savings by joining cluster vs separate trip
    const separateTripCost = baseTripDistance * 2 * avgFuelCostPerMile; // round trip
    const sharedTripCost = separateTripCost / (clusterJobs.length + 1); // shared cost
    const fuelSavings = separateTripCost - sharedTripCost;

    // Get discount tier based on cluster size
    const totalJobs = clusterJobs.length + 1;
    const discount = await this.db.get(`
      SELECT * FROM scheduling_discounts 
      WHERE min_jobs <= ? AND max_jobs >= ? 
        AND is_active = 1
      ORDER BY discount_percentage DESC
      LIMIT 1
    `, [totalJobs, totalJobs]);

    if (!discount) {
      return { savings: fuelSavings, discount: 0, discountType: 'fuel_only' };
    }

    // Calculate total discount
    const percentageDiscount = (basePrice * discount.discount_percentage) / 100;
    const fixedDiscount = discount.discount_fixed_amount || 0;
    const fuelSavingsShare = fuelSavings * discount.fuel_savings_share;

    const totalDiscount = Math.max(percentageDiscount + fuelSavingsShare, fixedDiscount);

    return {
      savings: fuelSavings,
      discount: totalDiscount,
      discountType: discount.discount_type,
      discountPercentage: discount.discount_percentage,
      fuelSavingsShare,
      estimatedSavings: totalDiscount
    };
  }

  // Enhanced pricing calculation with scheduling optimization
  async calculateOptimizedPrice(quoteRequest, schedulingPreferences = {}) {
    // Get base pricing first
    const basePricing = await this.calculateLocationBasedPrice(quoteRequest);
    const baseInstallationCost = basePricing.totals.one_time_installation;

    const {
      preferred_date,
      flexible_scheduling = false,
      date_range_start,
      date_range_end,
      time_preference = 'any' // morning, afternoon, any
    } = schedulingPreferences;

    // Look for existing clusters in the area
    const nearbyJobsPromise = this.findNearbyJobs(
      quoteRequest.latitude,
      quoteRequest.longitude,
      preferred_date || date_range_start,
      date_range_end || preferred_date,
      this.clusterRadius
    );

    const nearbyClustersPromise = this.findNearbyJobClusters(
      quoteRequest.latitude,
      quoteRequest.longitude,
      preferred_date || date_range_start,
      date_range_end || preferred_date,
      this.clusterRadius
    );

    const [nearbyJobs, nearbyClusters] = await Promise.all([nearbyJobsPromise, nearbyClustersPromise]);

    // Find best scheduling option
    const schedulingOptions = [];

    // Option 1: Join existing cluster
    for (const cluster of nearbyClusters) {
      if (cluster.available_spots > 0) {
        const clusterJobs = await this.getClusterJobs(cluster.id);
        const savings = await this.calculateClusterSavings(
          clusterJobs,
          { latitude: quoteRequest.latitude, longitude: quoteRequest.longitude },
          baseInstallationCost
        );

        schedulingOptions.push({
          type: 'join_cluster',
          cluster_id: cluster.id,
          date: cluster.cluster_date,
          technician_name: cluster.technician_name,
          job_count: cluster.current_job_count + 1,
          estimated_savings: savings.estimatedSavings,
          discount_details: savings,
          final_price: baseInstallationCost - savings.estimatedSavings,
          priority_score: this.calculatePriorityScore(savings.estimatedSavings, cluster.current_job_count)
        });
      }
    }

    // Option 2: Create new cluster with nearby unscheduled jobs
    if (nearbyJobs.length > 0) {
      const potentialClusterSavings = await this.calculateNewClusterSavings(
        nearbyJobs,
        quoteRequest,
        baseInstallationCost
      );

      schedulingOptions.push({
        type: 'new_cluster',
        potential_additional_jobs: nearbyJobs.length,
        estimated_savings: potentialClusterSavings.estimatedSavings,
        discount_details: potentialClusterSavings,
        final_price: baseInstallationCost - potentialClusterSavings.estimatedSavings,
        priority_score: this.calculatePriorityScore(potentialClusterSavings.estimatedSavings, nearbyJobs.length)
      });
    }

    // Option 3: Flexible scheduling discount
    if (flexible_scheduling) {
      const flexDiscount = await this.db.get(`
        SELECT * FROM scheduling_discounts 
        WHERE discount_type = 'Flex Scheduling' AND is_active = 1
      `);

      if (flexDiscount) {
        const flexSavings = (baseInstallationCost * flexDiscount.discount_percentage) / 100;
        schedulingOptions.push({
          type: 'flexible_scheduling',
          estimated_savings: flexSavings,
          final_price: baseInstallationCost - flexSavings,
          discount_details: {
            discountType: 'Flexible Scheduling',
            discountPercentage: flexDiscount.discount_percentage,
            estimatedSavings: flexSavings
          },
          priority_score: this.calculatePriorityScore(flexSavings, 0)
        });
      }
    }

    // Sort by priority score (highest savings and efficiency)
    schedulingOptions.sort((a, b) => b.priority_score - a.priority_score);

    // Add scheduling optimization to base pricing
    const optimizedPricing = {
      ...basePricing,
      scheduling_optimization: {
        base_price: baseInstallationCost,
        nearby_opportunities: nearbyJobs.length + nearbyClusters.length,
        available_options: schedulingOptions.length,
        best_option: schedulingOptions[0] || null,
        all_options: schedulingOptions,
        potential_savings: schedulingOptions[0]?.estimated_savings || 0
      }
    };

    // Update totals with best scheduling option
    if (schedulingOptions.length > 0) {
      const bestOption = schedulingOptions[0];
      optimizedPricing.totals.one_time_installation = bestOption.final_price;
      optimizedPricing.totals.first_year_total = bestOption.final_price + (basePricing.totals.monthly_service * 12);
      optimizedPricing.totals.scheduling_savings = bestOption.estimated_savings;
    }

    return optimizedPricing;
  }

  // Find nearby scheduled or quoted jobs
  async findNearbyJobs(latitude, longitude, startDate, endDate, radiusMiles) {
    // Find nearby appointments
    const appointments = await this.db.all(`
      SELECT 
        a.id,
        a.customer_id,
        a.scheduled_date,
        a.type,
        a.address,
        c.first_name || ' ' || c.last_name as customer_name,
        'appointment' as source_type
      FROM appointments a
      LEFT JOIN customers c ON a.customer_id = c.id
      WHERE DATE(a.scheduled_date) BETWEEN DATE(?) AND DATE(?)
        AND a.status = 'scheduled'
    `, [startDate, endDate]);

    // Find nearby recent quotes
    const quotes = await this.db.all(`
      SELECT 
        id,
        customer_name,
        address,
        city,
        state,
        zip_code,
        total_price,
        created_at,
        'quote' as source_type
      FROM quote_history
      WHERE DATE(created_at) >= DATE(?, '-7 days')
        AND status = 'pending'
        AND converted_to_customer = 0
    `, [startDate]);

    // Filter by distance (this would be enhanced with actual geocoding)
    const nearbyJobs = [];
    
    // For now, we'll simulate distance calculation
    // In production, you'd geocode addresses and calculate actual distances
    
    return nearbyJobs;
  }

  // Get jobs in a cluster
  async getClusterJobs(clusterId) {
    return await this.db.all(`
      SELECT cj.*, a.scheduled_date, a.type, c.first_name || ' ' || c.last_name as customer_name
      FROM cluster_jobs cj
      LEFT JOIN appointments a ON cj.appointment_id = a.id
      LEFT JOIN customers c ON a.customer_id = c.id
      WHERE cj.cluster_id = ?
      ORDER BY cj.schedule_order
    `, [clusterId]);
  }

  // Calculate savings for creating a new cluster
  async calculateNewClusterSavings(nearbyJobs, newJob, basePrice) {
    const potentialJobCount = Math.min(nearbyJobs.length + 1, this.maxJobsPerDay);
    
    // Get discount for potential cluster size
    const discount = await this.db.get(`
      SELECT * FROM scheduling_discounts 
      WHERE min_jobs <= ? AND max_jobs >= ? 
        AND is_active = 1
      ORDER BY discount_percentage DESC
      LIMIT 1
    `, [potentialJobCount, potentialJobCount]);

    if (!discount) {
      return { estimatedSavings: 0 };
    }

    // Calculate potential savings
    const avgFuelCostPerMile = 0.15;
    const baseTripDistance = 25;
    const fuelSavingsPerJob = (baseTripDistance * 2 * avgFuelCostPerMile) * 0.7; // 70% efficiency gain
    const totalFuelSavings = fuelSavingsPerJob * (potentialJobCount - 1);

    const percentageDiscount = (basePrice * discount.discount_percentage) / 100;
    const fuelSavingsShare = totalFuelSavings * discount.fuel_savings_share;

    return {
      estimatedSavings: percentageDiscount + fuelSavingsShare,
      discountType: discount.discount_type,
      discountPercentage: discount.discount_percentage,
      potentialJobCount,
      fuelSavingsShare
    };
  }

  // Calculate priority score for scheduling options
  calculatePriorityScore(savings, jobCount) {
    // Higher savings and more efficient clusters get higher scores
    const savingsScore = savings / 100; // $100 = 1 point
    const efficiencyScore = jobCount * 2; // 2 points per job in cluster
    return savingsScore + efficiencyScore;
  }

  // Create a new job cluster
  async createJobCluster(technician_id, date, center_latitude, center_longitude) {
    const result = await this.db.run(`
      INSERT INTO job_clusters (
        cluster_date, technician_id, center_latitude, center_longitude, status
      ) VALUES (?, ?, ?, ?, 'active')
    `, [date, technician_id, center_latitude, center_longitude]);

    return result.id;
  }

  // Add job to existing cluster
  async addJobToCluster(clusterId, jobData) {
    const cluster = await this.db.get('SELECT * FROM job_clusters WHERE id = ?', [clusterId]);
    
    if (!cluster) {
      throw new Error('Cluster not found');
    }

    // Calculate distance from cluster center
    const distance = this.calculateDistance(
      jobData.latitude, jobData.longitude,
      cluster.center_latitude, cluster.center_longitude
    );

    // Get current job count in cluster
    const currentJobs = await this.db.get(
      'SELECT COUNT(*) as count FROM cluster_jobs WHERE cluster_id = ?',
      [clusterId]
    );

    const scheduleOrder = currentJobs.count + 1;

    // Add job to cluster
    const result = await this.db.run(`
      INSERT INTO cluster_jobs (
        cluster_id, appointment_id, quote_id, latitude, longitude,
        distance_from_center, schedule_order, estimated_duration_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      clusterId,
      jobData.appointment_id || null,
      jobData.quote_id || null,
      jobData.latitude,
      jobData.longitude,
      distance,
      scheduleOrder,
      jobData.estimated_duration_hours || 4
    ]);

    // Update cluster job count
    await this.db.run(
      'UPDATE job_clusters SET job_count = job_count + 1 WHERE id = ?',
      [clusterId]
    );

    return result.id;
  }

  // Optimize route for a cluster
  async optimizeClusterRoute(clusterId) {
    const cluster = await this.db.get('SELECT * FROM job_clusters WHERE id = ?', [clusterId]);
    const jobs = await this.getClusterJobs(clusterId);

    if (jobs.length < 2) {
      return { totalDistance: 0, totalTime: 0, optimizedOrder: jobs };
    }

    // Simple nearest neighbor algorithm for route optimization
    // In production, you'd use more sophisticated algorithms like Christofides or Google's OR-Tools
    const optimizedJobs = this.nearestNeighborRoute(jobs, cluster);
    
    // Calculate total distance and time
    let totalDistance = 0;
    let totalTime = 0;
    
    for (let i = 0; i < optimizedJobs.length - 1; i++) {
      const distance = this.calculateDistance(
        optimizedJobs[i].latitude, optimizedJobs[i].longitude,
        optimizedJobs[i + 1].latitude, optimizedJobs[i + 1].longitude
      );
      totalDistance += distance;
      totalTime += distance * this.travelTimePerMile;
    }

    // Add work time
    totalTime += optimizedJobs.reduce((sum, job) => sum + (job.estimated_duration_hours * 60), 0);

    // Save optimized route
    await this.db.run(`
      INSERT OR REPLACE INTO route_cache (
        cluster_id, route_order, total_distance_miles, total_travel_time_minutes, fuel_cost_estimated
      ) VALUES (?, ?, ?, ?, ?)
    `, [
      clusterId,
      JSON.stringify(optimizedJobs.map(j => j.id)),
      totalDistance,
      totalTime,
      totalDistance * 0.15 // fuel cost estimate
    ]);

    return {
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalTime: Math.round(totalTime),
      fuelCost: Math.round(totalDistance * 0.15 * 100) / 100,
      optimizedOrder: optimizedJobs
    };
  }

  // Simple nearest neighbor route optimization
  nearestNeighborRoute(jobs, cluster) {
    if (jobs.length <= 1) return jobs;

    const unvisited = [...jobs];
    const route = [];
    
    // Start from service center (cluster center represents this)
    let current = { latitude: cluster.center_latitude, longitude: cluster.center_longitude };
    
    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let shortestDistance = Infinity;
      
      for (let i = 0; i < unvisited.length; i++) {
        const distance = this.calculateDistance(
          current.latitude, current.longitude,
          unvisited[i].latitude, unvisited[i].longitude
        );
        
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestIndex = i;
        }
      }
      
      const nearest = unvisited.splice(nearestIndex, 1)[0];
      route.push(nearest);
      current = nearest;
    }
    
    return route;
  }

  // Get scheduling analytics
  async getSchedulingAnalytics() {
    const clusterStats = await this.db.get(`
      SELECT 
        COUNT(*) as total_clusters,
        AVG(job_count) as avg_jobs_per_cluster,
        SUM(total_travel_savings) as total_savings,
        AVG(fuel_cost_savings) as avg_fuel_savings
      FROM job_clusters
      WHERE status = 'active'
    `);

    const savingsByType = await this.db.all(`
      SELECT 
        sd.discount_type,
        COUNT(*) as usage_count,
        AVG(sd.discount_percentage) as avg_discount_percentage,
        SUM(sd.discount_fixed_amount) as total_fixed_discounts
      FROM scheduling_discounts sd
      WHERE sd.is_active = 1
      GROUP BY sd.discount_type
    `);

    return {
      clusters: clusterStats,
      discountTypes: savingsByType
    };
  }
}

module.exports = SchedulingOptimizerService;