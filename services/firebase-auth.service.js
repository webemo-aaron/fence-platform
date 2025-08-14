const admin = require('firebase-admin');
const DatabaseService = require('./database.service');

class FirebaseAuthService extends DatabaseService {
  constructor() {
    super();
    this.initialized = false;
    this.adminInitialized = false;
  }

  async initialize() {
    await super.initialize();
    await this.initializeFirebase();
    await this.createAuthTables();
  }

  async initializeFirebase() {
    if (this.adminInitialized) return;

    try {
      // Initialize Firebase Admin SDK
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        // Production: Use service account key from environment
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID || 'servicehive-f009f'
        });
      } else {
        // Development: Use default credentials or mock
        console.log('Firebase Admin initialized in development mode');
        // For demo purposes, we'll create a mock implementation
        this.createMockFirebaseAdmin();
      }
      
      this.adminInitialized = true;
      console.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('Firebase initialization error:', error);
      // Create mock implementation for development
      this.createMockFirebaseAdmin();
    }
  }

  createMockFirebaseAdmin() {
    // Mock Firebase Admin for development
    this.mockAdmin = {
      auth: () => ({
        verifyIdToken: async (idToken) => {
          // Mock token verification for development
          if (idToken === 'mock-token') {
            return {
              uid: 'mock-user-123',
              email: 'demo@example.com',
              name: 'Demo User',
              picture: 'https://via.placeholder.com/150',
              email_verified: true
            };
          }
          throw new Error('Invalid token');
        },
        createUser: async (userData) => {
          return {
            uid: `mock-user-${Date.now()}`,
            email: userData.email,
            displayName: userData.displayName,
            photoURL: userData.photoURL,
            emailVerified: false
          };
        },
        updateUser: async (uid, userData) => {
          return {
            uid,
            ...userData
          };
        },
        deleteUser: async (uid) => {
          return { success: true };
        }
      })
    };
  }

  async createAuthTables() {
    const tables = [
      // User profiles table
      `CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firebase_uid TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        display_name TEXT,
        photo_url TEXT,
        provider TEXT, -- 'google', 'facebook', 'email'
        role TEXT DEFAULT 'user', -- 'user', 'manager', 'director', 'admin', 'owner'
        organization_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        email_verified BOOLEAN DEFAULT 0,
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // User sessions table
      `CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_token TEXT UNIQUE NOT NULL,
        firebase_token TEXT,
        ip_address TEXT,
        user_agent TEXT,
        expires_at DATETIME NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES user_profiles(id)
      )`,
      
      // Organizations table
      `CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        domain TEXT,
        subscription_plan TEXT DEFAULT 'free', -- 'free', 'professional', 'enterprise'
        max_users INTEGER DEFAULT 5,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // User permissions table
      `CREATE TABLE IF NOT EXISTS user_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        permission TEXT NOT NULL, -- 'create_quotes', 'approve_pricing', 'manage_users', etc.
        granted_by INTEGER,
        granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES user_profiles(id),
        FOREIGN KEY (granted_by) REFERENCES user_profiles(id)
      )`,
      
      // Login attempts table for security
      `CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT,
        ip_address TEXT,
        success BOOLEAN DEFAULT 0,
        error_message TEXT,
        attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const query of tables) {
      await this.db.run(query);
    }

    await this.seedDefaultData();
  }

  async seedDefaultData() {
    // Check if admin user exists
    const existing = await this.db.get('SELECT COUNT(*) as count FROM user_profiles');
    if (existing.count > 0) return;

    // Create default organization
    const orgResult = await this.db.run(`
      INSERT INTO organizations (name, subscription_plan, max_users)
      VALUES ('Invisible Fence Demo', 'enterprise', 50)
    `);

    // Create demo admin user
    await this.db.run(`
      INSERT INTO user_profiles (
        firebase_uid, email, display_name, role, organization_id, is_active, email_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      'demo-admin-123',
      'admin@invisiblefence.demo',
      'Demo Administrator',
      'admin',
      orgResult.id,
      1,
      1
    ]);

    // Create demo permissions
    const adminUser = await this.db.get('SELECT id FROM user_profiles WHERE email = ?', 
      ['admin@invisiblefence.demo']);

    const permissions = [
      'create_quotes', 'approve_pricing', 'manage_users', 'view_analytics',
      'manage_customers', 'schedule_jobs', 'access_crm', 'export_data'
    ];

    for (const permission of permissions) {
      await this.db.run(`
        INSERT INTO user_permissions (user_id, permission)
        VALUES (?, ?)
      `, [adminUser.id, permission]);
    }
  }

  // Verify Firebase ID token and get user
  async verifyToken(idToken) {
    try {
      let decodedToken;
      
      if (this.adminInitialized && admin.apps.length > 0) {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } else {
        // Use mock for development
        decodedToken = await this.mockAdmin.auth().verifyIdToken(idToken);
      }

      // Get or create user profile
      const userProfile = await this.getOrCreateUserProfile(decodedToken);
      
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        profile: userProfile,
        verified: true
      };
    } catch (error) {
      console.error('Token verification failed:', error);
      throw new Error('Invalid authentication token');
    }
  }

  // Get or create user profile in database
  async getOrCreateUserProfile(firebaseUser) {
    let userProfile = await this.db.get(`
      SELECT * FROM user_profiles WHERE firebase_uid = ?
    `, [firebaseUser.uid]);

    if (!userProfile) {
      // Create new user profile
      const result = await this.db.run(`
        INSERT INTO user_profiles (
          firebase_uid, email, display_name, photo_url, provider, email_verified
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        firebaseUser.uid,
        firebaseUser.email,
        firebaseUser.name || firebaseUser.display_name,
        firebaseUser.picture || firebaseUser.photo_url,
        this.getProviderFromEmail(firebaseUser.email),
        firebaseUser.email_verified || false
      ]);

      // Get the created user
      userProfile = await this.db.get(`
        SELECT * FROM user_profiles WHERE id = ?
      `, [result.id]);

      // Assign default permissions for new users
      await this.assignDefaultPermissions(userProfile.id);
    }

    // Update last login
    await this.db.run(`
      UPDATE user_profiles 
      SET last_login = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [userProfile.id]);

    return userProfile;
  }

  // Determine provider from email or other indicators
  getProviderFromEmail(email) {
    if (email.includes('@gmail.com')) return 'google';
    if (email.includes('@facebook.com')) return 'facebook';
    return 'email';
  }

  // Assign default permissions to new users
  async assignDefaultPermissions(userId) {
    const defaultPermissions = ['create_quotes', 'view_analytics', 'access_crm'];
    
    for (const permission of defaultPermissions) {
      await this.db.run(`
        INSERT INTO user_permissions (user_id, permission)
        VALUES (?, ?)
      `, [userId, permission]);
    }
  }

  // Create user session
  async createSession(userProfile, firebaseToken, ipAddress, userAgent) {
    const sessionToken = this.generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.db.run(`
      INSERT INTO user_sessions (
        user_id, session_token, firebase_token, ip_address, user_agent, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      userProfile.id,
      sessionToken,
      firebaseToken,
      ipAddress,
      userAgent,
      expiresAt
    ]);

    return sessionToken;
  }

  // Generate session token
  generateSessionToken() {
    return require('crypto').randomBytes(32).toString('hex');
  }

  // Validate session
  async validateSession(sessionToken) {
    const session = await this.db.get(`
      SELECT s.*, up.* 
      FROM user_sessions s
      JOIN user_profiles up ON s.user_id = up.id
      WHERE s.session_token = ? 
        AND s.is_active = 1 
        AND s.expires_at > datetime('now')
    `, [sessionToken]);

    return session;
  }

  // Get user permissions
  async getUserPermissions(userId) {
    const permissions = await this.db.all(`
      SELECT permission FROM user_permissions 
      WHERE user_id = ?
    `, [userId]);

    return permissions.map(p => p.permission);
  }

  // Check if user has permission
  async hasPermission(userId, permission) {
    const result = await this.db.get(`
      SELECT COUNT(*) as count 
      FROM user_permissions 
      WHERE user_id = ? AND permission = ?
    `, [userId, permission]);

    return result.count > 0;
  }

  // Revoke session
  async revokeSession(sessionToken) {
    await this.db.run(`
      UPDATE user_sessions 
      SET is_active = 0 
      WHERE session_token = ?
    `, [sessionToken]);
  }

  // Log login attempt
  async logLoginAttempt(email, ipAddress, success, errorMessage = null) {
    await this.db.run(`
      INSERT INTO login_attempts (email, ip_address, success, error_message)
      VALUES (?, ?, ?, ?)
    `, [email, ipAddress, success ? 1 : 0, errorMessage]);
  }

  // Get user profile by ID
  async getUserProfile(userId) {
    const profile = await this.db.get(`
      SELECT up.*, o.name as organization_name 
      FROM user_profiles up
      LEFT JOIN organizations o ON up.organization_id = o.id
      WHERE up.id = ?
    `, [userId]);

    if (profile) {
      profile.permissions = await this.getUserPermissions(userId);
    }

    return profile;
  }

  // Update user role
  async updateUserRole(userId, newRole, updatedBy) {
    await this.db.run(`
      UPDATE user_profiles 
      SET role = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newRole, userId]);

    // Log the role change
    console.log(`User ${userId} role updated to ${newRole} by ${updatedBy}`);
  }

  // Get organization users
  async getOrganizationUsers(organizationId) {
    return await this.db.all(`
      SELECT up.*, 
        COUNT(us.id) as active_sessions,
        MAX(us.created_at) as last_session
      FROM user_profiles up
      LEFT JOIN user_sessions us ON up.id = us.user_id AND us.is_active = 1
      WHERE up.organization_id = ?
      GROUP BY up.id
      ORDER BY up.created_at DESC
    `, [organizationId]);
  }
}

module.exports = FirebaseAuthService;