# Data Import Strategy for Fence Platform

## 🎯 Goal
Enable fence installers to import their existing business data in under 5 minutes with zero technical knowledge required.

## 📊 Common Data Sources for Fence Businesses

### Primary Sources (80% of users)
1. **Excel/CSV Files** (60% of users)
   - Customer lists
   - Quote spreadsheets
   - Job tracking sheets
   - Contact databases

2. **QuickBooks** (25% of users)
   - Customer records
   - Invoices and estimates
   - Payment history
   - Vendor information

3. **Paper Records** (10% of users)
   - Handwritten customer cards
   - Paper invoices
   - Physical appointment books

4. **Email Systems** (5% of users)
   - Gmail/Outlook contacts
   - Email quotes
   - Communication history

### Data Types to Import

#### Essential Data (Must Have)
- **Customers**: Name, address, phone, email
- **Jobs/Projects**: Location, date, price, status
- **Quotes**: Customer, items, pricing, status

#### Nice to Have
- **Leads**: Source, score, estimated value
- **Appointments**: Date, time, customer, type
- **Notes**: Customer interactions, special requests
- **Photos**: Property images, completed work

## 🚀 Import Process Flow

### Step 1: Choose Import Method (30 seconds)
```
┌─────────────────────────────────────┐
│   How would you like to import?     │
├─────────────────────────────────────┤
│ 📊 Upload Excel/CSV File            │
│ 📱 Connect QuickBooks                │
│ 📧 Import from Email                 │
│ 📝 Manual Entry Assistant            │
│ 🤖 Take Photo of Paper Records      │
└─────────────────────────────────────┘
```

### Step 2: Smart Template Matching (1 minute)
```
┌─────────────────────────────────────┐
│   We detected your file type!       │
├─────────────────────────────────────┤
│ ✓ Customer list with 247 records    │
│ ✓ 15 columns detected               │
│ ✓ Automatic field mapping ready     │
│                                     │
│ [Review Mapping] [Start Import]     │
└─────────────────────────────────────┘
```

### Step 3: Field Mapping (Optional)
```
Your Fields          →  Our Fields
─────────────────────────────────────
Client Name          →  Customer Name ✓
Street Address       →  Address ✓
Cell Phone          →  Phone ✓
Email Address       →  Email ✓
Last Service Date   →  Last Job Date ✓
[Unmapped: Notes]   →  [Select Field ▼]
```

### Step 4: Preview & Validate (30 seconds)
```
┌─────────────────────────────────────┐
│   Import Preview                     │
├─────────────────────────────────────┤
│ ✓ 245 valid records ready           │
│ ⚠ 2 duplicates found (merge?)       │
│ ✗ 0 errors                          │
│                                     │
│ Sample:                             │
│ • John Smith - (555) 123-4567      │
│ • Mary Johnson - (555) 234-5678    │
│                                     │
│ [Fix Issues] [Import All]           │
└─────────────────────────────────────┘
```

### Step 5: Import Progress (2 minutes)
```
┌─────────────────────────────────────┐
│   Importing Your Data...             │
├─────────────────────────────────────┤
│ ████████████░░░░░░░ 65%            │
│                                     │
│ ✓ 160 customers imported            │
│ ⟳ 85 remaining                      │
│                                     │
│ Estimated time: 45 seconds          │
└─────────────────────────────────────┘
```

## 💡 Smart Import Features

### 1. Intelligent Field Detection
```javascript
const smartFieldMapping = {
  // Common variations automatically detected
  customerName: [
    'customer', 'client', 'name', 'customer name', 
    'client name', 'contact', 'account'
  ],
  phone: [
    'phone', 'tel', 'telephone', 'mobile', 'cell',
    'phone number', 'contact number'
  ],
  email: [
    'email', 'e-mail', 'email address', 'contact email'
  ],
  address: [
    'address', 'street', 'location', 'street address',
    'service address', 'property address'
  ]
};
```

### 2. Duplicate Detection & Merging
```javascript
// Intelligent duplicate detection
- Match by email (exact)
- Match by phone (normalized)
- Match by name + address (fuzzy)

// Merge options
- Keep existing (skip import)
- Overwrite with new data
- Merge (combine both records)
- Create as new (allow duplicate)
```

### 3. Data Enrichment
```javascript
// Automatically enhance imported data
- Format phone numbers: (555) 123-4567
- Validate email addresses
- Geocode addresses for mapping
- Normalize state abbreviations
- Calculate customer lifetime value
```

### 4. Flexible Import Templates

#### Download Templates
```
┌─────────────────────────────────────┐
│   Download Import Templates          │
├─────────────────────────────────────┤
│ 📊 Basic Customer List (.xlsx)      │
│ 📊 Full Customer + Jobs (.xlsx)     │
│ 📊 Quotes & Estimates (.xlsx)       │
│ 📊 QuickBooks Export Guide (.pdf)   │
└─────────────────────────────────────┘
```

## 🔧 Implementation Details

### CSV/Excel Parser Service
```javascript
// services/import.service.js
const xlsx = require('xlsx');
const csv = require('csv-parse');
const { validateEmail, formatPhone } = require('./validators');

class ImportService {
  async parseFile(file, orgId) {
    const extension = file.name.split('.').pop().toLowerCase();
    
    let data;
    if (extension === 'csv') {
      data = await this.parseCSV(file);
    } else if (['xlsx', 'xls'].includes(extension)) {
      data = await this.parseExcel(file);
    } else {
      throw new Error('Unsupported file type');
    }
    
    return this.processData(data, orgId);
  }
  
  async parseExcel(file) {
    const workbook = xlsx.read(file.buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return xlsx.utils.sheet_to_json(sheet);
  }
  
  async parseCSV(file) {
    return new Promise((resolve, reject) => {
      csv.parse(file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });
  }
  
  async processData(records, orgId) {
    const results = {
      valid: [],
      duplicates: [],
      errors: [],
      warnings: []
    };
    
    for (const record of records) {
      try {
        const processed = await this.processRecord(record, orgId);
        
        // Check for duplicates
        const duplicate = await this.checkDuplicate(processed, orgId);
        if (duplicate) {
          results.duplicates.push({
            new: processed,
            existing: duplicate
          });
        } else {
          results.valid.push(processed);
        }
      } catch (error) {
        results.errors.push({
          record,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  async processRecord(record, orgId) {
    // Map fields intelligently
    const mapped = this.mapFields(record);
    
    // Validate and format
    return {
      org_id: orgId,
      first_name: mapped.firstName,
      last_name: mapped.lastName,
      email: validateEmail(mapped.email),
      phone: formatPhone(mapped.phone),
      address: mapped.address,
      city: mapped.city,
      state: this.normalizeState(mapped.state),
      zip: mapped.zip,
      notes: mapped.notes,
      source: 'import',
      import_date: new Date()
    };
  }
  
  mapFields(record) {
    const mapped = {};
    
    // Smart field detection
    for (const [key, value] of Object.entries(record)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (this.isNameField(normalizedKey)) {
        const names = this.splitName(value);
        mapped.firstName = names.first;
        mapped.lastName = names.last;
      } else if (this.isEmailField(normalizedKey)) {
        mapped.email = value;
      } else if (this.isPhoneField(normalizedKey)) {
        mapped.phone = value;
      } else if (this.isAddressField(normalizedKey)) {
        mapped.address = value;
      }
      // ... more field mappings
    }
    
    return mapped;
  }
  
  async checkDuplicate(record, orgId) {
    // Check by email
    if (record.email) {
      const existing = await db.get(
        'SELECT * FROM customers WHERE org_id = $1 AND email = $2',
        [orgId, record.email]
      );
      if (existing) return existing;
    }
    
    // Check by phone
    if (record.phone) {
      const normalizedPhone = record.phone.replace(/\D/g, '');
      const existing = await db.get(
        'SELECT * FROM customers WHERE org_id = $1 AND phone LIKE $2',
        [orgId, `%${normalizedPhone.slice(-10)}%`]
      );
      if (existing) return existing;
    }
    
    return null;
  }
}
```

### QuickBooks Integration
```javascript
// services/quickbooks.service.js
const QuickBooksAPI = require('node-quickbooks');

class QuickBooksImportService {
  async connect(orgId, authCode) {
    const qbo = new QuickBooksAPI(
      process.env.QB_CLIENT_ID,
      process.env.QB_CLIENT_SECRET,
      authCode,
      false, // no token
      orgId,
      true, // use sandbox
      false, // debug
      34, // minor version
      '2.0', // oauth version
      process.env.QB_REDIRECT_URI
    );
    
    return qbo;
  }
  
  async importCustomers(qbo, orgId) {
    const customers = await qbo.findCustomers({
      fetchAll: true
    });
    
    const imported = [];
    for (const qbCustomer of customers.QueryResponse.Customer) {
      const customer = {
        org_id: orgId,
        first_name: qbCustomer.GivenName,
        last_name: qbCustomer.FamilyName,
        company: qbCustomer.CompanyName,
        email: qbCustomer.PrimaryEmailAddr?.Address,
        phone: qbCustomer.PrimaryPhone?.FreeFormNumber,
        address: qbCustomer.BillAddr?.Line1,
        city: qbCustomer.BillAddr?.City,
        state: qbCustomer.BillAddr?.CountrySubDivisionCode,
        zip: qbCustomer.BillAddr?.PostalCode,
        quickbooks_id: qbCustomer.Id,
        balance: qbCustomer.Balance,
        source: 'quickbooks'
      };
      
      imported.push(customer);
    }
    
    return imported;
  }
  
  async importInvoices(qbo, orgId) {
    const invoices = await qbo.findInvoices({
      fetchAll: true
    });
    
    // Convert to quotes/jobs
    const imported = [];
    for (const invoice of invoices.QueryResponse.Invoice) {
      const quote = {
        org_id: orgId,
        customer_quickbooks_id: invoice.CustomerRef.value,
        total_amount: invoice.TotalAmt,
        date: invoice.TxnDate,
        status: invoice.Balance > 0 ? 'pending' : 'paid',
        line_items: JSON.stringify(invoice.Line),
        quickbooks_id: invoice.Id,
        source: 'quickbooks'
      };
      
      imported.push(quote);
    }
    
    return imported;
  }
}
```

### OCR for Paper Records
```javascript
// services/ocr.service.js
const vision = require('@google-cloud/vision');

class OCRImportService {
  constructor() {
    this.client = new vision.ImageAnnotatorClient();
  }
  
  async extractFromImage(imageBuffer) {
    const [result] = await this.client.textDetection(imageBuffer);
    const text = result.fullTextAnnotation.text;
    
    // Parse structured data
    const extracted = {
      names: this.extractNames(text),
      phones: this.extractPhones(text),
      emails: this.extractEmails(text),
      addresses: this.extractAddresses(text),
      prices: this.extractPrices(text)
    };
    
    return extracted;
  }
  
  extractPhones(text) {
    const phoneRegex = /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    return text.match(phoneRegex) || [];
  }
  
  extractEmails(text) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return text.match(emailRegex) || [];
  }
  
  extractPrices(text) {
    const priceRegex = /\$[\d,]+\.?\d*/g;
    return text.match(priceRegex) || [];
  }
}
```

## 📱 Import Wizard UI

### Step 1: Welcome Screen
```html
<!-- ui/import-wizard.html -->
<div class="import-wizard">
  <div class="wizard-header">
    <h1>Import Your Data in Minutes!</h1>
    <p>We'll help you bring over your existing customers and jobs</p>
  </div>
  
  <div class="import-options">
    <div class="import-card" onclick="selectImport('excel')">
      <div class="icon">📊</div>
      <h3>Excel or CSV File</h3>
      <p>Upload your spreadsheet</p>
      <span class="popular-badge">Most Popular</span>
    </div>
    
    <div class="import-card" onclick="selectImport('quickbooks')">
      <div class="icon">📗</div>
      <h3>QuickBooks</h3>
      <p>Connect and sync automatically</p>
    </div>
    
    <div class="import-card" onclick="selectImport('photo')">
      <div class="icon">📸</div>
      <h3>Photo of Records</h3>
      <p>Take a photo of paper records</p>
      <span class="new-badge">New!</span>
    </div>
    
    <div class="import-card" onclick="selectImport('manual')">
      <div class="icon">⌨️</div>
      <h3>Type or Paste</h3>
      <p>Manual entry with assistance</p>
    </div>
  </div>
  
  <div class="help-section">
    <p>🎥 <a href="#">Watch 2-minute tutorial</a></p>
    <p>📄 <a href="/templates">Download import templates</a></p>
    <p>💬 <a href="#">Get help from support</a></p>
  </div>
</div>
```

### Step 2: Upload & Process
```html
<div class="upload-section">
  <div class="dropzone" id="dropzone">
    <input type="file" id="fileInput" accept=".csv,.xlsx,.xls" hidden>
    <div class="dropzone-content">
      <div class="upload-icon">📁</div>
      <h3>Drag & Drop Your File Here</h3>
      <p>or <button onclick="document.getElementById('fileInput').click()">Browse Files</button></p>
      <p class="formats">Supports: Excel (.xlsx, .xls), CSV (.csv)</p>
    </div>
  </div>
  
  <div class="file-preview" id="filePreview" style="display:none;">
    <div class="file-info">
      <span class="file-icon">📊</span>
      <div>
        <p class="file-name">customers-2024.xlsx</p>
        <p class="file-size">245 KB • 523 rows</p>
      </div>
      <button class="remove-btn" onclick="removeFile()">✕</button>
    </div>
    
    <div class="analysis-result">
      <h4>File Analysis</h4>
      <ul class="analysis-list">
        <li>✓ Customer data detected</li>
        <li>✓ 523 records found</li>
        <li>✓ 12 columns identified</li>
        <li>✓ Email addresses: 89%</li>
        <li>✓ Phone numbers: 95%</li>
      </ul>
    </div>
    
    <button class="continue-btn" onclick="proceedToMapping()">
      Continue to Field Mapping →
    </button>
  </div>
</div>
```

## 🚀 Quick Start Implementation

### 1. Database Tables for Import Tracking
```sql
-- Import sessions table
CREATE TABLE import_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  import_type VARCHAR(50), -- excel, csv, quickbooks, manual, ocr
  file_name VARCHAR(255),
  total_records INTEGER,
  imported_records INTEGER,
  duplicate_records INTEGER,
  error_records INTEGER,
  status VARCHAR(50), -- pending, processing, completed, failed
  mapping_config JSONB,
  error_log JSONB,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  rollback_available BOOLEAN DEFAULT true,
  rollback_executed_at TIMESTAMP
);

-- Import record tracking
CREATE TABLE import_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES import_sessions(id),
  record_type VARCHAR(50), -- customer, lead, quote, job
  original_data JSONB,
  mapped_data JSONB,
  validation_errors JSONB,
  imported_id UUID, -- ID of created record
  status VARCHAR(50), -- pending, imported, skipped, error
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2. API Endpoints
```javascript
// POST /api/import/analyze
// Analyze uploaded file and detect fields

// POST /api/import/preview
// Preview import with field mapping

// POST /api/import/start
// Begin import process

// GET /api/import/progress/:sessionId
// Get real-time import progress

// POST /api/import/rollback/:sessionId
// Rollback an import session

// GET /api/import/templates
// Download import templates
```

## 📊 Import Success Metrics

### Target Performance
- **Analysis Time**: < 2 seconds for 1000 records
- **Import Speed**: 100 records/second
- **Success Rate**: > 95% of records imported
- **User Time**: < 5 minutes total

### Monitoring Dashboard
```
┌─────────────────────────────────────┐
│   Import Analytics (Last 30 Days)   │
├─────────────────────────────────────┤
│ Total Imports: 1,247                │
│ Success Rate: 97.3%                 │
│ Avg Records: 312                    │
│ Avg Time: 3m 42s                    │
│                                     │
│ By Source:                          │
│ • Excel/CSV: 782 (62.7%)           │
│ • QuickBooks: 298 (23.9%)          │
│ • Manual: 121 (9.7%)               │
│ • OCR: 46 (3.7%)                   │
└─────────────────────────────────────┘
```

## 🎯 Marketing the Import Feature

### During Signup
"Import your existing customers in under 5 minutes - we support Excel, QuickBooks, and more!"

### Email Campaign
"Still using spreadsheets? Import them in seconds and never look back!"

### In-App Promotion
"🎉 New! Import from QuickBooks with one click"

## ✅ Implementation Checklist

### Phase 1: Excel/CSV (Week 1)
- [ ] File upload UI
- [ ] CSV/Excel parser
- [ ] Field mapping interface
- [ ] Validation logic
- [ ] Import progress tracking
- [ ] Basic duplicate detection

### Phase 2: QuickBooks (Week 2)
- [ ] OAuth integration
- [ ] Customer sync
- [ ] Invoice/quote import
- [ ] Automated mapping
- [ ] Sync scheduling

### Phase 3: Advanced Features (Week 3)
- [ ] OCR for paper records
- [ ] Email contact import
- [ ] Bulk editing tools
- [ ] Rollback mechanism
- [ ] Import history

### Phase 4: Polish (Week 4)
- [ ] Video tutorials
- [ ] Template library
- [ ] Advanced deduplication
- [ ] Data enrichment
- [ ] Performance optimization

This import system removes the biggest barrier to adoption - the pain of manually re-entering existing data. With multiple import options and intelligent automation, even the least technical fence installer can migrate their business data in minutes.