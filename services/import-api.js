const express = require('express');
const router = express.Router();
const multer = require('multer');
const ImportService = require('./import.service');
const TenantMiddleware = require('../middleware/tenant.middleware');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

const importService = new ImportService();

// ==========================================
// IMPORT ROUTES
// ==========================================

/**
 * POST /api/import/analyze
 * Analyze uploaded file and detect fields
 */
router.post('/analyze',
  TenantMiddleware.requireAuth,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Create import session
      const sessionId = await importService.createImportSession(
        req.orgId,
        req.userId,
        {
          name: req.file.originalname,
          type: req.body.type || 'customer'
        }
      );

      // Analyze file
      const analysis = await importService.analyzeFile(req.file, req.orgId);

      res.json({
        success: true,
        sessionId,
        analysis
      });

    } catch (error) {
      console.error('File analysis error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/import/preview
 * Preview import with field mapping
 */
router.post('/preview',
  TenantMiddleware.requireAuth,
  upload.single('file'),
  async (req, res) => {
    try {
      const { mapping, sessionId } = req.body;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Parse file
      const data = await importService.parseFile(req.file);
      
      // Apply mapping and validate
      const preview = {
        totalRecords: data.length,
        sampleMapped: [],
        validation: await importService.validateData(data.slice(0, 100), req.orgId)
      };

      // Map first 10 records as preview
      for (let i = 0; i < Math.min(10, data.length); i++) {
        const mapped = importService.applyFieldMapping(
          data[i],
          JSON.parse(mapping)
        );
        preview.sampleMapped.push({
          original: data[i],
          mapped
        });
      }

      res.json({
        success: true,
        preview
      });

    } catch (error) {
      console.error('Preview error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/import/start
 * Begin import process
 */
router.post('/start',
  TenantMiddleware.requireAuth,
  TenantMiddleware.checkResourceLimit('jobs'),
  upload.single('file'),
  async (req, res) => {
    try {
      const { sessionId, mapping, options } = req.body;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Parse file
      const data = await importService.parseFile(req.file);
      
      // Check if user has enough quota
      const canImport = await req.db.checkUsageLimit(req.orgId, 'jobs');
      if (!canImport && data.length > 10) {
        return res.status(403).json({
          success: false,
          error: 'Import limit exceeded. Please upgrade your plan.',
          upgrade_url: '/billing/upgrade'
        });
      }

      // Start import in background
      res.json({
        success: true,
        sessionId,
        message: 'Import started. Check progress endpoint for updates.'
      });

      // Execute import asynchronously
      importService.executeImport(
        sessionId,
        data,
        JSON.parse(mapping),
        JSON.parse(options || '{}')
      ).catch(error => {
        console.error('Import execution error:', error);
        // Update session with error
        req.db.run(
          'UPDATE import_sessions SET status = $1, error_log = $2 WHERE id = $3',
          ['failed', JSON.stringify({ error: error.message }), sessionId],
          req.orgId
        );
      });

    } catch (error) {
      console.error('Import start error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/import/progress/:sessionId
 * Get real-time import progress
 */
router.get('/progress/:sessionId',
  TenantMiddleware.requireAuth,
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      const session = await req.db.get(
        `SELECT * FROM import_sessions 
         WHERE id = $1 AND org_id = $2`,
        [sessionId, req.orgId],
        req.orgId
      );

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Import session not found'
        });
      }

      // Get recent import records for details
      const recentRecords = await req.db.all(
        `SELECT status, COUNT(*) as count 
         FROM import_records 
         WHERE session_id = $1 
         GROUP BY status`,
        [sessionId],
        req.orgId
      );

      const progress = {
        sessionId: session.id,
        status: session.status,
        fileName: session.file_name,
        totalRecords: session.total_records || 0,
        importedRecords: session.imported_records || 0,
        duplicateRecords: session.duplicate_records || 0,
        errorRecords: session.error_records || 0,
        percentComplete: session.total_records > 0 
          ? Math.round((session.imported_records || 0) / session.total_records * 100)
          : 0,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        details: recentRecords
      };

      res.json({
        success: true,
        progress
      });

    } catch (error) {
      console.error('Progress check error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/import/rollback/:sessionId
 * Rollback an import session
 */
router.post('/rollback/:sessionId',
  TenantMiddleware.requireAuth,
  TenantMiddleware.requireRole('admin'),
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      // Check if session exists and belongs to org
      const session = await req.db.get(
        `SELECT * FROM import_sessions 
         WHERE id = $1 AND org_id = $2 AND rollback_available = true`,
        [sessionId, req.orgId],
        req.orgId
      );

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Import session not found or rollback not available'
        });
      }

      // Perform rollback
      const result = await importService.rollbackImport(sessionId, req.orgId);

      res.json({
        success: true,
        message: `Rollback completed. ${result.deletedCount} records removed.`,
        deletedCount: result.deletedCount
      });

    } catch (error) {
      console.error('Rollback error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/import/templates/:type
 * Download import template
 */
router.get('/templates/:type',
  async (req, res) => {
    try {
      const { type } = req.params;
      const validTypes = ['customer', 'lead', 'quote'];

      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid template type'
        });
      }

      const template = importService.generateImportTemplate(type);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="fence-platform-${type}-import-template.xlsx"`
      );

      res.send(template);

    } catch (error) {
      console.error('Template generation error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/import/history
 * Get import history for organization
 */
router.get('/history',
  TenantMiddleware.requireAuth,
  async (req, res) => {
    try {
      const history = await req.db.all(
        `SELECT 
          id, import_type, file_name, total_records, 
          imported_records, duplicate_records, error_records,
          status, started_at, completed_at,
          (SELECT email FROM users WHERE id = user_id) as imported_by
         FROM import_sessions 
         WHERE org_id = $1 
         ORDER BY started_at DESC 
         LIMIT 20`,
        [req.orgId],
        req.orgId
      );

      res.json({
        success: true,
        history
      });

    } catch (error) {
      console.error('History fetch error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/import/quickbooks/connect
 * Initialize QuickBooks connection
 */
router.post('/quickbooks/connect',
  TenantMiddleware.requireAuth,
  TenantMiddleware.requireFeature('quickbooks_integration'),
  async (req, res) => {
    try {
      // Generate QuickBooks OAuth URL
      const authUrl = `https://appcenter.intuit.com/connect/oauth2/v1/authorize`
        + `?client_id=${process.env.QB_CLIENT_ID}`
        + `&scope=com.intuit.quickbooks.accounting`
        + `&redirect_uri=${process.env.QB_REDIRECT_URI}`
        + `&response_type=code`
        + `&state=${req.orgId}`;

      res.json({
        success: true,
        authUrl,
        message: 'Redirect user to QuickBooks authorization'
      });

    } catch (error) {
      console.error('QuickBooks connection error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/import/quickbooks/callback
 * Handle QuickBooks OAuth callback
 */
router.post('/quickbooks/callback',
  TenantMiddleware.requireAuth,
  async (req, res) => {
    try {
      const { code, realmId } = req.body;

      // Exchange code for tokens
      // This would connect to QuickBooks API
      // Store tokens securely for the organization

      res.json({
        success: true,
        message: 'QuickBooks connected successfully'
      });

    } catch (error) {
      console.error('QuickBooks callback error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/import/manual
 * Import data manually entered or pasted
 */
router.post('/manual',
  TenantMiddleware.requireAuth,
  async (req, res) => {
    try {
      const { data, type } = req.body;

      if (!data || !Array.isArray(data)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid data format'
        });
      }

      // Create import session
      const sessionId = await importService.createImportSession(
        req.orgId,
        req.userId,
        {
          name: 'Manual Import',
          type: type || 'customer'
        }
      );

      // Process manual data
      const mapping = importService.suggestFieldMapping(data[0]);
      const results = await importService.executeImport(
        sessionId,
        data,
        mapping,
        { ignoreDuplicates: false }
      );

      res.json({
        success: true,
        sessionId,
        results
      });

    } catch (error) {
      console.error('Manual import error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

module.exports = router;