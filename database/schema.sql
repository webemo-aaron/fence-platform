-- Fence Platform Professional Database Schema
-- PostgreSQL Multi-tenant Architecture

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table (tenants)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'professional',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, email)
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    property_size DECIMAL(10,2),
    fence_length DECIMAL(10,2),
    terrain_type VARCHAR(50),
    obstacles_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quotes table
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    base_price DECIMAL(10,2),
    travel_cost DECIMAL(10,2),
    terrain_adjustment DECIMAL(10,2),
    obstacle_cost DECIMAL(10,2),
    total_price DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    final_price DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'draft',
    valid_until DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    quote_id UUID REFERENCES quotes(id),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    job_number VARCHAR(50) UNIQUE NOT NULL,
    scheduled_date DATE,
    scheduled_time TIME,
    status VARCHAR(50) DEFAULT 'scheduled',
    completion_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ROI Calculations table
CREATE TABLE IF NOT EXISTS roi_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    tier VARCHAR(50) NOT NULL,
    base_price DECIMAL(10,2),
    admin_hours DECIMAL(10,2),
    admin_cost DECIMAL(10,2),
    travel_hours DECIMAL(10,2),
    revenue_leakage_percent DECIMAL(5,2),
    payment_delays DECIMAL(10,2),
    upsell_revenue DECIMAL(10,2),
    predictive_maintenance DECIMAL(10,2),
    monthly_roi DECIMAL(10,2),
    annual_roi DECIMAL(10,2),
    payback_period DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pricing tiers table
CREATE TABLE IF NOT EXISTS pricing_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    tier_name VARCHAR(50) NOT NULL,
    base_price DECIMAL(10,2),
    features JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, tier_name)
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_customers_organization ON customers(organization_id);
CREATE INDEX idx_properties_organization ON properties(organization_id);
CREATE INDEX idx_quotes_organization ON quotes(organization_id);
CREATE INDEX idx_jobs_organization ON jobs(organization_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_activity_logs_organization ON activity_logs(organization_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY users_isolation ON users
    FOR ALL
    USING (organization_id = current_setting('app.current_organization')::UUID);

CREATE POLICY customers_isolation ON customers
    FOR ALL
    USING (organization_id = current_setting('app.current_organization')::UUID);

CREATE POLICY properties_isolation ON properties
    FOR ALL
    USING (organization_id = current_setting('app.current_organization')::UUID);

CREATE POLICY quotes_isolation ON quotes
    FOR ALL
    USING (organization_id = current_setting('app.current_organization')::UUID);

CREATE POLICY jobs_isolation ON jobs
    FOR ALL
    USING (organization_id = current_setting('app.current_organization')::UUID);

CREATE POLICY roi_calculations_isolation ON roi_calculations
    FOR ALL
    USING (organization_id = current_setting('app.current_organization')::UUID);

CREATE POLICY pricing_tiers_isolation ON pricing_tiers
    FOR ALL
    USING (organization_id = current_setting('app.current_organization')::UUID);

CREATE POLICY activity_logs_isolation ON activity_logs
    FOR ALL
    USING (organization_id = current_setting('app.current_organization')::UUID);

-- Insert default organization for demo
INSERT INTO organizations (name, subdomain, plan, status)
VALUES ('Demo Fence Company', 'demo', 'professional', 'active')
ON CONFLICT (subdomain) DO NOTHING;

-- Insert default pricing tiers
INSERT INTO pricing_tiers (organization_id, tier_name, base_price, features)
SELECT 
    id,
    'Essentials',
    299,
    '{"admin_hours": 20, "travel_hours": 10, "revenue_leakage": 5, "payment_delays": 500}'::jsonb
FROM organizations WHERE subdomain = 'demo'
ON CONFLICT (organization_id, tier_name) DO NOTHING;

INSERT INTO pricing_tiers (organization_id, tier_name, base_price, features)
SELECT 
    id,
    'Professional',
    599,
    '{"admin_hours": 40, "travel_hours": 20, "revenue_leakage": 8, "payment_delays": 1000, "upsell_revenue": 500}'::jsonb
FROM organizations WHERE subdomain = 'demo'
ON CONFLICT (organization_id, tier_name) DO NOTHING;

INSERT INTO pricing_tiers (organization_id, tier_name, base_price, features)
SELECT 
    id,
    'Enterprise',
    999,
    '{"admin_hours": 60, "travel_hours": 30, "revenue_leakage": 12, "payment_delays": 2000, "upsell_revenue": 1500, "predictive_maintenance": 1000}'::jsonb
FROM organizations WHERE subdomain = 'demo'
ON CONFLICT (organization_id, tier_name) DO NOTHING;