-- Multi-Tenant PostgreSQL Migration for Production
-- Supports high-concurrency and proper data isolation

BEGIN;

-- Enable UUID extension for better distributed IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search optimization

-- =====================================================
-- ORGANIZATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    custom_domain VARCHAR(255) UNIQUE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    plan VARCHAR(50) DEFAULT 'trial',
    
    -- Billing
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    billing_email VARCHAR(255),
    
    -- Limits based on plan
    max_users INTEGER DEFAULT 5,
    max_monthly_jobs INTEGER DEFAULT 100,
    max_storage_gb INTEGER DEFAULT 1,
    max_api_calls INTEGER DEFAULT 10000,
    
    -- Features flags
    features JSONB DEFAULT '{
        "roi_calculator": true,
        "location_pricing": true,
        "smart_scheduling": false,
        "approval_workflow": false,
        "api_access": false,
        "white_label": false,
        "custom_integrations": false
    }'::jsonb,
    
    -- Settings
    settings JSONB DEFAULT '{
        "timezone": "America/Chicago",
        "business_hours": "9-5",
        "currency": "USD",
        "date_format": "MM/DD/YYYY"
    }'::jsonb,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    trial_ends_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days'),
    suspended_at TIMESTAMP,
    suspension_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP, -- Soft delete
    
    -- Indexes for performance
    CONSTRAINT check_plan CHECK (plan IN ('trial', 'starter', 'growth', 'enterprise', 'custom'))
);

CREATE INDEX idx_orgs_subdomain ON organizations(subdomain) WHERE deleted_at IS NULL;
CREATE INDEX idx_orgs_custom_domain ON organizations(custom_domain) WHERE custom_domain IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_orgs_active ON organizations(is_active, trial_ends_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_orgs_plan ON organizations(plan) WHERE deleted_at IS NULL;

-- =====================================================
-- USAGE TRACKING TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    
    -- Usage metrics
    active_users INTEGER DEFAULT 0,
    jobs_created INTEGER DEFAULT 0,
    quotes_generated INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    storage_used_bytes BIGINT DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    sms_sent INTEGER DEFAULT 0,
    
    -- Calculated costs
    overage_charges DECIMAL(10, 2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(org_id, month)
);

CREATE INDEX idx_usage_org_month ON organization_usage(org_id, month DESC);

-- =====================================================
-- UPDATE EXISTING TABLES WITH ORG_ID
-- =====================================================

-- Add org_id to customers table with proper foreign key
ALTER TABLE customers 
    ADD COLUMN IF NOT EXISTS org_id UUID,
    ADD CONSTRAINT fk_customers_org FOREIGN KEY (org_id) 
        REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_customers_org ON customers(org_id) WHERE org_id IS NOT NULL;

-- Add org_id to leads table
ALTER TABLE leads 
    ADD COLUMN IF NOT EXISTS org_id UUID,
    ADD CONSTRAINT fk_leads_org FOREIGN KEY (org_id) 
        REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_leads_org ON leads(org_id) WHERE org_id IS NOT NULL;

-- Add org_id to appointments table
ALTER TABLE appointments 
    ADD COLUMN IF NOT EXISTS org_id UUID,
    ADD CONSTRAINT fk_appointments_org FOREIGN KEY (org_id) 
        REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_appointments_org ON appointments(org_id) WHERE org_id IS NOT NULL;

-- Add org_id to quote_history table
ALTER TABLE quote_history 
    ADD COLUMN IF NOT EXISTS org_id UUID,
    ADD CONSTRAINT fk_quotes_org FOREIGN KEY (org_id) 
        REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_quotes_org ON quote_history(org_id) WHERE org_id IS NOT NULL;

-- Add org_id to roi_calculations table
ALTER TABLE roi_calculations 
    ADD COLUMN IF NOT EXISTS org_id UUID,
    ADD CONSTRAINT fk_roi_org FOREIGN KEY (org_id) 
        REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_roi_org ON roi_calculations(org_id) WHERE org_id IS NOT NULL;

-- Add org_id to pricing_approvals table
ALTER TABLE pricing_approvals 
    ADD COLUMN IF NOT EXISTS org_id UUID,
    ADD CONSTRAINT fk_approvals_org FOREIGN KEY (org_id) 
        REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_approvals_org ON pricing_approvals(org_id) WHERE org_id IS NOT NULL;

-- Add org_id to users table
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS org_id UUID,
    ADD CONSTRAINT fk_users_org FOREIGN KEY (org_id) 
        REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_users_org ON users(org_id) WHERE org_id IS NOT NULL;

-- Add org_id to interactions table
ALTER TABLE interactions 
    ADD COLUMN IF NOT EXISTS org_id UUID,
    ADD CONSTRAINT fk_interactions_org FOREIGN KEY (org_id) 
        REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_interactions_org ON interactions(org_id) WHERE org_id IS NOT NULL;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tenant tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Create application role if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user;
    END IF;
END $$;

-- Create RLS policies for each table
-- Customers
CREATE POLICY customers_isolation ON customers
    FOR ALL
    TO app_user
    USING (org_id = current_setting('app.current_org_id')::uuid);

-- Leads
CREATE POLICY leads_isolation ON leads
    FOR ALL
    TO app_user
    USING (org_id = current_setting('app.current_org_id')::uuid);

-- Appointments
CREATE POLICY appointments_isolation ON appointments
    FOR ALL
    TO app_user
    USING (org_id = current_setting('app.current_org_id')::uuid);

-- Quotes
CREATE POLICY quotes_isolation ON quote_history
    FOR ALL
    TO app_user
    USING (org_id = current_setting('app.current_org_id')::uuid);

-- ROI Calculations
CREATE POLICY roi_isolation ON roi_calculations
    FOR ALL
    TO app_user
    USING (org_id = current_setting('app.current_org_id')::uuid);

-- Pricing Approvals
CREATE POLICY approvals_isolation ON pricing_approvals
    FOR ALL
    TO app_user
    USING (org_id = current_setting('app.current_org_id')::uuid);

-- Users
CREATE POLICY users_isolation ON users
    FOR ALL
    TO app_user
    USING (org_id = current_setting('app.current_org_id')::uuid);

-- Interactions
CREATE POLICY interactions_isolation ON interactions
    FOR ALL
    TO app_user
    USING (org_id = current_setting('app.current_org_id')::uuid);

-- =====================================================
-- PARTITIONING FOR SCALE (Optional but recommended)
-- =====================================================

-- Create partitioned tables for high-volume data
CREATE TABLE IF NOT EXISTS quote_history_partitioned (
    LIKE quote_history INCLUDING ALL
) PARTITION BY LIST (org_id);

-- Create function to auto-create partitions
CREATE OR REPLACE FUNCTION create_org_partition()
RETURNS TRIGGER AS $$
DECLARE
    partition_name TEXT;
    org_id_str TEXT;
BEGIN
    -- Convert UUID to string for partition naming
    org_id_str := REPLACE(NEW.id::text, '-', '_');
    partition_name := 'quote_history_org_' || org_id_str;
    
    -- Check if partition exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_class 
        WHERE relname = partition_name
    ) THEN
        -- Create partition
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF quote_history_partitioned FOR VALUES IN (%L)',
            partition_name, NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create partitions
CREATE TRIGGER create_partition_trigger
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION create_org_partition();

-- =====================================================
-- AUDIT TABLES
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_org ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);

-- =====================================================
-- PERFORMANCE VIEWS
-- =====================================================
CREATE OR REPLACE VIEW organization_stats AS
SELECT 
    o.id,
    o.name,
    o.plan,
    o.created_at,
    COUNT(DISTINCT c.id) as customer_count,
    COUNT(DISTINCT l.id) as lead_count,
    COUNT(DISTINCT q.id) as quote_count,
    COUNT(DISTINCT u.id) as user_count,
    ou.jobs_created as monthly_jobs,
    ou.storage_used_bytes as storage_used,
    CASE 
        WHEN o.trial_ends_at > NOW() THEN 'trial'
        WHEN o.is_active THEN 'active'
        ELSE 'inactive'
    END as status
FROM organizations o
LEFT JOIN customers c ON c.org_id = o.id
LEFT JOIN leads l ON l.org_id = o.id
LEFT JOIN quote_history q ON q.org_id = o.id
LEFT JOIN users u ON u.org_id = o.id
LEFT JOIN organization_usage ou ON ou.org_id = o.id 
    AND ou.month = DATE_TRUNC('month', CURRENT_DATE)
WHERE o.deleted_at IS NULL
GROUP BY o.id, o.name, o.plan, o.created_at, ou.jobs_created, ou.storage_used_bytes;

-- =====================================================
-- DEFAULT DATA
-- =====================================================

-- Insert demo organization for testing
INSERT INTO organizations (
    id,
    name,
    subdomain,
    email,
    plan,
    is_active,
    features,
    settings
) VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Demo Company',
    'demo',
    'demo@fenceplatform.com',
    'enterprise',
    true,
    '{
        "roi_calculator": true,
        "location_pricing": true,
        "smart_scheduling": true,
        "approval_workflow": true,
        "api_access": true,
        "white_label": false,
        "custom_integrations": false
    }'::jsonb,
    '{
        "timezone": "America/Chicago",
        "business_hours": "8-6",
        "currency": "USD",
        "date_format": "MM/DD/YYYY",
        "week_starts": "monday"
    }'::jsonb
) ON CONFLICT (subdomain) DO NOTHING;

-- Update existing data to belong to demo org
UPDATE customers SET org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' WHERE org_id IS NULL;
UPDATE leads SET org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' WHERE org_id IS NULL;
UPDATE appointments SET org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' WHERE org_id IS NULL;
UPDATE quote_history SET org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' WHERE org_id IS NULL;
UPDATE roi_calculations SET org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' WHERE org_id IS NULL;
UPDATE pricing_approvals SET org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' WHERE org_id IS NULL;
UPDATE users SET org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' WHERE org_id IS NULL;
UPDATE interactions SET org_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' WHERE org_id IS NULL;

-- =====================================================
-- FUNCTIONS FOR MULTI-TENANT OPERATIONS
-- =====================================================

-- Function to get organization by subdomain
CREATE OR REPLACE FUNCTION get_org_by_subdomain(subdomain_param VARCHAR)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    plan VARCHAR,
    features JSONB,
    settings JSONB,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.name,
        o.plan,
        o.features,
        o.settings,
        o.is_active
    FROM organizations o
    WHERE o.subdomain = subdomain_param
        AND o.deleted_at IS NULL
        AND o.is_active = true
        AND (o.plan != 'trial' OR o.trial_ends_at > NOW());
END;
$$ LANGUAGE plpgsql;

-- Function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(
    org_id_param UUID,
    metric VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    current_usage INTEGER;
    max_allowed INTEGER;
BEGIN
    SELECT 
        CASE metric
            WHEN 'users' THEN COUNT(*)::INTEGER
            WHEN 'jobs' THEN COALESCE(ou.jobs_created, 0)
            WHEN 'quotes' THEN COALESCE(ou.quotes_generated, 0)
            WHEN 'api_calls' THEN COALESCE(ou.api_calls, 0)
        END,
        CASE metric
            WHEN 'users' THEN o.max_users
            WHEN 'jobs' THEN o.max_monthly_jobs
            WHEN 'quotes' THEN o.max_monthly_jobs * 2 -- Quotes are 2x jobs
            WHEN 'api_calls' THEN o.max_api_calls
        END
    INTO current_usage, max_allowed
    FROM organizations o
    LEFT JOIN organization_usage ou ON ou.org_id = o.id 
        AND ou.month = DATE_TRUNC('month', CURRENT_DATE)
    LEFT JOIN users u ON u.org_id = o.id AND metric = 'users'
    WHERE o.id = org_id_param
    GROUP BY o.id, o.max_users, o.max_monthly_jobs, o.max_api_calls, ou.jobs_created, ou.quotes_generated, ou.api_calls;
    
    RETURN current_usage < max_allowed;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =====================================================
-- MIGRATION NOTES
-- =====================================================
-- 1. Run this migration on your PostgreSQL database
-- 2. Update DATABASE_URL environment variable
-- 3. Update application code to use PostgreSQL driver
-- 4. Test with multiple subdomains
-- 5. Monitor performance with pg_stat_statements