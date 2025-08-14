const express = require('express');
const router = express.Router();
const PostgresDatabaseService = require('./postgres-database.service');
const TenantMiddleware = require('../middleware/tenant.middleware');
const nodemailer = require('nodemailer');

const db = new PostgresDatabaseService();

// Email configuration
const emailTransporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * POST /api/signup
 * Create a new organization and admin user
 */
router.post('/signup', async (req, res) => {
  try {
    const {
      company,
      subdomain,
      firstName,
      lastName,
      email,
      phone,
      password
    } = req.body;

    // Validation
    if (!company || !subdomain || !firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'All required fields must be provided'
      });
    }

    // Validate subdomain format
    if (!/^[a-z0-9-]{3,30}$/.test(subdomain)) {
      return res.status(400).json({
        success: false,
        field: 'subdomain',
        error: 'Subdomain must be 3-30 characters, lowercase letters, numbers, and hyphens only'
      });
    }

    // Check if subdomain is already taken
    const existingOrg = await db.get(
      'SELECT id FROM organizations WHERE subdomain = $1',
      [subdomain]
    );

    if (existingOrg) {
      return res.status(400).json({
        success: false,
        field: 'subdomain',
        error: 'This subdomain is already taken. Please choose another.'
      });
    }

    // Check if email is already registered
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        field: 'email',
        error: 'This email is already registered. Please log in instead.'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        field: 'password',
        error: 'Password must be at least 8 characters long'
      });
    }

    // Start transaction
    const result = await db.transaction(async (client) => {
      // 1. Create organization
      const orgResult = await client.query(
        `INSERT INTO organizations (
          name, subdomain, email, phone, plan,
          features, settings, max_users, max_monthly_jobs
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          company,
          subdomain,
          email,
          phone,
          'trial',
          JSON.stringify({
            roi_calculator: true,
            location_pricing: true,
            smart_scheduling: true,
            approval_workflow: false,
            api_access: false,
            white_label: false
          }),
          JSON.stringify({
            timezone: 'America/Chicago',
            business_hours: '9-5',
            currency: 'USD',
            date_format: 'MM/DD/YYYY'
          }),
          5,  // max users for trial
          100 // max monthly jobs for trial
        ]
      );

      const organization = orgResult.rows[0];

      // 2. Create admin user
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);

      const userResult = await client.query(
        `INSERT INTO users (
          org_id, email, password_hash, role,
          first_name, last_name, phone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, email, role, first_name, last_name`,
        [
          organization.id,
          email,
          passwordHash,
          'admin',
          firstName,
          lastName,
          phone
        ]
      );

      const user = userResult.rows[0];

      // 3. Initialize default data
      await initializeOrgData(client, organization.id);

      return { organization, user };
    });

    // Send welcome email
    await sendWelcomeEmail(result.user, result.organization);

    // Generate auth token
    const token = TenantMiddleware.generateToken(result.user, result.organization);

    // Return success
    res.json({
      success: true,
      subdomain: result.organization.subdomain,
      token: token,
      message: 'Account created successfully! Check your email for login details.',
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        subdomain: result.organization.subdomain,
        plan: result.organization.plan,
        trial_ends_at: result.organization.trial_ends_at
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        name: `${result.user.first_name} ${result.user.last_name}`,
        role: result.user.role
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account. Please try again.'
    });
  }
});

/**
 * POST /api/check-subdomain
 * Check if a subdomain is available
 */
router.post('/check-subdomain', async (req, res) => {
  try {
    const { subdomain } = req.body;

    if (!subdomain || !/^[a-z0-9-]{3,30}$/.test(subdomain)) {
      return res.json({
        available: false,
        error: 'Invalid subdomain format'
      });
    }

    const existing = await db.get(
      'SELECT id FROM organizations WHERE subdomain = $1',
      [subdomain]
    );

    res.json({
      available: !existing,
      subdomain: subdomain
    });

  } catch (error) {
    console.error('Subdomain check error:', error);
    res.status(500).json({
      available: false,
      error: 'Failed to check subdomain'
    });
  }
});

/**
 * Initialize default data for new organization
 */
async function initializeOrgData(client, orgId) {
  // Add default pricing tiers
  await client.query(
    `INSERT INTO pricing_tiers (org_id, name, base_price, features)
     VALUES 
     ($1, 'Basic', 299, '{"installation": true, "warranty": "1 year"}'),
     ($1, 'Professional', 599, '{"installation": true, "warranty": "3 years", "training": true}'),
     ($1, 'Enterprise', 999, '{"installation": true, "warranty": "5 years", "training": true, "support": "24/7"}')`,
    [orgId]
  );

  // Add sample customer for demo
  await client.query(
    `INSERT INTO customers (
      org_id, first_name, last_name, email, phone, 
      address, city, state, zip, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      orgId,
      'Sample',
      'Customer',
      'sample@example.com',
      '555-0100',
      '123 Demo Street',
      'Dallas',
      'TX',
      '75201',
      'active'
    ]
  );

  // Add sample lead
  await client.query(
    `INSERT INTO leads (
      org_id, first_name, last_name, email, phone,
      source, status, score, estimated_value
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      orgId,
      'John',
      'Prospect',
      'john@example.com',
      '555-0101',
      'Website',
      'new',
      75,
      5000
    ]
  );

  // Track initial usage
  const month = new Date().toISOString().slice(0, 7) + '-01';
  await client.query(
    `INSERT INTO organization_usage (org_id, month, active_users, jobs_created)
     VALUES ($1, $2, 1, 0)
     ON CONFLICT (org_id, month) DO NOTHING`,
    [orgId, month]
  );
}

/**
 * Send welcome email to new user
 */
async function sendWelcomeEmail(user, organization) {
  try {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #667eea;">Welcome to Fence Platform!</h1>
        
        <p>Hi ${user.first_name},</p>
        
        <p>Your fence business management platform is ready!</p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Your Platform Details:</h3>
          <p><strong>URL:</strong> <a href="https://${organization.subdomain}.fenceplatform.io">
            ${organization.subdomain}.fenceplatform.io
          </a></p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Plan:</strong> 14-Day Free Trial</p>
        </div>
        
        <h3>What's Next?</h3>
        <ol>
          <li>Log in to your platform</li>
          <li>Add your first customer</li>
          <li>Create your first quote</li>
          <li>Explore the ROI calculator</li>
        </ol>
        
        <h3>Your Trial Includes:</h3>
        <ul>
          <li>✓ Full access to all features</li>
          <li>✓ Up to 5 users</li>
          <li>✓ 100 jobs per month</li>
          <li>✓ Email support</li>
          <li>✓ No credit card required</li>
        </ul>
        
        <p style="margin-top: 30px;">
          <a href="https://${organization.subdomain}.fenceplatform.io" 
             style="background: #667eea; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Access Your Platform
          </a>
        </p>
        
        <p style="margin-top: 30px; color: #666;">
          Need help? Reply to this email or visit our 
          <a href="https://fenceplatform.io/support">support center</a>.
        </p>
        
        <hr style="margin: 40px 0; border: none; border-top: 1px solid #e1e4e8;">
        
        <p style="color: #999; font-size: 12px;">
          Fence Platform | Transform Your Fence Business<br>
          This email was sent to ${user.email}
        </p>
      </div>
    `;

    await emailTransporter.sendMail({
      from: process.env.EMAIL_FROM || 'Fence Platform <noreply@fenceplatform.io>',
      to: user.email,
      subject: `Welcome to Fence Platform - Your portal is ready!`,
      html: emailContent
    });

    console.log(`Welcome email sent to ${user.email}`);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't fail signup if email fails
  }
}

module.exports = router;