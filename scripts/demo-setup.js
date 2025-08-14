#!/usr/bin/env node

/**
 * Demo Environment Setup Script
 * Creates demo organizations with realistic fence business data
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/fence_platform'
});

// Demo organizations to create
const DEMO_ORGS = [
  {
    name: 'Dallas Fence Pros',
    subdomain: 'demo',
    email: 'demo@fenceplatform.io',
    plan: 'enterprise',
    demo_credentials: {
      email: 'demo@fenceplatform.io',
      password: 'DemoPass123!'
    }
  },
  {
    name: 'Austin Fence Masters',
    subdomain: 'austin-demo',
    email: 'austin@fenceplatform.io',
    plan: 'growth',
    demo_credentials: {
      email: 'austin@fenceplatform.io',
      password: 'AustinDemo123!'
    }
  },
  {
    name: 'Quick Fence Solutions',
    subdomain: 'quick-demo',
    email: 'quick@fenceplatform.io',
    plan: 'starter',
    demo_credentials: {
      email: 'quick@fenceplatform.io',
      password: 'QuickDemo123!'
    }
  }
];

// Realistic customer data
const SAMPLE_CUSTOMERS = [
  { first_name: 'John', last_name: 'Smith', email: 'john.smith@email.com', phone: '(214) 555-0101', address: '123 Oak Street', city: 'Dallas', state: 'TX', zip: '75201', pet_name: 'Max', pet_type: 'Dog', fence_type: 'Wood Privacy', status: 'active', lifetime_value: 4500 },
  { first_name: 'Mary', last_name: 'Johnson', email: 'mary.j@email.com', phone: '(469) 555-0102', address: '456 Elm Avenue', city: 'Plano', state: 'TX', zip: '75074', pet_name: 'Bella', pet_type: 'Dog', fence_type: 'Chain Link', status: 'active', lifetime_value: 3200 },
  { first_name: 'Robert', last_name: 'Williams', email: 'rob.williams@email.com', phone: '(972) 555-0103', address: '789 Maple Drive', city: 'Richardson', state: 'TX', zip: '75080', pet_name: 'Charlie', pet_type: 'Dog', fence_type: 'Vinyl', status: 'active', lifetime_value: 5800 },
  { first_name: 'Linda', last_name: 'Davis', email: 'linda.davis@email.com', phone: '(817) 555-0104', address: '321 Pine Lane', city: 'Fort Worth', state: 'TX', zip: '76102', pet_name: 'Luna', pet_type: 'Cat', fence_type: 'Wood Privacy', status: 'active', lifetime_value: 4200 },
  { first_name: 'Michael', last_name: 'Brown', email: 'mike.brown@email.com', phone: '(214) 555-0105', address: '654 Cedar Road', city: 'Dallas', state: 'TX', zip: '75205', pet_name: 'Cooper', pet_type: 'Dog', fence_type: 'Aluminum', status: 'active', lifetime_value: 6500 },
  { first_name: 'Jennifer', last_name: 'Garcia', email: 'jen.garcia@email.com', phone: '(469) 555-0106', address: '987 Birch Street', city: 'McKinney', state: 'TX', zip: '75070', pet_name: 'Rocky', pet_type: 'Dog', fence_type: 'Wood Privacy', status: 'active', lifetime_value: 4800 },
  { first_name: 'David', last_name: 'Martinez', email: 'david.m@email.com', phone: '(972) 555-0107', address: '147 Spruce Avenue', city: 'Frisco', state: 'TX', zip: '75034', pet_name: 'Daisy', pet_type: 'Dog', fence_type: 'Vinyl', status: 'active', lifetime_value: 5200 },
  { first_name: 'Susan', last_name: 'Anderson', email: 'susan.a@email.com', phone: '(817) 555-0108', address: '258 Willow Court', city: 'Arlington', state: 'TX', zip: '76010', pet_name: 'Buddy', pet_type: 'Dog', fence_type: 'Chain Link', status: 'active', lifetime_value: 2800 },
  { first_name: 'James', last_name: 'Taylor', email: 'james.taylor@email.com', phone: '(214) 555-0109', address: '369 Ash Boulevard', city: 'Dallas', state: 'TX', zip: '75214', pet_name: 'Bailey', pet_type: 'Dog', fence_type: 'Wood Privacy', status: 'active', lifetime_value: 4600 },
  { first_name: 'Patricia', last_name: 'Thomas', email: 'pat.thomas@email.com', phone: '(469) 555-0110', address: '741 Cypress Lane', city: 'Garland', state: 'TX', zip: '75040', pet_name: 'Molly', pet_type: 'Cat', fence_type: 'Vinyl', status: 'active', lifetime_value: 5400 }
];

// Sample leads
const SAMPLE_LEADS = [
  { first_name: 'William', last_name: 'Jackson', email: 'will.j@email.com', phone: '(214) 555-0201', source: 'Website', status: 'new', score: 85, estimated_value: 5000, notes: 'Interested in 200ft wood privacy fence' },
  { first_name: 'Barbara', last_name: 'White', email: 'barb.white@email.com', phone: '(469) 555-0202', source: 'Referral', status: 'contacted', score: 92, estimated_value: 6500, notes: 'Referred by John Smith, needs quote ASAP' },
  { first_name: 'Richard', last_name: 'Harris', email: 'rich.h@email.com', phone: '(972) 555-0203', source: 'Google Ads', status: 'qualified', score: 78, estimated_value: 4200, notes: 'Corner lot, considering vinyl' },
  { first_name: 'Maria', last_name: 'Clark', email: 'maria.c@email.com', phone: '(817) 555-0204', source: 'Facebook', status: 'new', score: 65, estimated_value: 3500, notes: 'Price shopping, budget conscious' },
  { first_name: 'Charles', last_name: 'Lewis', email: 'charles.l@email.com', phone: '(214) 555-0205', source: 'Website', status: 'proposal', score: 95, estimated_value: 8000, notes: 'Large property, premium materials' }
];

// Sample quotes
const SAMPLE_QUOTES = [
  { customer_name: 'John Smith', customer_email: 'john.smith@email.com', property_size: 8500, fence_perimeter: 180, fence_type: 'Wood Privacy', total_price: 4500, status: 'accepted', notes: '6ft cedar privacy fence with two gates' },
  { customer_name: 'Mary Johnson', customer_email: 'mary.j@email.com', property_size: 6200, fence_perimeter: 150, fence_type: 'Chain Link', total_price: 3200, status: 'accepted', notes: '4ft galvanized chain link, one gate' },
  { customer_name: 'William Jackson', customer_email: 'will.j@email.com', property_size: 9000, fence_perimeter: 200, fence_type: 'Wood Privacy', total_price: 5000, status: 'pending', notes: 'Waiting for HOA approval' },
  { customer_name: 'Barbara White', customer_email: 'barb.white@email.com', property_size: 11000, fence_perimeter: 250, fence_type: 'Vinyl', total_price: 6500, status: 'pending', notes: 'Premium white vinyl, three gates' },
  { customer_name: 'Robert Williams', customer_email: 'rob.williams@email.com', property_size: 8800, fence_perimeter: 190, fence_type: 'Vinyl', total_price: 5800, status: 'accepted', notes: 'Tan vinyl with decorative posts' }
];

// Sample appointments
const SAMPLE_APPOINTMENTS = [
  { type: 'Installation', date: '2024-01-15', time: '09:00', duration: 480, notes: 'Full day installation - Smith residence' },
  { type: 'Quote', date: '2024-01-16', time: '14:00', duration: 60, notes: 'Measure and quote - Jackson property' },
  { type: 'Repair', date: '2024-01-17', time: '10:00', duration: 120, notes: 'Gate repair - Johnson residence' },
  { type: 'Quote', date: '2024-01-18', time: '15:30', duration: 60, notes: 'New customer consultation - White' },
  { type: 'Installation', date: '2024-01-19', time: '08:00', duration: 360, notes: 'Fence installation - Davis property' }
];

// ROI Calculations data
const SAMPLE_ROI_DATA = [
  { tier: 'Professional', monthly_savings: 14260, payback_months: 0.04, total_value: 171120 },
  { tier: 'Enterprise', monthly_savings: 20120, payback_months: 0.05, total_value: 241440 },
  { tier: 'Essentials', monthly_savings: 9940, payback_months: 0.03, total_value: 119280 }
];

async function setupDemo() {
  console.log('🚀 Setting up demo environment...\n');

  try {
    // Create demo organizations
    for (const org of DEMO_ORGS) {
      console.log(`📦 Creating organization: ${org.name}`);
      
      // Check if org already exists
      const existing = await pool.query(
        'SELECT id FROM organizations WHERE subdomain = $1',
        [org.subdomain]
      );

      let orgId;
      
      if (existing.rows.length > 0) {
        orgId = existing.rows[0].id;
        console.log(`  ✓ Organization already exists, updating...`);
        
        // Update existing org
        await pool.query(
          `UPDATE organizations 
           SET plan = $1, is_active = true, 
               trial_ends_at = NOW() + INTERVAL '30 days',
               features = $2
           WHERE id = $3`,
          [
            org.plan,
            JSON.stringify({
              roi_calculator: true,
              location_pricing: true,
              smart_scheduling: org.plan !== 'starter',
              approval_workflow: org.plan === 'enterprise',
              api_access: org.plan === 'enterprise',
              white_label: false,
              custom_integrations: org.plan === 'enterprise'
            }),
            orgId
          ]
        );
      } else {
        // Create new org
        const orgResult = await pool.query(
          `INSERT INTO organizations (
            name, subdomain, email, phone, plan, is_active,
            trial_ends_at, features, settings
          ) VALUES ($1, $2, $3, $4, $5, true, 
            NOW() + INTERVAL '30 days', $6, $7)
          RETURNING id`,
          [
            org.name,
            org.subdomain,
            org.email,
            '(214) 555-0100',
            org.plan,
            JSON.stringify({
              roi_calculator: true,
              location_pricing: true,
              smart_scheduling: org.plan !== 'starter',
              approval_workflow: org.plan === 'enterprise',
              api_access: org.plan === 'enterprise',
              white_label: false,
              custom_integrations: org.plan === 'enterprise'
            }),
            JSON.stringify({
              timezone: 'America/Chicago',
              business_hours: '8AM-6PM',
              currency: 'USD',
              date_format: 'MM/DD/YYYY',
              demo_mode: true,
              reset_daily: true
            })
          ]
        );
        orgId = orgResult.rows[0].id;
      }

      // Create or update demo user
      const passwordHash = await bcrypt.hash(org.demo_credentials.password, 10);
      
      const userExists = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [org.demo_credentials.email]
      );

      if (userExists.rows.length > 0) {
        await pool.query(
          'UPDATE users SET password_hash = $1, org_id = $2 WHERE email = $3',
          [passwordHash, orgId, org.demo_credentials.email]
        );
        console.log(`  ✓ User updated`);
      } else {
        await pool.query(
          `INSERT INTO users (org_id, email, password_hash, role, first_name, last_name)
           VALUES ($1, $2, $3, 'admin', 'Demo', 'User')`,
          [orgId, org.demo_credentials.email, passwordHash]
        );
        console.log(`  ✓ User created`);
      }

      // Clear existing demo data
      await pool.query('DELETE FROM customers WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM leads WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM quote_history WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM appointments WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM roi_calculations WHERE org_id = $1', [orgId]);

      // Add sample customers
      console.log(`  📊 Adding ${SAMPLE_CUSTOMERS.length} sample customers...`);
      for (const customer of SAMPLE_CUSTOMERS) {
        await pool.query(
          `INSERT INTO customers (
            org_id, first_name, last_name, email, phone, address, 
            city, state, zip, pet_name, pet_type, fence_type, 
            status, lifetime_value, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 
            NOW() - INTERVAL '${Math.floor(Math.random() * 365)} days')`,
          [orgId, customer.first_name, customer.last_name, customer.email,
           customer.phone, customer.address, customer.city, customer.state,
           customer.zip, customer.pet_name, customer.pet_type, customer.fence_type,
           customer.status, customer.lifetime_value]
        );
      }

      // Add sample leads
      console.log(`  🎯 Adding ${SAMPLE_LEADS.length} sample leads...`);
      for (const lead of SAMPLE_LEADS) {
        await pool.query(
          `INSERT INTO leads (
            org_id, first_name, last_name, email, phone, 
            source, status, score, estimated_value, notes, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')`,
          [orgId, lead.first_name, lead.last_name, lead.email,
           lead.phone, lead.source, lead.status, lead.score,
           lead.estimated_value, lead.notes]
        );
      }

      // Add sample quotes
      console.log(`  💰 Adding ${SAMPLE_QUOTES.length} sample quotes...`);
      for (const quote of SAMPLE_QUOTES) {
        await pool.query(
          `INSERT INTO quote_history (
            org_id, customer_name, customer_email, property_size,
            fence_perimeter, selected_tier, total_price, status, 
            notes, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
            NOW() - INTERVAL '${Math.floor(Math.random() * 60)} days')`,
          [orgId, quote.customer_name, quote.customer_email,
           quote.property_size, quote.fence_perimeter, quote.fence_type,
           quote.total_price, quote.status, quote.notes]
        );
      }

      // Add sample appointments
      console.log(`  📅 Adding ${SAMPLE_APPOINTMENTS.length} sample appointments...`);
      for (const apt of SAMPLE_APPOINTMENTS) {
        // Find a random customer for the appointment
        const customerResult = await pool.query(
          'SELECT id FROM customers WHERE org_id = $1 LIMIT 1 OFFSET $2',
          [orgId, Math.floor(Math.random() * SAMPLE_CUSTOMERS.length)]
        );
        
        if (customerResult.rows.length > 0) {
          await pool.query(
            `INSERT INTO appointments (
              org_id, customer_id, appointment_type, appointment_date,
              appointment_time, duration_minutes, status, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7)`,
            [orgId, customerResult.rows[0].id, apt.type, apt.date,
             apt.time, apt.duration, apt.notes]
          );
        }
      }

      // Add ROI calculations
      console.log(`  📈 Adding ROI calculation history...`);
      for (const roi of SAMPLE_ROI_DATA) {
        await pool.query(
          `INSERT INTO roi_calculations (
            org_id, tier, inputs, results, created_at
          ) VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days')`,
          [
            orgId,
            roi.tier,
            JSON.stringify({
              hourlyRate: 35,
              monthlyRevenue: 50000,
              manualAdminHours: 80,
              manualTravelHours: 40
            }),
            JSON.stringify({
              monthlySavings: roi.monthly_savings,
              paybackMonths: roi.payback_months,
              totalValue: roi.total_value
            })
          ]
        );
      }

      console.log(`  ✅ ${org.name} setup complete!\n`);
    }

    // Create demo reset function
    console.log('📝 Creating demo reset function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION reset_demo_data()
      RETURNS void AS $$
      BEGIN
        -- Reset demo organizations to fresh state
        UPDATE organizations 
        SET trial_ends_at = NOW() + INTERVAL '30 days'
        WHERE settings->>'demo_mode' = 'true';
        
        -- Could add more reset logic here
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('\n✨ Demo environment setup complete!\n');
    console.log('🔐 Demo Login Credentials:\n');
    
    for (const org of DEMO_ORGS) {
      console.log(`${org.name}:`);
      console.log(`  URL: https://${org.subdomain}.fenceplatform.io`);
      console.log(`  Email: ${org.demo_credentials.email}`);
      console.log(`  Password: ${org.demo_credentials.password}`);
      console.log(`  Plan: ${org.plan}`);
      console.log('');
    }

    console.log('📋 Features by Plan:');
    console.log('  Starter: Basic features, 5 users, 100 jobs/month');
    console.log('  Growth: + Smart scheduling, 10 users, 500 jobs/month');
    console.log('  Enterprise: + Approval workflow, API, unlimited');
    
  } catch (error) {
    console.error('❌ Error setting up demo:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run setup
setupDemo();