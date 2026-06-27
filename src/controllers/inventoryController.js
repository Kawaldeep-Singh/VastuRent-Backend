const sheetsService = require('../services/sheetsService');
const { parseNumber, inferUnitType } = require('../utils/matcher');

/**
 * Get all property listings from Google Sheets
 */
exports.getListings = async (req, res) => {
  try {
    const listings = await sheetsService.getListings();
    const totalCount     = listings.length;
    const availableCount = listings.filter(l => (l.availability || '').trim().toLowerCase() === 'available').length;
    const rentedCount    = listings.filter(l => (l.availability || '').trim().toLowerCase() === 'rented').length;

    return res.json({ success: true, count: totalCount, availableCount, rentedCount, mockMode: sheetsService.mockMode, listings });
  } catch (error) {
    console.error('Get listings error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve property inventory.', message: error.message });
  }
};

/**
 * Add a new property listing
 */
exports.addListing = async (req, res) => {
  try {
    const { propertyName, projectName, sector, bhk, rent, furnishing, area, floor, availability, ownerName, ownerContact, propertyType, additionalNotes } = req.body;

    if (!projectName || !sector || !rent) {
      return res.status(400).json({ success: false, error: 'Missing required fields: Society Name, Sector, and Rent are required.' });
    }

    const listingData = {
      propertyName:    propertyName || `${projectName} Sector ${sector}`,
      projectName,
      sector:          String(sector).trim(),
      bhk:             String(bhk || '').trim(),
      unitType:        inferUnitType(bhk),
      rent:            parseNumber(rent),
      furnishing:      furnishing || 'Semi Furnished',
      area:            area || '',
      floor:           floor || '',
      availability:    availability || 'Available',
      ownerName:       ownerName || '',
      ownerContact:    ownerContact || '',
      propertyType:    propertyType || 'Apartment',
      additionalNotes: additionalNotes || ''
    };

    const newListing = await sheetsService.addListing(listingData);
    return res.status(201).json({ success: true, message: 'Property listing added successfully.', listing: newListing });
  } catch (error) {
    console.error('Add listing error:', error);
    return res.status(500).json({ success: false, error: 'Failed to add property listing.', message: error.message });
  }
};

/**
 * Update an existing property listing by its sheet row index
 */
exports.updateListing = async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.rowIndex);
    if (!rowIndex || rowIndex < 2) {
      return res.status(400).json({ success: false, error: 'Invalid row index.' });
    }

    const { propertyName, projectName, sector, bhk, rent, furnishing, ownerName, ownerContact, additionalNotes } = req.body;

    const listingData = {
      propertyName:    propertyName || '',
      projectName:     projectName || '',
      sector:          String(sector || '').trim(),
      bhk:             String(bhk || '').trim(),
      rent:            parseNumber(rent) || '',
      furnishing:      furnishing || '',
      ownerName:       ownerName || '',
      ownerContact:    ownerContact || '',
      additionalNotes: additionalNotes || ''
    };

    await sheetsService.updateListing(rowIndex, listingData);
    return res.json({ success: true, message: 'Property updated successfully.', rowIndex });
  } catch (error) {
    console.error('Update listing error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update property.', message: error.message });
  }
};

/**
 * Delete a property listing by its sheet row index
 */
exports.deleteListing = async (req, res) => {
  try {
    const rowIndex = parseInt(req.params.rowIndex);
    if (!rowIndex || rowIndex < 2) {
      return res.status(400).json({ success: false, error: 'Invalid row index.' });
    }

    await sheetsService.deleteListing(rowIndex);
    return res.json({ success: true, message: 'Property deleted successfully.', rowIndex });
  } catch (error) {
    console.error('Delete listing error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete property.', message: error.message });
  }
};
