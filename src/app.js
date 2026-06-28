const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5000'];
if (process.env.FRONTEND_URL) {
  const urls = process.env.FRONTEND_URL.split(',').map(url => url.trim());
  allowedOrigins.push(...urls);
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Import middlewares & services
const authMiddleware = require('./middleware/authMiddleware');
const authController = require('./controllers/authController');
const inventoryController = require('./controllers/inventoryController');
const matchingController = require('./controllers/matchingController');
const clientsController = require('./controllers/clientsController');
const sheetsService = require('./services/sheetsService');
const clientsService = require('./services/clientsService');
const geminiService = require('./services/geminiService');

// Initialize Broker details in process.env
process.env.BROKER_NAME = process.env.BROKER_NAME || 'Kawal';
process.env.AGENCY_NAME = process.env.AGENCY_NAME || 'Vastu Rentals';

// --- API ROUTES ---

// 1. Authentication
app.post('/api/auth/login', authController.login);
app.get('/api/auth/me', authMiddleware, authController.verifySession);

// 2. Inventory Management (Properties / Owner Sheet)
app.get('/api/inventory',                  authMiddleware, inventoryController.getListings);
app.post('/api/inventory',                 authMiddleware, inventoryController.addListing);
app.put('/api/inventory/:rowIndex',        authMiddleware, inventoryController.updateListing);
app.delete('/api/inventory/:rowIndex',     authMiddleware, inventoryController.deleteListing);

// Force-refresh cache
app.post('/api/inventory/refresh', authMiddleware, async (req, res) => {
  try {
    sheetsService.invalidateCache();
    const listings = await sheetsService.getListings();
    return res.json({ success: true, message: `Cache refreshed. Fetched ${listings.length} records from Google Sheets.`, count: listings.length });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Clients Management (Tenant Requirements Sheet)
app.get('/api/clients',                        authMiddleware, clientsController.getClients);
app.post('/api/clients',                       authMiddleware, clientsController.addClient);
app.put('/api/clients/:rowIndex',              authMiddleware, clientsController.updateClient);
app.delete('/api/clients/:rowIndex',           authMiddleware, clientsController.deleteClient);
app.post('/api/clients/match-all',             authMiddleware, clientsController.matchAllClients);
app.post('/api/clients/match/:rowIndex',       authMiddleware, clientsController.matchSingleClient);

// 4. Matching Pipeline
app.post('/api/match', authMiddleware, matchingController.matchRequirement);
app.post('/api/match/follow-up', authMiddleware, matchingController.generateFollowUp);

// 5. Broker / App Settings
app.get('/api/settings', authMiddleware, (req, res) => {
  return res.json({
    success: true,
    settings: {
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
      credentialsJson: process.env.GOOGLE_CREDENTIALS_JSON || '',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      mockMode: sheetsService.mockMode,
      brokerName: process.env.BROKER_NAME || 'Kawal',
      agencyName: process.env.AGENCY_NAME || 'Vastu Rentals'
    }
  });
});

app.post('/api/settings', authMiddleware, (req, res) => {
  try {
    const { spreadsheetId, credentialsJson, geminiApiKey, mockMode, brokerName, agencyName } = req.body;

    // Update in-process variables
    if (spreadsheetId !== undefined) process.env.GOOGLE_SPREADSHEET_ID = spreadsheetId;
    if (geminiApiKey !== undefined) {
      process.env.GEMINI_API_KEY = geminiApiKey;
      geminiService.updateApiKey(geminiApiKey);
    }
    if (credentialsJson !== undefined) process.env.GOOGLE_CREDENTIALS_JSON = credentialsJson;
    if (mockMode !== undefined) process.env.MOCK_MODE = String(mockMode);
    if (brokerName !== undefined) process.env.BROKER_NAME = brokerName;
    if (agencyName !== undefined) process.env.AGENCY_NAME = agencyName;

    // Refresh Google Sheets service configuration
    sheetsService.updateCredentials(
      process.env.GOOGLE_SPREADSHEET_ID,
      process.env.GOOGLE_CREDENTIALS_JSON,
      process.env.MOCK_MODE === 'true'
    );
    clientsService.updateCredentials(
      process.env.GOOGLE_SPREADSHEET_ID,
      process.env.GOOGLE_CREDENTIALS_JSON,
      process.env.MOCK_MODE === 'true'
    );

    // Save parameters back to .env file for physical persistence
    const envPath = path.resolve(__dirname, '../.env');
    const envVars = {
      PORT: process.env.PORT || '5000',
      NODE_ENV: process.env.NODE_ENV || 'development',
      JWT_SECRET: process.env.JWT_SECRET || 'vastu_rentals_jwt_secret_token_2026',
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
      ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      GOOGLE_SPREADSHEET_ID: process.env.GOOGLE_SPREADSHEET_ID || '',
      GOOGLE_CREDENTIALS_JSON: process.env.GOOGLE_CREDENTIALS_JSON || '',
      MOCK_MODE: process.env.MOCK_MODE || 'true',
      BROKER_NAME: process.env.BROKER_NAME || 'Kawal',
      AGENCY_NAME: process.env.AGENCY_NAME || 'Vastu Rentals'
    };

    const envContent = Object.entries(envVars)
      .map(([key, val]) => `${key}=${val}`)
      .join('\n');

    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log("Persisted settings successfully to Backend/.env file.");

    return res.json({
      success: true,
      message: "Broker settings successfully saved.",
      settings: {
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        hasCredentials: !!process.env.GOOGLE_CREDENTIALS_JSON || !!process.env.GOOGLE_CREDENTIALS_PATH,
        hasGeminiKey: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here',
        mockMode: process.env.MOCK_MODE === 'true',
        brokerName: process.env.BROKER_NAME,
        agencyName: process.env.AGENCY_NAME
      }
    });
  } catch (error) {
    console.error("Save settings error:", error);
    return res.status(500).json({ error: "Failed to persist broker settings." });
  }
});

// Root Diagnostic Endpoint
app.get('/', (req, res) => {
  res.json({
    status: "online",
    service: "AI Real Estate Rental Assistant API",
    time: new Date().toISOString(),
    config: {
      mockMode: process.env.MOCK_MODE === 'true',
      hasGeminiKey: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here',
      hasSpreadsheetId: !!process.env.GOOGLE_SPREADSHEET_ID
    }
  });
});

// Boot server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
});
