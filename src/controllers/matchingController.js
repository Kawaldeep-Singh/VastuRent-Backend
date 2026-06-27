const geminiService = require('../services/geminiService');
const sheetsService = require('../services/sheetsService');
const { rankListings } = require('../utils/matcher');

// In-memory cache to detect duplicate requirements within the last 1 hour
const recentSearches = [];
const DUPLICATE_WINDOW = 60 * 60 * 1000; // 1 hour

/**
 * Match a raw tenant requirement string against inventory
 */
exports.matchRequirement = async (req, res) => {
  try {
    const { rawText, brokerName, agencyName } = req.body;

    if (!rawText || rawText.trim() === "") {
      return res.status(400).json({ error: "Tenant requirement text is required." });
    }

    const bName = brokerName || "Kawal";
    const aName = agencyName || "Vastu Rentals";

    // 1. Extract structured data (Gemini AI or local fallback)
    console.log(`ðŸ” Matching requirement: "${rawText}"`);
    const requirement = await geminiService.extractRequirement(rawText);
    
    if (!requirement) {
      return res.status(500).json({ error: "AI failed to extract structural search parameters." });
    }
    requirement.rawText = rawText;

    // 2. Duplicate Detection
    const now = Date.now();
    // Prune expired searches
    while (recentSearches.length > 0 && (now - recentSearches[0].timestamp > DUPLICATE_WINDOW)) {
      recentSearches.shift();
    }
    
    // Check if duplicate exists
    const isDuplicate = recentSearches.some(s => 
      s.requirement.sector === requirement.sector &&
      s.requirement.bhk === requirement.bhk &&
      s.requirement.budget === requirement.budget &&
      s.requirement.propertyType === requirement.propertyType
    );

    // Save search history
    recentSearches.push({ timestamp: now, requirement });

    // 3. Fetch property inventory (force fresh live reload from sheets)
    sheetsService.invalidateCache();
    const listings = await sheetsService.getListings();

    // 4. Run matching algorithm
    const rankedListings = rankListings(requirement, listings);
    const allMatches = rankedListings.filter(item => item.isMatch);
    const messageReadyMatches = allMatches.filter(item => Number(item.property?.rent || 0) > 0);
    const nearMisses = rankedListings.filter(item => !item.isMatch && item.matchScore >= 35).slice(0, 5);
    
    // Select top matches for explanation and message inclusion
    const topMatches = messageReadyMatches.slice(0, 20);

    // 5. Generate Explanations, Insights, and WhatsApp message in a SINGLE AI Call
    let matchesWithExplanations = topMatches;
    let insights = null;
    let whatsappMessage = "No properties found to match exactly.";

    if (topMatches.length > 0) {
      const consolidatedData = await geminiService.generateConsolidatedMatchData(
        requirement,
        topMatches.map(m => m.property),
        bName,
        aName
      );

      matchesWithExplanations = topMatches.map((m, index) => {
        return {
          ...m,
          explanation: (consolidatedData.explanations && consolidatedData.explanations[index]) 
            ? consolidatedData.explanations[index] 
            : "Good match based on your preferences."
        };
      });

      insights = consolidatedData.insights;
      whatsappMessage = consolidatedData.whatsappMessage;
    } else {
      whatsappMessage = geminiService.mockGenerateResponse(requirement, [], bName, aName);
      insights = geminiService.mockInsights(requirement, []);
    }

    return res.json({
      success: true,
      requirement,
      isDuplicate,
      matches: matchesWithExplanations,
      totalMatchesCount: allMatches.length,
      shownMatchesCount: topMatches.length,
      inventoryCount: listings.length,
      isMockData: sheetsService.mockMode,
      nearMisses,
      insights,
      whatsappMessage
    });

  } catch (error) {
    console.error("Match requirement controller error:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Failed to perform matching process.",
      message: error.message 
    });
  }
};

/**
 * Generate site-visit follow up message
 */
exports.generateFollowUp = async (req, res) => {
  try {
    const { tenantName, brokerName, agencyName } = req.body;
    
    const tName = tenantName || "Client";
    const bName = brokerName || "Kawal";
    const aName = agencyName || "Vastu Rentals";

    const followUpMessage = await geminiService.generateFollowUpMessage(tName, bName, aName);

    return res.json({
      success: true,
      followUpMessage
    });
  } catch (error) {
    console.error("Generate follow-up error:", error);
    return res.status(500).json({ error: "Failed to generate follow-up message." });
  }
};



