const clientsService = require('../services/clientsService');
const sheetsService  = require('../services/sheetsService');
const { rankListings } = require('../utils/matcher');

/**
 * Get all clients
 */
exports.getClients = async (req, res) => {
  try {
    const clients = await clientsService.getClients();
    return res.json({ success: true, count: clients.length, clients });
  } catch (error) {
    console.error('getClients error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch clients.', message: error.message });
  }
};

/**
 * Add a new client
 */
exports.addClient = async (req, res) => {
  try {
    const { name, phone, bhk, budget, sector, furnishing, tenantType, remarks, status } = req.body;

    if (!name && !phone) {
      return res.status(400).json({ success: false, error: 'At least Name or Phone is required.' });
    }

    if (phone) {
      const clients = await clientsService.getClients();
      const cleanPhone = str => (str || '').replace(/\D/g, '').slice(-10);
      const inputPhone = cleanPhone(phone);
      if (inputPhone && clients.some(c => cleanPhone(c.phone) === inputPhone)) {
        return res.status(400).json({ success: false, error: 'A client with this phone number already exists.' });
      }
    }

    const clientData = { name: name || '', phone: phone || '', bhk: bhk || '', budget: budget || '', sector: sector || '', furnishing: furnishing || '', tenantType: tenantType || '', remarks: remarks || '', status: status || 'Active' };
    const newClient = await clientsService.addClient(clientData);
    return res.status(201).json({ success: true, message: 'Client added successfully.', client: newClient });
  } catch (error) {
    console.error('addClient error:', error);
    return res.status(500).json({ success: false, error: 'Failed to add client.', message: error.message });
  }
};

/**
 * Update a client by sheet row index
 */
exports.updateClient = async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.rowIndex);
    if (!rowIndex || rowIndex < 2) return res.status(400).json({ success: false, error: 'Invalid row index.' });

    const { name, phone, bhk, budget, sector, furnishing, tenantType, remarks, status } = req.body;
    const clientData = { name: name || '', phone: phone || '', bhk: bhk || '', budget: budget || '', sector: sector || '', furnishing: furnishing || '', tenantType: tenantType || '', remarks: remarks || '', status: status || 'Active' };

    await clientsService.updateClient(rowIndex, clientData);
    return res.json({ success: true, message: 'Client updated successfully.', rowIndex });
  } catch (error) {
    console.error('updateClient error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update client.', message: error.message });
  }
};

/**
 * Delete a client by sheet row index
 */
exports.deleteClient = async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.rowIndex);
    if (!rowIndex || rowIndex < 2) return res.status(400).json({ success: false, error: 'Invalid row index.' });

    await clientsService.deleteClient(rowIndex);
    return res.json({ success: true, message: 'Client deleted successfully.', rowIndex });
  } catch (error) {
    console.error('deleteClient error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete client.', message: error.message });
  }
};

/**
 * Auto-match: Run scoring for ALL active clients against ALL properties
 */
exports.matchAllClients = async (req, res) => {
  try {
    sheetsService.invalidateCache();
    const [clients, listings] = await Promise.all([
      clientsService.getClients(),
      sheetsService.getListings()
    ]);

    const activeClients = clients.filter(c => (c.status || '').toLowerCase() !== 'closed');

    const results = activeClients.map(client => {
      // Build a requirement object from the client row
      const requirement = {
        bhk:        client.bhk || null,
        unitType:   client.bhk ? 'BHK' : null,
        sector:     client.sector || null,
        budget:     client.budget || null,
        furnishing: client.furnishing || null,
        tenantType: client.tenantType || null,
        rawText:    [client.bhk && `${client.bhk} bhk`, client.sector && `sector ${client.sector}`, client.budget && `under ${client.budget}`, client.furnishing, client.tenantType, client.remarks].filter(Boolean).join(' '),
        summary:    `${client.name || 'Client'} needs ${client.bhk ? client.bhk + ' BHK' : ''} in Sector ${client.sector || 'any'} under Rs ${client.budget || 'any'}`.trim()
      };

      // Run the full scoring engine
      const ranked = rankListings(requirement, listings);
      const matches    = ranked.filter(r => r.isMatch).slice(0, 5);
      const nearMisses = ranked.filter(r => !r.isMatch && r.matchScore >= 30).slice(0, 3);

      return {
        client,
        requirement,
        matches:    matches.map(r => ({ ...r.property, matchScore: r.matchScore, breakdown: r.breakdown, flags: r.flags })),
        nearMisses: nearMisses.map(r => ({ ...r.property, matchScore: r.matchScore })),
        matchCount: matches.length
      };
    });

    // Sort: clients with most matches first
    results.sort((a, b) => b.matchCount - a.matchCount);

    return res.json({
      success:      true,
      totalClients: activeClients.length,
      totalProperties: listings.length,
      results
    });
  } catch (error) {
    console.error('matchAllClients error:', error);
    return res.status(500).json({ success: false, error: 'Auto-match failed.', message: error.message });
  }
};

/**
 * Match a single client by rowIndex
 */
exports.matchSingleClient = async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.rowIndex);
    const clients = await clientsService.getClients();
    const client = clients.find(c => c.sourceRow === rowIndex);
    if (!client) return res.status(404).json({ success: false, error: 'Client not found.' });

    sheetsService.invalidateCache();
    const listings = await sheetsService.getListings();

    const requirement = {
      bhk:        client.bhk || null,
      unitType:   client.bhk ? 'BHK' : null,
      sector:     client.sector || null,
      budget:     client.budget || null,
      furnishing: client.furnishing || null,
      tenantType: client.tenantType || null,
      rawText:    [client.bhk && `${client.bhk} bhk`, client.sector && `sector ${client.sector}`, client.budget && `under ${client.budget}`, client.furnishing, client.tenantType, client.remarks].filter(Boolean).join(' '),
      summary:    `${client.name || 'Client'} needs ${client.bhk ? client.bhk + ' BHK' : ''} in Sector ${client.sector || 'any'} under Rs ${client.budget || 'any'}`.trim()
    };

    const ranked     = rankListings(requirement, listings);
    const matches    = ranked.filter(r => r.isMatch).slice(0, 10);
    const nearMisses = ranked.filter(r => !r.isMatch && r.matchScore >= 30).slice(0, 5);

    return res.json({
      success: true,
      client,
      requirement,
      matches:    matches.map(r => ({ ...r.property, matchScore: r.matchScore, breakdown: r.breakdown, flags: r.flags })),
      nearMisses: nearMisses.map(r => ({ ...r.property, matchScore: r.matchScore }))
    });
  } catch (error) {
    console.error('matchSingleClient error:', error);
    return res.status(500).json({ success: false, error: 'Match failed.', message: error.message });
  }
};
