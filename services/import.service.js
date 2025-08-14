const xlsx = require('xlsx');
const csv = require('csv-parse');
const { v4: uuidv4 } = require('uuid');
const PostgresDatabaseService = require('./postgres-database.service');

class ImportService {
  constructor() {
    this.db = new PostgresDatabaseService();
    this.batchSize = 100; // Process in batches for performance
  }

  // ==========================================
  // MAIN IMPORT FLOW
  // ==========================================

  async createImportSession(orgId, userId, fileInfo) {
    const sessionId = uuidv4();
    
    await this.db.run(
      `INSERT INTO import_sessions 
       (id, org_id, user_id, import_type, file_name, status, started_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())`,
      [sessionId, orgId, userId, fileInfo.type, fileInfo.name],
      orgId
    );

    return sessionId;
  }

  async analyzeFile(file, orgId) {
    try {
      // Parse file based on type
      const data = await this.parseFile(file);
      
      if (!data || data.length === 0) {
        throw new Error('No data found in file');
      }

      // Analyze structure
      const analysis = {
        totalRecords: data.length,
        columns: Object.keys(data[0]),
        detectedType: this.detectDataType(data[0]),
        fieldMapping: this.suggestFieldMapping(data[0]),
        sampleData: data.slice(0, 5),
        validation: await this.validateData(data.slice(0, 10), orgId)
      };

      return analysis;
    } catch (error) {
      console.error('File analysis error:', error);
      throw new Error(`Failed to analyze file: ${error.message}`);
    }
  }

  async parseFile(file) {
    const extension = file.originalname.split('.').pop().toLowerCase();
    
    if (extension === 'csv') {
      return this.parseCSV(file.buffer);
    } else if (['xlsx', 'xls'].includes(extension)) {
      return this.parseExcel(file.buffer);
    } else {
      throw new Error(`Unsupported file type: ${extension}`);
    }
  }

  async parseCSV(buffer) {
    return new Promise((resolve, reject) => {
      csv.parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: true,
        cast_date: true
      }, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });
  }

  async parseExcel(buffer) {
    const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with proper options
    const data = xlsx.utils.sheet_to_json(sheet, {
      defval: '',
      blankrows: false,
      dateNF: 'MM/DD/YYYY'
    });

    return data;
  }

  // ==========================================
  // FIELD MAPPING & DETECTION
  // ==========================================

  detectDataType(record) {
    const fields = Object.keys(record);
    const fieldPatterns = {
      customer: ['name', 'customer', 'client', 'email', 'phone'],
      lead: ['lead', 'prospect', 'opportunity', 'source'],
      quote: ['quote', 'estimate', 'price', 'total', 'amount'],
      job: ['job', 'project', 'work', 'service', 'installation']
    };

    let bestMatch = 'customer'; // default
    let bestScore = 0;

    for (const [type, patterns] of Object.entries(fieldPatterns)) {
      let score = 0;
      for (const field of fields) {
        const normalizedField = field.toLowerCase();
        for (const pattern of patterns) {
          if (normalizedField.includes(pattern)) {
            score++;
          }
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = type;
      }
    }

    return bestMatch;
  }

  suggestFieldMapping(record) {
    const mapping = {};
    const fieldMappings = {
      // Customer name variations
      customer_name: [
        'name', 'customer', 'client', 'customer name', 'client name',
        'full name', 'contact', 'account name', 'company'
      ],
      first_name: [
        'first', 'firstname', 'first name', 'fname', 'given name'
      ],
      last_name: [
        'last', 'lastname', 'last name', 'lname', 'surname', 'family name'
      ],
      email: [
        'email', 'e-mail', 'email address', 'contact email', 'emailaddress'
      ],
      phone: [
        'phone', 'telephone', 'tel', 'mobile', 'cell', 'phone number',
        'contact number', 'primary phone', 'cellphone'
      ],
      address: [
        'address', 'street', 'street address', 'location', 'service address',
        'property address', 'address1', 'address line 1'
      ],
      city: [
        'city', 'town', 'municipality'
      ],
      state: [
        'state', 'province', 'st', 'region'
      ],
      zip: [
        'zip', 'postal', 'postcode', 'zip code', 'postal code', 'zipcode'
      ],
      notes: [
        'notes', 'comments', 'description', 'memo', 'remarks'
      ],
      price: [
        'price', 'amount', 'total', 'cost', 'value', 'quote amount'
      ],
      date: [
        'date', 'created', 'service date', 'install date', 'scheduled'
      ]
    };

    // Map each field in the record
    for (const field of Object.keys(record)) {
      const normalizedField = field.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      for (const [targetField, variations] of Object.entries(fieldMappings)) {
        for (const variation of variations) {
          const normalizedVariation = variation.replace(/[^a-z0-9]/g, '');
          if (normalizedField === normalizedVariation || 
              normalizedField.includes(normalizedVariation) ||
              normalizedVariation.includes(normalizedField)) {
            mapping[field] = targetField;
            break;
          }
        }
        if (mapping[field]) break;
      }
      
      // If no mapping found, mark as unmapped
      if (!mapping[field]) {
        mapping[field] = null;
      }
    }

    return mapping;
  }

  // ==========================================
  // VALIDATION & DEDUPLICATION
  // ==========================================

  async validateData(records, orgId) {
    const validation = {
      totalRecords: records.length,
      validRecords: 0,
      warnings: [],
      errors: [],
      duplicates: []
    };

    for (const [index, record] of records.entries()) {
      const issues = [];
      
      // Check required fields
      if (!record.name && !record.customer && !record.email) {
        issues.push('Missing customer identifier (name or email)');
      }

      // Validate email format
      if (record.email && !this.isValidEmail(record.email)) {
        issues.push(`Invalid email format: ${record.email}`);
      }

      // Validate phone format
      if (record.phone && !this.isValidPhone(record.phone)) {
        issues.push(`Invalid phone format: ${record.phone}`);
      }

      // Check for duplicates
      const duplicate = await this.checkDuplicate(record, orgId);
      if (duplicate) {
        validation.duplicates.push({
          row: index + 1,
          record: record,
          existingId: duplicate.id,
          existingName: duplicate.name
        });
      }

      if (issues.length === 0) {
        validation.validRecords++;
      } else {
        validation.warnings.push({
          row: index + 1,
          issues: issues
        });
      }
    }

    validation.duplicateCount = validation.duplicates.length;
    validation.warningCount = validation.warnings.length;
    validation.isValid = validation.validRecords > 0;

    return validation;
  }

  async checkDuplicate(record, orgId) {
    // Try to find existing customer by email
    if (record.email) {
      const existing = await this.db.get(
        'SELECT id, first_name, last_name, email FROM customers WHERE org_id = $1 AND LOWER(email) = LOWER($2)',
        [orgId, record.email],
        orgId
      );
      if (existing) return existing;
    }

    // Try to find by phone (normalized)
    if (record.phone) {
      const normalizedPhone = this.normalizePhone(record.phone);
      if (normalizedPhone) {
        const existing = await this.db.get(
          `SELECT id, first_name, last_name, phone FROM customers 
           WHERE org_id = $1 AND REPLACE(REPLACE(REPLACE(phone, '-', ''), '(', ''), ')', '') LIKE $2`,
          [orgId, `%${normalizedPhone.slice(-10)}%`],
          orgId
        );
        if (existing) return existing;
      }
    }

    // Try to find by name (if both first and last name exist)
    if (record.first_name && record.last_name) {
      const existing = await this.db.get(
        `SELECT id, first_name, last_name FROM customers 
         WHERE org_id = $1 AND LOWER(first_name) = LOWER($2) AND LOWER(last_name) = LOWER($3)`,
        [orgId, record.first_name, record.last_name],
        orgId
      );
      if (existing) return existing;
    }

    return null;
  }

  // ==========================================
  // IMPORT EXECUTION
  // ==========================================

  async executeImport(sessionId, records, mapping, options = {}) {
    const session = await this.db.get(
      'SELECT * FROM import_sessions WHERE id = $1',
      [sessionId]
    );

    if (!session) {
      throw new Error('Import session not found');
    }

    // Update session status
    await this.db.run(
      'UPDATE import_sessions SET status = $1, total_records = $2, mapping_config = $3 WHERE id = $4',
      ['processing', records.length, JSON.stringify(mapping), sessionId],
      session.org_id
    );

    const results = {
      imported: [],
      skipped: [],
      errors: [],
      totalProcessed: 0
    };

    // Process in batches
    for (let i = 0; i < records.length; i += this.batchSize) {
      const batch = records.slice(i, i + this.batchSize);
      
      for (const record of batch) {
        try {
          // Map fields according to user's mapping
          const mappedData = this.applyFieldMapping(record, mapping);
          
          // Check for duplicate if not forcing import
          if (!options.ignoreDuplicates) {
            const duplicate = await this.checkDuplicate(mappedData, session.org_id);
            if (duplicate) {
              if (options.updateDuplicates) {
                // Update existing record
                await this.updateExistingRecord(duplicate.id, mappedData, session.org_id);
                results.imported.push({ ...mappedData, updated: true });
              } else {
                results.skipped.push({ ...mappedData, reason: 'duplicate' });
              }
              continue;
            }
          }

          // Import the record
          const imported = await this.importRecord(mappedData, session.org_id, session.import_type);
          results.imported.push(imported);

          // Track in import_records table
          await this.db.run(
            `INSERT INTO import_records 
             (session_id, record_type, original_data, mapped_data, imported_id, status)
             VALUES ($1, $2, $3, $4, $5, 'imported')`,
            [sessionId, session.import_type, JSON.stringify(record), 
             JSON.stringify(mappedData), imported.id],
            session.org_id
          );

        } catch (error) {
          results.errors.push({
            record: record,
            error: error.message
          });

          // Track error in import_records
          await this.db.run(
            `INSERT INTO import_records 
             (session_id, record_type, original_data, validation_errors, status)
             VALUES ($1, $2, $3, $4, 'error')`,
            [sessionId, session.import_type, JSON.stringify(record), 
             JSON.stringify({ error: error.message })],
            session.org_id
          );
        }

        results.totalProcessed++;

        // Update progress
        await this.updateProgress(sessionId, results);
      }
    }

    // Finalize session
    await this.db.run(
      `UPDATE import_sessions 
       SET status = 'completed', imported_records = $1, duplicate_records = $2, 
           error_records = $3, completed_at = NOW()
       WHERE id = $4`,
      [results.imported.length, results.skipped.length, results.errors.length, sessionId],
      session.org_id
    );

    return results;
  }

  applyFieldMapping(record, mapping) {
    const mapped = {};
    
    for (const [sourceField, targetField] of Object.entries(mapping)) {
      if (targetField && record[sourceField] !== undefined) {
        // Handle special field transformations
        if (targetField === 'phone') {
          mapped[targetField] = this.formatPhone(record[sourceField]);
        } else if (targetField === 'email') {
          mapped[targetField] = record[sourceField]?.toLowerCase().trim();
        } else if (targetField === 'state') {
          mapped[targetField] = this.normalizeState(record[sourceField]);
        } else if (targetField === 'customer_name' && !mapped.first_name) {
          // Split full name if needed
          const names = this.splitFullName(record[sourceField]);
          mapped.first_name = names.first;
          mapped.last_name = names.last;
        } else {
          mapped[targetField] = record[sourceField];
        }
      }
    }

    // Add metadata
    mapped.source = 'import';
    mapped.import_date = new Date();

    return mapped;
  }

  async importRecord(data, orgId, recordType) {
    if (recordType === 'customer') {
      return this.db.createCustomer(orgId, data);
    } else if (recordType === 'lead') {
      return this.importLead(data, orgId);
    } else if (recordType === 'quote') {
      return this.importQuote(data, orgId);
    } else {
      throw new Error(`Unknown record type: ${recordType}`);
    }
  }

  async importLead(data, orgId) {
    const result = await this.db.run(
      `INSERT INTO leads 
       (org_id, first_name, last_name, email, phone, source, status, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [orgId, data.first_name, data.last_name, data.email, data.phone,
       data.source || 'import', 'new', data.notes],
      orgId
    );
    return result.rows[0];
  }

  async importQuote(data, orgId) {
    return this.db.createQuote(orgId, {
      customer_name: `${data.first_name} ${data.last_name}`.trim(),
      customer_email: data.email,
      customer_phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      total_price: data.price || data.amount || 0,
      status: 'draft',
      notes: data.notes
    });
  }

  async updateExistingRecord(customerId, data, orgId) {
    // Only update non-empty fields
    const updates = {};
    for (const [key, value] of Object.entries(data)) {
      if (value && value !== '') {
        updates[key] = value;
      }
    }

    return this.db.updateCustomer(orgId, customerId, updates);
  }

  async updateProgress(sessionId, results) {
    await this.db.run(
      `UPDATE import_sessions 
       SET imported_records = $1, duplicate_records = $2, error_records = $3
       WHERE id = $4`,
      [results.imported.length, results.skipped.length, results.errors.length, sessionId]
    );
  }

  // ==========================================
  // ROLLBACK FUNCTIONALITY
  // ==========================================

  async rollbackImport(sessionId, orgId) {
    // Get all imported records
    const records = await this.db.all(
      'SELECT * FROM import_records WHERE session_id = $1 AND status = $2',
      [sessionId, 'imported'],
      orgId
    );

    let deletedCount = 0;
    
    for (const record of records) {
      if (record.imported_id) {
        // Delete the imported record
        if (record.record_type === 'customer') {
          await this.db.run(
            'DELETE FROM customers WHERE id = $1 AND org_id = $2',
            [record.imported_id, orgId],
            orgId
          );
          deletedCount++;
        }
        // Add other record types as needed
      }
    }

    // Update session status
    await this.db.run(
      'UPDATE import_sessions SET rollback_executed_at = NOW() WHERE id = $1',
      [sessionId],
      orgId
    );

    return { deletedCount };
  }

  // ==========================================
  // UTILITY FUNCTIONS
  // ==========================================

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  }

  formatPhone(phone) {
    if (!phone) return '';
    
    const cleaned = phone.toString().replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    
    return phone; // Return original if can't format
  }

  normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  }

  normalizeState(state) {
    if (!state) return '';
    
    const stateMap = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
      'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
      'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
      'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
      'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
      'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
      'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
      'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
      'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
      'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
      'wisconsin': 'WI', 'wyoming': 'WY'
    };

    const normalized = state.trim().toUpperCase();
    
    // If already 2-letter code
    if (normalized.length === 2) {
      return normalized;
    }
    
    // Try to find in map
    const fullName = state.toLowerCase().trim();
    return stateMap[fullName] || state;
  }

  splitFullName(fullName) {
    if (!fullName) return { first: '', last: '' };
    
    const parts = fullName.trim().split(/\s+/);
    
    if (parts.length === 1) {
      return { first: parts[0], last: '' };
    } else if (parts.length === 2) {
      return { first: parts[0], last: parts[1] };
    } else {
      // Handle middle names - assume last word is last name
      return {
        first: parts.slice(0, -1).join(' '),
        last: parts[parts.length - 1]
      };
    }
  }

  // ==========================================
  // TEMPLATE GENERATION
  // ==========================================

  generateImportTemplate(type = 'customer') {
    const templates = {
      customer: [
        ['First Name', 'Last Name', 'Email', 'Phone', 'Address', 'City', 'State', 'Zip', 'Notes'],
        ['John', 'Smith', 'john@example.com', '(555) 123-4567', '123 Main St', 'Dallas', 'TX', '75201', 'Prefers morning appointments'],
        ['Mary', 'Johnson', 'mary@example.com', '(555) 234-5678', '456 Oak Ave', 'Austin', 'TX', '78701', 'Has 2 dogs']
      ],
      lead: [
        ['First Name', 'Last Name', 'Email', 'Phone', 'Source', 'Estimated Value', 'Notes'],
        ['Bob', 'Wilson', 'bob@example.com', '(555) 345-6789', 'Website', '5000', 'Interested in premium fence'],
        ['Alice', 'Brown', 'alice@example.com', '(555) 456-7890', 'Referral', '3500', 'Needs quote by Friday']
      ],
      quote: [
        ['Customer Name', 'Email', 'Phone', 'Address', 'Fence Type', 'Linear Feet', 'Price', 'Status'],
        ['John Smith', 'john@example.com', '(555) 123-4567', '123 Main St', 'Wood Privacy', '150', '4500', 'Pending'],
        ['Mary Johnson', 'mary@example.com', '(555) 234-5678', '456 Oak Ave', 'Chain Link', '200', '3000', 'Accepted']
      ]
    };

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet(templates[type]);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Import Template');
    
    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}

module.exports = ImportService;