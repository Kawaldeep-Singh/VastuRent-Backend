const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// ClientsService — reads a dedicated Client Requirements spreadsheet
// The sheet columns (actual user sheet):
//   A: Name | B: Phone No | C: Date | D: Furnished | E: BHK | F: Budget
//   G: Shifting Date | H: Area / Sector | I: Remarks | J: Status
// ─────────────────────────────────────────────────────────────────────────────

// ── Header aliases — maps our field names to various header spellings ─────────
const CLIENT_FIELD_ALIASES = {
  name:         ['name', 'client name', 'client', 'tenant name', 'tenant'],
  phone:        ['phone', 'phone no', 'mobile', 'contact', 'number', 'whatsapp', 'mob'],
  date:         ['date', 'enquiry date', 'entry date', 'added on'],
  furnishing:   ['furnished', 'furnishing', 'furnish', 'furnishing status', 'fully', 'semi'],
  bhk:          ['bhk', 'bedroom', 'bedrooms', 'type', 'configuration', 'bhk required', 'bhk need'],
  budget:       ['budget', 'rent', 'max budget', 'rent range', 'budget range', 'price range'],
  shiftingDate: ['shifting date', 'shift date', 'move date', 'moving date', 'possession'],
  sector:       ['area', 'sector', 'area / sector', 'area/sector', 'location', 'locality', 'preferred area'],
  remarks:      ['remarks', 'remark', 'notes', 'note', 'comment', 'details'],
  status:       ['status', 'lead status', 'lead', 'stage'],
};

// Fallback column positions if headers can't be detected
const CLIENT_FALLBACK_COLS = {
  name: 0, phone: 1, date: 2, furnishing: 3, bhk: 4,
  budget: 5, shiftingDate: 6, sector: 7, remarks: 8, status: 9
};

function cleanHeader(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function buildClientHeaderMap(headers = []) {
  const normalized = headers.map(cleanHeader);
  const map = {};
  const claimed = new Set();

  // Phase 1: exact match
  Object.entries(CLIENT_FIELD_ALIASES).forEach(([field, aliases]) => {
    const idx = normalized.findIndex((h, i) => !claimed.has(i) && aliases.map(cleanHeader).includes(h));
    if (idx !== -1) { map[field] = idx; claimed.add(idx); }
  });

  // Phase 2: partial match
  Object.entries(CLIENT_FIELD_ALIASES).forEach(([field, aliases]) => {
    if (map[field] !== undefined) return;
    const aliasSet = aliases.map(cleanHeader);
    const idx = normalized.findIndex((h, i) =>
      !claimed.has(i) && aliasSet.some(a => h.includes(a) || a.includes(h))
    );
    if (idx !== -1) { map[field] = idx; claimed.add(idx); }
  });

  return map;
}

function getVal(row, headerMap, field, hasDynamic) {
  const idx = hasDynamic ? headerMap[field] : CLIENT_FALLBACK_COLS[field];
  if (idx === undefined || idx === null) return '';
  return String(row[idx] || '').trim();
}

// Parse budget "20-22" → max value in rupees (22000)
function parseBudgetMax(raw) {
  const s = String(raw || '').replace(/[^\d\-\.]/g, '');
  if (!s) return 0;
  const parts = s.split('-').map(p => parseFloat(p)).filter(n => !isNaN(n));
  if (!parts.length) return 0;
  const max = Math.max(...parts);
  // If value looks like thousands (< 200), multiply by 1000
  return max < 200 ? max * 1000 : max;
}

function parseBudgetMin(raw) {
  const s = String(raw || '').replace(/[^\d\-\.]/g, '');
  if (!s) return 0;
  const parts = s.split('-').map(p => parseFloat(p)).filter(n => !isNaN(n));
  if (!parts.length) return 0;
  const min = Math.min(...parts);
  return min < 200 ? min * 1000 : min;
}

// Normalize furnishing: "Fully" → "Fully Furnished", "Semi" → "Semi Furnished" etc.
function normalizeFurnishing(raw) {
  const r = String(raw || '').toLowerCase().trim();
  if (!r || r === '-') return '';
  if (r.includes('fully') && r.includes('semi')) return 'Fully Furnished';
  if (r.includes('full')) return 'Fully Furnished';
  if (r.includes('semi')) return 'Semi Furnished';
  if (r.includes('raw') || r.includes('unfurnish')) return 'Unfurnished';
  return raw;
}

function rowToClient(row, rowNumber, headerMap, hasDynamic) {
  const rawBudget    = getVal(row, headerMap, 'budget', hasDynamic);
  const rawFurnished = getVal(row, headerMap, 'furnishing', hasDynamic);
  const rawBhk       = getVal(row, headerMap, 'bhk', hasDynamic);

  return {
    sourceRow:    rowNumber,
    name:         getVal(row, headerMap, 'name',         hasDynamic),
    phone:        getVal(row, headerMap, 'phone',        hasDynamic),
    date:         getVal(row, headerMap, 'date',         hasDynamic),
    furnishing:   normalizeFurnishing(rawFurnished),
    furnishingRaw: rawFurnished,
    bhk:          rawBhk,
    budgetRaw:    rawBudget,
    budgetMin:    parseBudgetMin(rawBudget),
    budgetMax:    parseBudgetMax(rawBudget),
    shiftingDate: getVal(row, headerMap, 'shiftingDate', hasDynamic),
    sector:       getVal(row, headerMap, 'sector',       hasDynamic),
    remarks:      getVal(row, headerMap, 'remarks',      hasDynamic),
    status:       getVal(row, headerMap, 'status',       hasDynamic) || 'Active',
  };
}

function isUsefulClient(c) {
  return Boolean(c.name || c.phone || c.bhk || c.budgetRaw);
}

// ─────────────────────────────────────────────────────────────────────────────

class ClientsService {
  constructor() {
    this.sheets        = null;
    this.spreadsheetId = process.env.GOOGLE_CLIENT_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
    this.mockMode      = process.env.MOCK_MODE === 'true';
    this.cachedClients  = null;
    this.cacheTimestamp = 0;
    this.CACHE_TTL_MS   = 5 * 60 * 1000;
    this.mockClients    = [];
    this.initAuth();
  }

  initAuth() {
    try {
      if (this.mockMode) {
        console.log('📋 ClientsService: MOCK_MODE');
        return;
      }

      let credentials = null;
      if (process.env.GOOGLE_CREDENTIALS_JSON) {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      } else {
        const paths = [
          process.env.GOOGLE_CREDENTIALS_PATH && path.resolve(process.env.GOOGLE_CREDENTIALS_PATH),
          path.resolve(__dirname, '../../credentials.json')
        ].filter(Boolean);
        for (const fp of paths) {
          if (fp && fs.existsSync(fp)) { credentials = JSON.parse(fs.readFileSync(fp, 'utf8')); break; }
        }
      }

      if (!credentials || !this.spreadsheetId) {
        console.warn('⚠️  ClientsService: missing credentials or sheet ID → MOCK_MODE');
        this.mockMode = true;
        return;
      }

      const auth = new google.auth.JWT(
        credentials.client_email, null, credentials.private_key,
        ['https://www.googleapis.com/auth/spreadsheets']
      );
      this.sheets = google.sheets({ version: 'v4', auth });

      const isShared = this.spreadsheetId === process.env.GOOGLE_SPREADSHEET_ID;
      console.log('✅ ClientsService authenticated.');
      console.log(`📋 Client Sheet ID : ${this.spreadsheetId} ${isShared
        ? '⚠️  (same as Owner sheet — set GOOGLE_CLIENT_SPREADSHEET_ID for separate sheet)'
        : '✅ (separate client spreadsheet)'}`);
    } catch (e) {
      console.error('❌ ClientsService auth failed:', e.message);
      this.mockMode = true;
    }
  }

  updateCredentials(spreadsheetId, credentialsJson, mockModeVal) {
    this.spreadsheetId = process.env.GOOGLE_CLIENT_SPREADSHEET_ID || spreadsheetId || this.spreadsheetId;
    this.mockMode = mockModeVal !== undefined ? mockModeVal : this.mockMode;
    this.invalidateCache();
    if (credentialsJson) process.env.GOOGLE_CREDENTIALS_JSON = credentialsJson;
    this.initAuth();
  }

  isCacheValid() {
    return this.cachedClients !== null && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL_MS;
  }

  invalidateCache() { this.cachedClients = null; this.cacheTimestamp = 0; }

  // ── GET all clients — reads FIRST sheet of client spreadsheet ────────────
  async getClients() {
    if (this.mockMode || !this.sheets) return this.mockClients;
    if (this.isCacheValid()) return this.cachedClients;

    try {
      // Get first sheet name
      const meta = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const firstSheet = meta.data.sheets[0].properties.title;
      console.log(`\n📋 Reading client sheet: "${firstSheet}"`);

      const resp = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${firstSheet}'!A1:K2000`,
      });

      const allRows = (resp.data.values || []).filter(r => r && r.some(c => String(c).trim() !== ''));
      if (allRows.length === 0) {
        this.cachedClients = [];
        this.cacheTimestamp = Date.now();
        return [];
      }

      // Detect header row
      const firstRow = allRows[0];
      const headerMap = buildClientHeaderMap(firstRow);
      const hasDynamic = Object.keys(headerMap).length >= 3;
      const dataRows = hasDynamic ? allRows.slice(1) : allRows;
      const rowOffset = hasDynamic ? 2 : 1;

      console.log(`  Header detected: ${hasDynamic} → mapped fields: [${Object.keys(headerMap).join(', ')}]`);

      const clients = dataRows
        .map((row, i) => rowToClient(row, i + rowOffset, headerMap, hasDynamic))
        .filter(isUsefulClient);

      console.log(`  ✓ ${clients.length} clients loaded (from ${dataRows.length} rows)`);

      this.cachedClients  = clients;
      this.cacheTimestamp = Date.now();
      return clients;
    } catch (e) {
      console.error('❌ getClients error:', e.message);
      return this.cachedClients || [];
    }
  }

  // ── ADD client ────────────────────────────────────────────────────────────
  async addClient(client) {
    if (this.mockMode || !this.sheets) {
      const mock = { ...client, sourceRow: this.mockClients.length + 2 };
      this.mockClients.push(mock);
      this.invalidateCache();
      return mock;
    }

    try {
      const meta = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const firstSheet = meta.data.sheets[0].properties.title;

      // Read current headers to write in correct column order
      const headerResp = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${firstSheet}'!A1:K1`,
      });
      const headerRow = (headerResp.data.values || [[]])[0] || [];
      const headerMap = buildClientHeaderMap(headerRow);
      const hasDynamic = Object.keys(headerMap).length >= 3;

      const row = this._clientToRow(client, headerMap, hasDynamic, headerRow.length);

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `'${firstSheet}'!A:A`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [row] },
      });
      this.invalidateCache();
      return client;
    } catch (e) {
      console.error('❌ addClient error:', e.message);
      throw new Error(`Add client failed: ${e.message}`);
    }
  }

  // ── UPDATE client by sheet row index ─────────────────────────────────────
  async updateClient(rowIndex, client) {
    if (this.mockMode || !this.sheets) {
      const idx = this.mockClients.findIndex(c => c.sourceRow === rowIndex);
      if (idx !== -1) Object.assign(this.mockClients[idx], client);
      this.invalidateCache();
      return client;
    }

    try {
      const meta = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const firstSheet = meta.data.sheets[0].properties.title;

      const headerResp = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${firstSheet}'!A1:K1`,
      });
      const headerRow = (headerResp.data.values || [[]])[0] || [];
      const headerMap = buildClientHeaderMap(headerRow);
      const hasDynamic = Object.keys(headerMap).length >= 3;

      const row = this._clientToRow(client, headerMap, hasDynamic, headerRow.length);

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `'${firstSheet}'!A${rowIndex}:K${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [row] },
      });
      this.invalidateCache();
      return client;
    } catch (e) {
      console.error('❌ updateClient error:', e.message);
      throw new Error(`Update client failed: ${e.message}`);
    }
  }

  // ── DELETE client by sheet row index ─────────────────────────────────────
  async deleteClient(rowIndex) {
    if (this.mockMode || !this.sheets) {
      const idx = this.mockClients.findIndex(c => c.sourceRow === rowIndex);
      if (idx !== -1) this.mockClients.splice(idx, 1);
      this.invalidateCache();
      return true;
    }

    try {
      const meta = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const sheetId = meta.data.sheets[0].properties.sheetId;

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: [{
            deleteDimension: {
              range: { sheetId, dimension: 'ROWS', startIndex: rowIndex - 1, endIndex: rowIndex }
            }
          }]
        }
      });
      this.invalidateCache();
      return true;
    } catch (e) {
      console.error('❌ deleteClient error:', e.message);
      throw new Error(`Delete client failed: ${e.message}`);
    }
  }

  // ── Helper: build a row array matching the sheet's column order ───────────
  _clientToRow(client, headerMap, hasDynamic, colCount) {
    const size = Math.max(colCount || 10, 10);
    const row = new Array(size).fill('');

    const fields = {
      name:         client.name         || '',
      phone:        client.phone        || '',
      date:         client.date         || '',
      furnishing:   client.furnishingRaw || client.furnishing || '',
      bhk:          client.bhk          || '',
      budget:       client.budgetRaw    || client.budget      || '',
      shiftingDate: client.shiftingDate || '',
      sector:       client.sector       || '',
      remarks:      client.remarks      || '',
      status:       client.status       || 'Active',
    };

    if (hasDynamic) {
      Object.entries(fields).forEach(([field, val]) => {
        const idx = headerMap[field] !== undefined ? headerMap[field] : CLIENT_FALLBACK_COLS[field];
        if (idx !== undefined && idx < row.length) row[idx] = val;
      });
    } else {
      Object.entries(CLIENT_FALLBACK_COLS).forEach(([field, idx]) => {
        if (fields[field] !== undefined && idx < row.length) row[idx] = fields[field];
      });
    }

    return row;
  }
}

module.exports = new ClientsService();
