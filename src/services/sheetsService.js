const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { parseNumber, inferUnitType } = require('../utils/matcher');

// ──────────────────────────────────────────────────────────────
// Google Sheets Service with In-Memory Cache
// • Caches sheet data for 5 minutes to avoid quota issues
// • Falls back to mock inventory on any Sheets API error
// • Single batch read instead of per-sheet reads
// ──────────────────────────────────────────────────────────────

// Fallback Mock Inventory Data
const MOCK_INVENTORY = [
  {
    propertyName: "M3M Soulitude 89 Unit A",
    projectName: "M3M Soulitude",
    sector: "89",
    bhk: 3,
    rent: 28000,
    furnishing: "Semi Furnished",
    area: "1400 sqft",
    floor: "2nd",
    availability: "Available",
    ownerName: "Rakesh Sharma",
    ownerContact: "+91 98765 43210",
    propertyType: "Apartment",
    additionalNotes: "Park facing balcony, close to club house. Key with guard."
  },
  {
    propertyName: "Smart World Gems 89 Unit B",
    projectName: "Smart World Gems",
    sector: "89",
    bhk: 3,
    rent: 30000,
    furnishing: "Semi Furnished",
    area: "1420 sqft",
    floor: "3rd",
    availability: "Available",
    ownerName: "Sanjay Gupta",
    ownerContact: "+91 99999 11111",
    propertyType: "Apartment",
    additionalNotes: "Gated community, ready to move in, newly painted."
  },
  {
    propertyName: "SS Almeria Sector 84 Floor",
    projectName: "SS Almeria",
    sector: "84",
    bhk: 3,
    rent: 33000,
    furnishing: "Fully Furnished",
    area: "2000 sqft",
    floor: "1st",
    availability: "Available",
    ownerName: "Amit Kumar",
    ownerContact: "+91 98111 22233",
    propertyType: "Villa",
    additionalNotes: "Independent floor, premium quality wood work."
  },
  {
    propertyName: "Smart World One Rx 84 Unit C",
    projectName: "Smart World One Rx",
    sector: "84",
    bhk: 2,
    rent: 26000,
    furnishing: "Fully Furnished",
    area: "1150 sqft",
    floor: "5th",
    availability: "Available",
    ownerName: "Neha Sen",
    ownerContact: "+91 97777 88888",
    propertyType: "Apartment",
    additionalNotes: "Modern fittings, modular kitchen, pool facing."
  },
  {
    propertyName: "Vatika City Homes 83",
    projectName: "Vatika City Homes",
    sector: "83",
    bhk: 2,
    rent: 22000,
    furnishing: "Semi Furnished",
    area: "1100 sqft",
    floor: "Ground",
    availability: "Available",
    ownerName: "Vikram Singh",
    ownerContact: "+91 95555 44433",
    propertyType: "Apartment",
    additionalNotes: "Spacious backyard, family preferred."
  },
  {
    propertyName: "Signature Global Synera 81",
    projectName: "Signature Global Synera",
    sector: "81",
    bhk: 2,
    rent: 15000,
    furnishing: "Unfurnished",
    area: "750 sqft",
    floor: "4th",
    availability: "Available",
    ownerName: "Deepak Yadav",
    ownerContact: "+91 93333 22211",
    propertyType: "Apartment",
    additionalNotes: "Affordable flat, pocket-friendly maintenance."
  },
  {
    propertyName: "DLF The Primus 82",
    projectName: "DLF The Primus",
    sector: "82",
    bhk: 3,
    rent: 42000,
    furnishing: "Semi Furnished",
    area: "1800 sqft",
    floor: "10th",
    availability: "Available",
    ownerName: "Anil Kapoor",
    ownerContact: "+91 92222 33344",
    propertyType: "Apartment",
    additionalNotes: "Luxury community, high security, multi-tier car parking."
  },
  {
    propertyName: "Emaar Imperial Gardens 102",
    projectName: "Emaar Imperial Gardens",
    sector: "102",
    bhk: 3,
    rent: 38000,
    furnishing: "Fully Furnished",
    area: "1650 sqft",
    floor: "8th",
    availability: "Rented",
    ownerName: "Kunal Mehra",
    ownerContact: "+91 91111 22222",
    propertyType: "Apartment",
    additionalNotes: "Already rented out."
  },
  {
    propertyName: "M3M Woodshire 107",
    projectName: "M3M Woodshire",
    sector: "107",
    bhk: 2,
    rent: 24000,
    furnishing: "Semi Furnished",
    area: "1360 sqft",
    floor: "3rd",
    availability: "Available",
    ownerName: "Sonia Gandhi",
    ownerContact: "+91 90000 11111",
    propertyType: "Apartment",
    additionalNotes: "Large double-width balcony, peaceful view."
  }
];

const FIELD_ALIASES = {
  propertyName: ['property name', 'property', 'unit', 'flat', 'flat no', 'unit no', 'inventory', 'listing'],
  projectName: ['project name', 'project', 'society', 'society name', 'socity name', 'socity', 'building', 'builder', 'apartment name', 'tower'],
  sector: ['sector', 'sec', 'location', 'area', 'locality'],
  bhk: ['bhk', 'bedroom', 'bedrooms', 'configuration', 'type', 'size'],
  rent: ['rent', 'rental', 'monthly rent', 'asking rent', 'price', 'budget', 'demand'],
  furnishing: ['furnishing', 'furnished', 'furnish', 'furniture', 'furnishing status'],
  area: ['area', 'super area', 'built up area', 'carpet area', 'sqft', 'size sqft'],
  floor: ['floor', 'floor no', 'level'],
  availability: ['availability', 'status', 'available', 'vacant', 'possession'],
  ownerName: ['owner name', 'owner', 'landlord', 'landlord name', 'client name', 'name'],
  ownerContact: ['owner contact', 'contact', 'mobile', 'phone', 'number', 'whatsapp', 'owner mobile', 'owner phone'],
  propertyType: ['property type', 'type of property', 'category'],
  additionalNotes: ['notes', 'remarks', 'remark', 'comment', 'comments', 'details', 'description']
};

const FALLBACK_COLUMNS = {
  ownerName: 0,
  ownerContact: 1,
  furnishing: 2,
  bhk: 3,
  rent: 4,
  propertyName: 5,
  projectName: 6,
  sector: 7,
  additionalNotes: 8,
  availability: 9
};

function cleanHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeSheetName(sheetName) {
  return String(sheetName).replace(/'/g, "''");
}

function buildHeaderMap(headers = []) {
  const normalized = headers.map(cleanHeader);
  const map = {};
  const claimedIndexes = new Set();

  // Phase 1: Exact Matches
  Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
    const aliasSet = aliases.map(cleanHeader);
    const index = normalized.findIndex((header, idx) =>
      !claimedIndexes.has(idx) && aliasSet.includes(header)
    );
    if (index !== -1) {
      map[field] = index;
      claimedIndexes.add(index);
    }
  });

  // Phase 2: Partial Matches
  Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
    if (map[field] !== undefined) return; // already mapped in Phase 1

    const aliasSet = aliases.map(cleanHeader);
    const index = normalized.findIndex((header, idx) =>
      !claimedIndexes.has(idx) && aliasSet.some(alias => header.includes(alias) || alias.includes(header))
    );
    if (index !== -1) {
      map[field] = index;
      claimedIndexes.add(index);
    }
  });

  return map;
}

function valueFromRow(row, headerMap, field, hasHeader = true) {
  const index = hasHeader ? headerMap[field] : FALLBACK_COLUMNS[field];
  if (index === undefined || index === null) return '';
  return row[index] ?? '';
}

function looksLikeHeader(row = []) {
  const headerMap = buildHeaderMap(row);
  // Require at least 4 recognized field matches to be confident it's a header row.
  // Raising from 3 → 4 prevents data rows with common words from being mis-identified.
  return Object.keys(headerMap).length >= 4;
}

function inferSectorFromText(...parts) {
  const text = parts.filter(Boolean).join(' ');
  const match = text.match(/(?:sector|sec)\s*(\d+[a-z]?)/i) || text.match(/\b(\d{2,3}[a-z]?)\b/i);
  return match ? match[1] : '';
}

function normalizeListing(row, headerMap, sheetName, rowNumber, hasHeader = true) {
  const projectName = String(valueFromRow(row, headerMap, 'projectName', hasHeader) || '').trim();
  const propertyName = String(valueFromRow(row, headerMap, 'propertyName', hasHeader) || projectName || '').trim();
  const sector = String(valueFromRow(row, headerMap, 'sector', hasHeader) || inferSectorFromText(sheetName, projectName, propertyName)).trim();
  const bhkRaw = valueFromRow(row, headerMap, 'bhk', hasHeader);
  const rentRaw = valueFromRow(row, headerMap, 'rent', hasHeader);
  const rent = parseNumber(rentRaw) || 0;
  const bhk = parseNumber(bhkRaw) || 0;
  const unitType = inferUnitType(bhkRaw, propertyName, projectName);

  // Raw values (used by isUsefulListing – no defaults applied here)
  const furnishingRaw = String(valueFromRow(row, headerMap, 'furnishing', hasHeader) || '').trim();
  const availabilityRaw = String(valueFromRow(row, headerMap, 'availability', hasHeader) || '').trim();
  const additionalNotesRaw = String(valueFromRow(row, headerMap, 'additionalNotes', hasHeader) || '').trim();

  return {
    sheetName,
    sourceRow: rowNumber,
    propertyName,
    projectName: projectName || propertyName,
    sector,
    bhk,
    bhkLabel: String(bhkRaw || '').trim(),
    unitType,
    rent,
    furnishing: furnishingRaw || 'Semi Furnished',   // default for display
    furnishingRaw,                                   // raw for filtering
    area: String(valueFromRow(row, headerMap, 'area', hasHeader) || '').trim(),
    floor: String(valueFromRow(row, headerMap, 'floor', hasHeader) || '').trim(),
    availability: availabilityRaw || 'Available',    // default for display
    availabilityRaw,                                 // raw for filtering
    ownerName: String(valueFromRow(row, headerMap, 'ownerName', hasHeader) || '').trim(),
    ownerContact: String(valueFromRow(row, headerMap, 'ownerContact', hasHeader) || '').trim(),
    propertyType: String(valueFromRow(row, headerMap, 'propertyType', hasHeader) || 'Apartment').trim(),
    additionalNotes: additionalNotesRaw,
  };
}

function isUsefulListing(listing) {
  // A row is useful if it has any identifying info (name, contact, project, unit)
  // AND at least ONE raw property detail (not a defaulted value).
  const hasIdentity = Boolean(
    listing.projectName || listing.propertyName ||
    listing.ownerName   || listing.ownerContact
  );
  // Check RAW values only – not defaults – to avoid counting blank rows
  const hasDetail = Boolean(
    listing.rent       ||  // parsed number from sheet
    listing.bhk        ||  // parsed number from sheet
    listing.sector     ||  // text from sheet or inferred
    listing.additionalNotes ||  // raw remarks text
    listing.furnishingRaw       // raw furnishing text
  );
  return hasIdentity && hasDetail;
}

class SheetsService {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    this.mockMode = process.env.MOCK_MODE === 'true';
    this.lastError = null;

    // ─── In-memory cache ─────────────────────────────────
    this.cachedListings = null;
    this.cacheTimestamp = 0;
    this.CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    this.initAuth();
  }

  initAuth() {
    try {
      this.lastError = null;
      if (this.mockMode) {
        console.log('📋 SheetsService is running in MOCK_MODE.');
        return;
      }

      let credentials = null;

      if (process.env.GOOGLE_CREDENTIALS_JSON) {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      } else if (process.env.GOOGLE_CREDENTIALS_PATH) {
        const filePath = path.resolve(process.env.GOOGLE_CREDENTIALS_PATH);
        if (fs.existsSync(filePath)) {
          credentials = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
      } else {
        const defaultPath = path.resolve(__dirname, '../../credentials.json');
        if (fs.existsSync(defaultPath)) {
          credentials = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
        }
      }

      if (!credentials || !this.spreadsheetId) {
        const missing = [];
        if (!credentials) missing.push('Credentials JSON');
        if (!this.spreadsheetId) missing.push('Spreadsheet ID');
        this.lastError = `Missing configuration: ${missing.join(', ')}`;
        console.warn(`⚠️  Google Sheets credentials or Spreadsheet ID missing. (${this.lastError})`);
        this.mockMode = false;
        return;
      }

      const auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/spreadsheets']
      );

      this.sheets = google.sheets({ version: 'v4', auth });
      console.log('✅ Google Sheets API authenticated.');
      console.log(`📋 Owner Sheet ID: ${this.spreadsheetId}`);
    } catch (error) {
      console.error('❌ Failed to initialize Google Sheets:', error.message);
      this.lastError = error.message;
      this.mockMode = false;
    }
  }

  updateCredentials(spreadsheetId, credentialsJson, mockModeVal) {
    this.spreadsheetId = spreadsheetId || this.spreadsheetId;
    this.mockMode = mockModeVal !== undefined ? mockModeVal : this.mockMode;
    this.cachedListings = null; // invalidate cache on credential change

    if (credentialsJson) {
      process.env.GOOGLE_CREDENTIALS_JSON = credentialsJson;
    }

    this.initAuth();
  }

  /**
   * Returns true if cached data is still fresh
   */
  isCacheValid() {
    return this.cachedListings !== null && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL_MS;
  }

  /**
   * Invalidate the cache (e.g. after adding a listing)
   */
  invalidateCache() {
    this.cachedListings = null;
    this.cacheTimestamp = 0;
  }

  async getListings() {
    if (!this.sheets) {
      throw new Error('Google Sheets API is not connected. Please check your credentials.');
    }

    // 2. Return cached data if available
    if (this.isCacheValid()) {
      console.log(`📦 Returning cached inventory (${this.cachedListings.length} records, cached ${Math.round((Date.now() - this.cacheTimestamp) / 1000)}s ago)`);
      return this.cachedListings;
    }

    // 3. Fetch from Google Sheets
    try {
      const metadata = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      // Skip reserved tabs that are not property inventory (Clients, Settings, etc.)
      const SKIP_TABS = ['clients', 'settings', 'config'];
      const sheetNames = (metadata.data.sheets || [])
        .map(s => s.properties.title)
        .filter(name => !SKIP_TABS.includes(name.toLowerCase()));

      console.log(`\n📊 Sheets Found: ${sheetNames.length} → [${sheetNames.join(', ')}]`);

      if (sheetNames.length === 0) {
        throw new Error('No valid sheets found in the connected Google Spreadsheet.');
      }

      // Use batchGet to read ALL sheets in a single API call
      const ranges = sheetNames.map(name => `'${escapeSheetName(name)}'!A1:Z2000`);

      let batchResponse;
      try {
        batchResponse = await this.sheets.spreadsheets.values.batchGet({
          spreadsheetId: this.spreadsheetId,
          ranges,
        });
      } catch (batchErr) {
        // If batchGet fails, fall back to individual reads
        console.warn(`⚠️  Batch read failed: ${batchErr.message}. Trying individual sheets...`);
        return await this.getListingsIndividually(sheetNames);
      }

      const valueRanges = batchResponse.data.valueRanges || [];
      const allListings = [];

      valueRanges.forEach((vr, idx) => {
        const sheetName = sheetNames[idx];
        try {
          const rows = (vr.values || []).filter(row =>
            row && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')
          );

          if (rows.length === 0) return;

          const hasHeader = looksLikeHeader(rows[0]);
          const headerMap = hasHeader ? buildHeaderMap(rows[0]) : {};
          const dataRows = hasHeader ? rows.slice(1) : rows;
          const rowOffset = hasHeader ? 2 : 1;

          const listings = dataRows
            .map((row, index) => normalizeListing(row, headerMap, sheetName, index + rowOffset, hasHeader))
            .filter(isUsefulListing);

          const droppedCount = dataRows.length - listings.length;
          if (droppedCount > 0) {
            console.warn(`  ⚠️  "${sheetName}" → ${droppedCount} row(s) skipped (empty/unusable data). Total kept: ${listings.length}`);
          }
          console.log(`  ✓ "${sheetName}" → ${listings.length} records (from ${dataRows.length} data rows, header detected: ${hasHeader})`);
          allListings.push(...listings);
        } catch (parseErr) {
          console.warn(`  ✗ "${sheetName}" parse error: ${parseErr.message}`);
        }
      });

      console.log(`\n📊 Total Records: ${allListings.length}\n`);

      if (allListings.length === 0) {
        console.warn('⚠️  All sheets empty.');
        return [];
      }

      // Cache the results
      this.cachedListings = allListings;
      this.cacheTimestamp = Date.now();

      return allListings;
    } catch (error) {
      console.error(`❌ Sheets API error: ${error.message}`);

      // If we have stale cache, use it
      if (this.cachedListings && this.cachedListings.length > 0) {
        console.log('📦 Using stale cache as fallback...');
        return this.cachedListings;
      }

      throw new Error(`Google Sheets error: ${error.message}`);
    }
  }

  /**
   * Fallback: read sheets one by one (in case batchGet is not supported)
   */
  async getListingsIndividually(sheetNames) {
    const allListings = [];
    let failCount = 0;

    for (const sheetName of sheetNames) {
      try {
        const range = `'${escapeSheetName(sheetName)}'!A1:Z2000`;
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range,
        });

        const rows = (response.data.values || []).filter(row =>
          row && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')
        );

        if (rows.length === 0) continue;

        const hasHeader = looksLikeHeader(rows[0]);
        const headerMap = hasHeader ? buildHeaderMap(rows[0]) : {};
        const dataRows = hasHeader ? rows.slice(1) : rows;
        const rowOffset = hasHeader ? 2 : 1;

        const listings = dataRows
          .map((row, index) => normalizeListing(row, headerMap, sheetName, index + rowOffset, hasHeader))
          .filter(isUsefulListing);

        console.log(`  ✓ "${sheetName}" → ${listings.length} records`);
        allListings.push(...listings);
      } catch (sheetError) {
        failCount++;
        if (failCount >= 3) {
          console.warn(`  ✗ Multiple sheet read failures. Stopping individual reads.`);
          break;
        }
        console.warn(`  ✗ "${sheetName}": ${sheetError.message?.substring(0, 80)}`);
      }
    }

    if (allListings.length === 0) {
      if (this.cachedListings && this.cachedListings.length > 0) {
        console.log('📦 Using stale cache...');
        return this.cachedListings;
      }
      return [];
    }

    // Cache the results
    this.cachedListings = allListings;
    this.cacheTimestamp = Date.now();
    return allListings;
  }

  async addListing(listing) {
    if (!this.sheets) {
      throw new Error('Google Sheets API is not connected. Cannot add listing.');
    }

    try {
      const metadata = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const firstSheetTitle = metadata.data.sheets[0].properties.title;

      // Fetch headers dynamically to figure out which column is which
      let headerRow = [];
      try {
        const headerResponse = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `'${escapeSheetName(firstSheetTitle)}'!A1:Z1`
        });
        headerRow = headerResponse.data.values ? headerResponse.data.values[0] : [];
      } catch (headerErr) {
        console.warn(`Failed to fetch headers: ${headerErr.message}. Falling back to default order.`);
      }

      if (headerRow.length === 0) {
        // If sheet is completely empty, write headers first, then write the listing
        const defaultHeaders = [
          'Name', 'Phone', 'Furnishing Status', 'BHK', 'Rent', 'Unit', 'Socity Name', 'Sector', 'Remarks', 'Status'
        ];
        const defaultRow = [
          listing.ownerName || '',
          listing.ownerContact || '',
          listing.furnishing || '',
          listing.bhk || '',
          listing.rent || '',
          listing.propertyName || '',
          listing.projectName || '',
          listing.sector || '',
          listing.additionalNotes || '',
          listing.availability || 'Available'
        ];

        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `'${escapeSheetName(firstSheetTitle)}'!A1`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [defaultHeaders, defaultRow] },
        });
      } else {
        // Map fields to correct columns based on actual headers
        const headerMap = buildHeaderMap(headerRow);
        const newRow = new Array(Math.max(headerRow.length, 10)).fill('');

        const fieldMappings = {
          ownerName: listing.ownerName || '',
          ownerContact: listing.ownerContact || '',
          furnishing: listing.furnishing || '',
          bhk: listing.bhk || '',
          rent: listing.rent || '',
          propertyName: listing.propertyName || '',
          projectName: listing.projectName || '',
          sector: listing.sector || '',
          additionalNotes: listing.additionalNotes || '',
          availability: listing.availability || 'Available'
        };

        Object.entries(fieldMappings).forEach(([field, val]) => {
          const idx = headerMap[field];
          if (idx !== undefined && idx !== null) {
            newRow[idx] = val;
          } else {
            const fallbackIdx = FALLBACK_COLUMNS[field];
            if (fallbackIdx !== undefined && fallbackIdx < newRow.length) {
              newRow[fallbackIdx] = val;
            }
          }
        });

        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `'${escapeSheetName(firstSheetTitle)}'!A:A`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [newRow] },
        });
      }

      // Invalidate cache so next getListings fetches fresh data
      this.invalidateCache();

      return listing;
    } catch (error) {
      console.error('Error writing to Google Sheets:', error.message);
      throw new Error(`Google Sheets append failed: ${error.message}`);
    }
  }

  /**
   * Update an existing property row by its sheet row number (1-indexed)
   */
  async updateListing(rowIndex, listing) {
    if (!this.sheets) {
      throw new Error('Google Sheets API is not connected. Cannot update listing.');
    }

    try {
      const metadata = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const firstSheetTitle = metadata.data.sheets[0].properties.title;

      // Read current headers
      const headerResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${escapeSheetName(firstSheetTitle)}'!A1:Z1`
      });
      const headerRow = headerResponse.data.values ? headerResponse.data.values[0] : [];
      const headerMap = buildHeaderMap(headerRow);

      // Build the updated row array
      const updatedRow = new Array(Math.max(headerRow.length, 10)).fill('');
      const fieldMappings = {
        ownerName: listing.ownerName || '',
        ownerContact: listing.ownerContact || '',
        furnishing: listing.furnishing || '',
        bhk: listing.bhk || '',
        rent: listing.rent || '',
        propertyName: listing.propertyName || '',
        projectName: listing.projectName || '',
        sector: listing.sector || '',
        additionalNotes: listing.additionalNotes || '',
        availability: listing.availability || 'Available'
      };

      Object.entries(fieldMappings).forEach(([field, val]) => {
        const idx = headerMap[field] !== undefined ? headerMap[field] : FALLBACK_COLUMNS[field];
        if (idx !== undefined && idx < updatedRow.length) updatedRow[idx] = val;
      });

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `'${escapeSheetName(firstSheetTitle)}'!A${rowIndex}:Z${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [updatedRow] },
      });

      this.invalidateCache();
      return listing;
    } catch (error) {
      console.error('Error updating listing row:', error.message);
      throw new Error(`Google Sheets update failed: ${error.message}`);
    }
  }

  /**
   * Delete a property row by its sheet row number (1-indexed)
   */
  async deleteListing(rowIndex) {
    if (!this.sheets) {
      throw new Error('Google Sheets API is not connected. Cannot delete listing.');
    }

    try {
      const metadata = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const sheetId = metadata.data.sheets[0].properties.sheetId;

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // 0-indexed
                endIndex: rowIndex         // exclusive
              }
            }
          }]
        }
      });

      this.invalidateCache();
      return true;
    } catch (error) {
      console.error('Error deleting listing row:', error.message);
      throw new Error(`Google Sheets delete failed: ${error.message}`);
    }
  }
}

// tfsa

module.exports = new SheetsService();
