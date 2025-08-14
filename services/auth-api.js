const express = require('express');
const FirebaseAuthService = require('./firebase-auth.service');

const router = express.Router();
const authService = new FirebaseAuthService();

// Initialize the service
authService.initialize().catch(console.error);

// =================
// Authentication Routes
// =================

// Login with Firebase token
router.post('/login', async (req, res) => {
  try {
    const { idToken } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    if (!idToken) {
      return res.status(400).json({ error: 'Firebase ID token is required' });
    }

    // Verify Firebase token and get user
    const verifiedUser = await authService.verifyToken(idToken);
    
    // Create session
    const sessionToken = await authService.createSession(
      verifiedUser.profile,
      idToken,
      ipAddress,
      userAgent
    );

    // Log successful login
    await authService.logLoginAttempt(verifiedUser.email, ipAddress, true);

    res.json({
      success: true,
      user: {
        id: verifiedUser.profile.id,
        uid: verifiedUser.uid,
        email: verifiedUser.email,
        displayName: verifiedUser.profile.display_name,
        photoURL: verifiedUser.profile.photo_url,
        role: verifiedUser.profile.role,
        permissions: await authService.getUserPermissions(verifiedUser.profile.id)
      },
      sessionToken,
      expiresIn: 24 * 60 * 60 // 24 hours in seconds
    });
  } catch (error) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    await authService.logLoginAttempt(req.body.email || 'unknown', ipAddress, false, error.message);
    
    console.error('Login error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Demo login for development
router.post('/demo-login', async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Get demo admin user
    const demoUser = await authService.db.get(`
      SELECT * FROM user_profiles WHERE email = ?
    `, ['admin@invisiblefence.demo']);

    if (!demoUser) {
      return res.status(404).json({ error: 'Demo user not found' });
    }

    // Create session for demo user
    const sessionToken = await authService.createSession(
      demoUser,
      'demo-token',
      ipAddress,
      userAgent
    );

    // Get user permissions
    const permissions = await authService.getUserPermissions(demoUser.id);

    res.json({
      success: true,
      user: {
        id: demoUser.id,
        uid: demoUser.firebase_uid,
        email: demoUser.email,
        displayName: demoUser.display_name,
        photoURL: demoUser.photo_url,
        role: demoUser.role,
        permissions
      },
      sessionToken,
      expiresIn: 24 * 60 * 60,
      demo: true
    });
  } catch (error) {
    console.error('Demo login error:', error);
    res.status(500).json({ error: 'Demo login failed' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (sessionToken) {
      await authService.revokeSession(sessionToken);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Validate session
router.post('/validate', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    
    if (!sessionToken) {
      return res.status(400).json({ error: 'Session token is required' });
    }

    const session = await authService.validateSession(sessionToken);
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const permissions = await authService.getUserPermissions(session.user_id);

    res.json({
      valid: true,
      user: {
        id: session.id,
        uid: session.firebase_uid,
        email: session.email,
        displayName: session.display_name,
        photoURL: session.photo_url,
        role: session.role,
        permissions
      }
    });
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({ error: 'Session validation failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const profile = await authService.getUserProfile(req.user.id);
    res.json(profile);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateUser, async (req, res) => {
  try {
    const { display_name, photo_url } = req.body;
    
    await authService.db.run(`
      UPDATE user_profiles 
      SET display_name = ?, photo_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [display_name, photo_url, req.user.id]);

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// =================
// User Management Routes (Admin only)
// =================

// Get organization users
router.get('/users', authenticateUser, requirePermission('manage_users'), async (req, res) => {
  try {
    const users = await authService.getOrganizationUsers(req.user.organization_id);
    res.json(users);
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role
router.put('/users/:id/role', authenticateUser, requirePermission('manage_users'), async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;
    
    if (!['user', 'manager', 'director', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    await authService.updateUserRole(userId, role, req.user.id);
    res.json({ success: true, message: 'User role updated successfully' });
  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Get user permissions
router.get('/users/:id/permissions', authenticateUser, requirePermission('manage_users'), async (req, res) => {
  try {
    const permissions = await authService.getUserPermissions(req.params.id);
    res.json(permissions);
  } catch (error) {
    console.error('Permissions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// =================
// Organization Management
// =================

// Get organization details
router.get('/organization', authenticateUser, async (req, res) => {
  try {
    const org = await authService.db.get(`
      SELECT * FROM organizations WHERE id = ?
    `, [req.user.organization_id]);

    const userCount = await authService.db.get(`
      SELECT COUNT(*) as count FROM user_profiles 
      WHERE organization_id = ? AND is_active = 1
    `, [req.user.organization_id]);

    res.json({
      ...org,
      current_users: userCount.count
    });
  } catch (error) {
    console.error('Organization fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// =================
// Analytics and Monitoring
// =================

// Get authentication analytics
router.get('/analytics', authenticateUser, requirePermission('view_analytics'), async (req, res) => {
  try {
    const stats = await authService.db.get(`
      SELECT 
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_users,
        COUNT(CASE WHEN last_login >= date('now', '-7 days') THEN 1 END) as weekly_active,
        COUNT(CASE WHEN created_at >= date('now', '-30 days') THEN 1 END) as new_users_month
      FROM user_profiles
      WHERE organization_id = ?
    `, [req.user.organization_id]);

    const loginAttempts = await authService.db.get(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN success = 1 THEN 1 END) as successful_logins,
        COUNT(CASE WHEN success = 0 THEN 1 END) as failed_attempts
      FROM login_attempts
      WHERE attempted_at >= date('now', '-7 days')
    `);

    const activeSessions = await authService.db.get(`
      SELECT COUNT(*) as count FROM user_sessions
      WHERE is_active = 1 AND expires_at > datetime('now')
    `);

    res.json({
      users: stats,
      login_attempts: loginAttempts,
      active_sessions: activeSessions.count
    });
  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// =================
// Middleware Functions
// =================

// Authentication middleware
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = req.headers['x-session-token'];
    
    let token = sessionToken;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }

    const session = await authService.validateSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.user = session;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Permission middleware
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const hasPermission = await authService.hasPermission(req.user.id, permission);
      
      if (!hasPermission && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

// Export middleware for use in other routes
router.authenticateUser = authenticateUser;
router.requirePermission = requirePermission;

module.exports = router;