const jwt = require('jsonwebtoken');
const PostgresDatabaseService = require('../services/postgres-database.service');

const db = new PostgresDatabaseService();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

class TenantMiddleware {
  /**
   * Extract tenant from subdomain, JWT, or header
   */
  static async extractTenant(req, res, next) {
    try {
      let orgId = null;
      let organization = null;

      // Method 1: Extract from subdomain
      const hostname = req.hostname || req.get('host');
      let subdomain = null;

      if (hostname) {
        // Handle different environments
        if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
          // For local development, use query param or default
          subdomain = req.query.org || 'demo';
        } else {
          // Production: extract subdomain from hostname
          // e.g., acme.fenceplatform.com -> acme
          const parts = hostname.split('.');
          if (parts.length >= 3) {
            subdomain = parts[0];
          } else {
            // Handle custom domains
            const customOrg = await db.get(
              'SELECT * FROM organizations WHERE custom_domain = $1',
              [hostname]
            );
            if (customOrg) {
              organization = customOrg;
              orgId = customOrg.id;
            }
          }
        }
      }

      // Method 2: Extract from JWT token
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          if (decoded.orgId) {
            orgId = decoded.orgId;
            req.userId = decoded.userId;
            req.userRole = decoded.role;
          }
        } catch (jwtError) {
          console.warn('Invalid JWT token:', jwtError.message);
        }
      }

      // Method 3: Extract from header (for API access)
      const headerOrgId = req.headers['x-org-id'];
      const apiKey = req.headers['x-api-key'];
      
      if (headerOrgId && apiKey) {
        // Validate API key
        const apiOrg = await db.get(
          'SELECT * FROM organizations WHERE id = $1 AND api_key = $2',
          [headerOrgId, apiKey]
        );
        if (apiOrg) {
          organization = apiOrg;
          orgId = apiOrg.id;
        }
      }

      // Get organization if we only have subdomain
      if (!organization && subdomain) {
        organization = await db.getOrganizationBySubdomain(subdomain);
        if (organization) {
          orgId = organization.id;
        }
      }

      // Get organization if we only have orgId
      if (!organization && orgId) {
        organization = await db.get(
          'SELECT * FROM organizations WHERE id = $1',
          [orgId]
        );
      }

      // Check if organization exists and is valid
      if (!organization) {
        // For public pages (signup, landing), continue without org
        if (TenantMiddleware.isPublicRoute(req.path)) {
          return next();
        }
        
        return res.status(404).json({ 
          error: 'Organization not found',
          subdomain: subdomain
        });
      }

      // Check if organization is active
      if (!organization.is_active) {
        return res.status(403).json({ 
          error: 'Organization is suspended',
          reason: organization.suspension_reason
        });
      }

      // Check if trial has expired
      if (organization.plan === 'trial') {
        const trialEndsAt = new Date(organization.trial_ends_at);
        if (trialEndsAt < new Date()) {
          // Allow access to billing pages
          if (!req.path.includes('/billing') && !req.path.includes('/upgrade')) {
            return res.status(403).json({ 
              error: 'Trial expired',
              message: 'Please upgrade to continue using the platform',
              upgrade_url: `/billing/upgrade`
            });
          }
        }
      }

      // Attach organization to request
      req.orgId = organization.id;
      req.organization = organization;
      req.orgSubdomain = organization.subdomain;
      req.orgPlan = organization.plan;
      req.orgFeatures = organization.features || {};
      req.orgSettings = organization.settings || {};

      // Check rate limits for API calls
      if (req.path.startsWith('/api/')) {
        const canMakeApiCall = await db.checkUsageLimit(orgId, 'api_calls');
        if (!canMakeApiCall) {
          return res.status(429).json({ 
            error: 'API call limit exceeded',
            message: 'Please upgrade your plan for more API calls'
          });
        }
        
        // Track API usage (non-blocking)
        db.incrementUsage(orgId, 'api_calls').catch(console.error);
      }

      next();
    } catch (error) {
      console.error('Tenant middleware error:', error);
      res.status(500).json({ 
        error: 'Failed to identify organization'
      });
    }
  }

  /**
   * Check if a specific feature is enabled for the organization
   */
  static requireFeature(feature) {
    return (req, res, next) => {
      if (!req.orgFeatures || !req.orgFeatures[feature]) {
        return res.status(403).json({ 
          error: 'Feature not available',
          message: `The ${feature} feature is not available in your current plan`,
          upgrade_url: '/billing/upgrade'
        });
      }
      next();
    };
  }

  /**
   * Check if user has required role
   */
  static requireRole(roles) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    return (req, res, next) => {
      if (!req.userRole || !allowedRoles.includes(req.userRole)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          message: 'You do not have permission to perform this action'
        });
      }
      next();
    };
  }

  /**
   * Check resource limits before creating new resources
   */
  static async checkResourceLimit(resource) {
    return async (req, res, next) => {
      try {
        const canCreate = await db.checkUsageLimit(req.orgId, resource);
        if (!canCreate) {
          return res.status(403).json({ 
            error: `${resource} limit exceeded`,
            message: `You have reached your ${resource} limit. Please upgrade your plan.`,
            upgrade_url: '/billing/upgrade'
          });
        }
        next();
      } catch (error) {
        console.error('Resource limit check failed:', error);
        next(); // Allow request to continue on error
      }
    };
  }

  /**
   * List of public routes that don't require organization context
   */
  static isPublicRoute(path) {
    const publicRoutes = [
      '/',
      '/signup',
      '/login',
      '/api/signup',
      '/api/login',
      '/api/webhook',
      '/health',
      '/status',
      '/pricing',
      '/features',
      '/contact',
      '/terms',
      '/privacy'
    ];
    
    return publicRoutes.some(route => path === route || path.startsWith(route + '/'));
  }

  /**
   * Generate JWT token for authenticated user
   */
  static generateToken(user, organization) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      orgId: organization.id,
      orgSubdomain: organization.subdomain,
      orgPlan: organization.plan
    };

    const options = {
      expiresIn: '7d'
    };

    return jwt.sign(payload, JWT_SECRET, options);
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  /**
   * Middleware to ensure user is authenticated
   */
  static requireAuth(req, res, next) {
    if (!req.userId) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please log in to continue'
      });
    }
    next();
  }

  /**
   * Log organization activity
   */
  static async logActivity(req, res, next) {
    // Log activity after response is sent
    res.on('finish', () => {
      if (req.orgId && req.userId && res.statusCode < 400) {
        db.run(
          `INSERT INTO audit_log (org_id, user_id, action, table_name, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            req.orgId,
            req.userId,
            `${req.method} ${req.path}`,
            req.body?.table || null,
            req.ip,
            req.get('user-agent')
          ]
        ).catch(console.error);
      }
    });
    next();
  }
}

module.exports = TenantMiddleware;