const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function runMigration() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(__dirname, '../data/invisible-fence.db');
    const db = new sqlite3.Database(dbPath);

    console.log('Starting multi-tenant migration...');

    db.serialize(() => {
      // Create organizations table
      db.run(`
        CREATE TABLE IF NOT EXISTS organizations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          subdomain TEXT UNIQUE NOT NULL,
          email TEXT NOT NULL,
          phone TEXT,
          plan TEXT DEFAULT 'trial',
          stripe_customer_id TEXT,
          stripe_subscription_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          trial_ends_at DATETIME DEFAULT (datetime('now', '+14 days')),
          is_active BOOLEAN DEFAULT 1,
          settings TEXT DEFAULT '{}',
          limits TEXT DEFAULT '{"users": 5, "monthly_jobs": 100, "storage_gb": 1}'
        )
      `, (err) => {
        if (err) console.error('Error creating organizations table:', err);
        else console.log('✓ Organizations table created');
      });

      // Add org_id to existing tables
      const tables = [
        'customers',
        'leads',
        'appointments',
        'quote_history',
        'roi_calculations',
        'pricing_approvals',
        'interactions',
        'users'
      ];

      tables.forEach(table => {
        // Check if column already exists
        db.all(`PRAGMA table_info(${table})`, (err, columns) => {
          if (err) {
            console.error(`Error checking ${table}:`, err);
            return;
          }

          const hasOrgId = columns.some(col => col.name === 'org_id');
          
          if (!hasOrgId) {
            db.run(`ALTER TABLE ${table} ADD COLUMN org_id INTEGER DEFAULT 1`, (err) => {
              if (err) console.error(`Error adding org_id to ${table}:`, err);
              else console.log(`✓ Added org_id to ${table}`);
            });
          } else {
            console.log(`✓ ${table} already has org_id`);
          }
        });
      });

      // Create default organization for existing data
      db.run(`
        INSERT OR IGNORE INTO organizations (id, name, subdomain, email, plan, is_active)
        VALUES (1, 'Demo Company', 'demo', 'demo@example.com', 'trial', 1)
      `, (err) => {
        if (err) console.error('Error creating default org:', err);
        else console.log('✓ Default organization created');
      });

      // Create indexes for better performance
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(org_id)',
        'CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(org_id)',
        'CREATE INDEX IF NOT EXISTS idx_appointments_org ON appointments(org_id)',
        'CREATE INDEX IF NOT EXISTS idx_quotes_org ON quote_history(org_id)',
        'CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id)',
        'CREATE INDEX IF NOT EXISTS idx_orgs_subdomain ON organizations(subdomain)'
      ];

      indexes.forEach(indexSql => {
        db.run(indexSql, (err) => {
          if (err) console.error('Error creating index:', err);
        });
      });

      console.log('✓ Multi-tenant migration completed');
    });

    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        reject(err);
      } else {
        console.log('✓ Database migration successful');
        resolve();
      }
    });
  });
}

// Run if executed directly
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = runMigration;