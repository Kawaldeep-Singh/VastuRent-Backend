const { GoogleGenerativeAI } = require('@google/generative-ai');
const { normalizeText } = require('../utils/matcher');

const EXTRACTION_EXAMPLES = [
  "2 BHK GLS Avenue Sector 81 under 20k semi furnished",
  "Need 3 BHK semi furnished in Sector 89 under 30k family ke liye",
  "Bachelor allowed 1 RK near Sector 45 cheap option",
  "Park facing 3 BHK in M3M Soulitude budget 35k",
  "सस्ते 2 bhk flat sector 81 family ke liye",
  "1 BHK fully furnished under 18k near Sector 46",
  "3 bedroom apartment in Smart World Gems below 32k",
  "2 room set chahiye Sector 57 me budget 15000",
  "Raw flat GLS Avenue Sector 81 rent 15k tak",
  "Semi furnished 2 BHK for family in Sector 82",
  "Fully furnished 1 RK for bachelor near Cyber City",
  "Company lease 3 BHK in DLF Primus budget 45k",
  "Girls bachelor allowed 2 BHK near Sector 52",
  "Pet friendly flat Sector 89 under 30k",
  "Ground floor independent floor Sector 84 around 40k",
  "Villa chahiye Sector 85 me 4 BHK budget 60k",
  "2 BHK pool facing near Smart World One Rx",
  "Newly painted 3 BHK family flat Sector 90",
  "Low maintenance affordable apartment Sector 81",
  "High rise society flat near Dwarka Expressway 30k",
  "2 BHK unfurnished flat under 16k Sector 81",
  "Semi furnished apartment near school Sector 83",
  "3 BHK with modular kitchen Sector 89 35k",
  "1 room kitchen for single boy under 10k",
  "Budget friendly 2 BHK near Vatika City Homes",
  "Corner flat park facing Sector 92 2 BHK",
  "2 BHK in Signature Global Synera under 18k",
  "Family friendly 3 BHK Sector 84 near club",
  "Ready to move 2 BHK Sector 107 Woodshire",
  "Luxury furnished 3 BHK Emaar Imperial Gardens",
  "Sushant Lok 1 builder floor 3 BHK 50k",
  "Palam Vihar independent floor 2 BHK 25k",
  "Golf Extension 3 BHK premium apartment 70k",
  "Near metro 1 BHK furnished Gurgaon under 25k",
  "2 BHK for married couple Sector 86 semi",
  "No owner interference bachelor flat Sector 45",
  "Top floor with terrace Sector 57 3 BHK",
  "Basement not required 2 BHK Sector 82",
  "Lift parking must 3 BHK Sector 89",
  "Servant room chahiye 4 BHK villa Gurgaon",
  "2 BHK close to office Sector 74 under 28k",
  "3 BHK close to NH8 family budget 38k",
  "Small family 2 BHK Sector 81 18k tak",
  "Bachelor boys ke liye 1 RK near Huda City",
  "Couple friendly 1 BHK Gurgaon 20k",
  "Furnished studio apartment under 22k",
  "Studio near Golf Course Road company lease",
  "2 BHK in gated society Sector 89 semi furnished",
  "Cheapest flat available in GLS Avenue",
  "GLS Avanue 81 2bhk rent 16500",
  "Gls avenue sector 81 semi furnished 2 bhk",
  "GLS Avenue raw flat 15000",
  "M3M Soulitude 3bhk family under 30k",
  "M3M Solitude typo search 3 bhk",
  "Smart world gem 2 bhk furnished",
  "SmartWorld Gems Sector 89 under 28k",
  "SS Almeria independent floor 3 BHK",
  "Almeria villa fully furnished around 35k",
  "Pivotal Devaan Sector 84 budget option",
  "Orris Carnation 2 BHK Sector 85",
  "Pyramid Elite Sector 86 affordable flat",
  "Bestech Park View 3 BHK family",
  "DLF Primus Sector 82 premium semi furnished",
  "Vatika City Homes 2 BHK backyard",
  "Signature Synera cheap 2 bhk sector 81",
  "Woodshire Sector 107 peaceful balcony",
  "Emaar Imperial fully furnished 3 bhk",
  "3 BHK below 40 thousand in Sector 102",
  "2 BHK 22 hazaar tak semi furnished",
  "तीन bhk sector 89 me 30000 ke andar",
  "दो bhk सस्ता flat sector 81",
  "family ke liye park facing flat chahiye",
  "bachelors allowed furnished flat near sector 45",
  "किफायती apartment Gurgaon me chahiye",
  "सेमी furnished 2 bhk sector 81",
  "fully furnished family flat 35k Gurgaon",
  "unfurnished 2 bedroom under 17000",
  "2 bhk with balcony and parking sector 81",
  "3 BHK close to clubhouse Sector 89",
  "Pool view 2 BHK Sector 84",
  "Sun facing apartment Sector 90",
  "North east facing 3 bhk floor Gurgaon",
  "First floor independent house Sector 46",
  "Second floor builder floor Sushant Lok",
  "No brokerage client wants 2 BHK",
  "Immediate shifting 2 bhk sector 81",
  "Available today 3 bhk sector 89",
  "Short term rental furnished studio",
  "Long term lease family apartment",
  "Owner free property bachelor allowed",
  "New construction flat Sector 92",
  "Old society low rent sector 81",
  "High security society for family",
  "Near market 2 BHK Sector 83",
  "Near hospital family flat Gurgaon",
  "Near school 3 BHK family sector 89",
  "Budget 20000 max 2 bhk semi furnished",
  "Below 15k one room set Gurgaon",
  "Around 25k 2 bedroom apartment",
  "Under 50k 4 BHK villa with parking"
];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Quota-aware Gemini Service
// â€¢ Detects daily quota exhaustion and stops retrying for the day
// â€¢ Retries on per-minute rate limits with exponential backoff
// â€¢ Falls back to high-quality local generation when API is down
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelName = 'gemini-2.0-flash';
    this.client = null;

    // Quota tracking â€” if daily quota is exhausted we skip all API calls
    this.quotaExhaustedUntil = 0; // timestamp when we think quota resets
    this.MAX_RETRIES = 2;
    this.BASE_DELAY_MS = 2000;

    this.initClient();
  }

  initClient() {
    if (this.apiKey && this.apiKey !== 'your_gemini_api_key_here') {
      try {
        this.client = new GoogleGenerativeAI(this.apiKey);
        console.log('âœ… Gemini API client initialized.');
      } catch (err) {
        console.error('âŒ Error setting up Gemini client:', err.message);
      }
    } else {
      console.warn('âš ï¸  GEMINI_API_KEY not configured â†’ running in LOCAL AI mode.');
    }
  }

  updateApiKey(newKey) {
    this.apiKey = newKey;
    this.quotaExhaustedUntil = 0; // reset when key changes
    this.initClient();
  }

  // â”€â”€â”€ Quota helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** Returns true when we know the daily quota is gone */
  isDailyQuotaExhausted() {
    if (this.quotaExhaustedUntil === 0) return false;
    if (Date.now() >= this.quotaExhaustedUntil) {
      this.quotaExhaustedUntil = 0; // try again
      return false;
    }
    return true;
  }

  /** Inspect a 429 error and decide if it's daily or per-minute */
  markQuotaError(error) {
    const details = error?.errorDetails || [];
    const isDayQuota = details.some(d =>
      d['@type']?.includes('QuotaFailure') &&
      JSON.stringify(d.violations || []).includes('PerDay')
    );

    if (isDayQuota) {
      // Park for 1 hour (Google resets at midnight PT, but 1h is a safe window)
      this.quotaExhaustedUntil = Date.now() + 60 * 60 * 1000;
      console.warn('ðŸš« Gemini daily quota exhausted â€” switching to LOCAL AI mode for ~1 hour.');
    }
  }

  /** Returns true if the service can attempt an API call right now */
  canCallApi() {
    return this.client !== null && !this.isDailyQuotaExhausted();
  }

  // â”€â”€â”€ Low-level call with retry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async callGemini(prompt) {
    if (!this.canCallApi()) return null;

    const model = this.client.getGenerativeModel({ model: this.modelName });

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        if (error.status === 429) {
          this.markQuotaError(error);

          if (this.isDailyQuotaExhausted()) {
            return null; // don't retry
          }

          // Per-minute limit â€” wait and retry
          const retryMs = this.BASE_DELAY_MS * Math.pow(2, attempt);
          if (attempt < this.MAX_RETRIES) {
            console.warn(`â³ Rate limited. Retrying in ${retryMs / 1000}s (attempt ${attempt + 1}/${this.MAX_RETRIES})...`);
            await this.sleep(retryMs);
            continue;
          }
        }
        // Non-429 or max retries reached
        console.warn(`âš ï¸  Gemini API error: ${error.message?.substring(0, 120)}`);
        return null;
      }
    }
    return null;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // â”€â”€â”€ JSON response cleaner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  cleanJsonText(text) {
    let clean = text.trim();
    if (clean.startsWith('```json')) clean = clean.substring(7);
    else if (clean.startsWith('```'))  clean = clean.substring(3);
    if (clean.endsWith('```'))         clean = clean.substring(0, clean.length - 3);
    return clean.trim();
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PUBLIC API â€” every method gracefully falls back to local
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /**
   * Step 1: Extract structured requirement from raw WhatsApp text
   */
  async extractRequirement(rawText) {
    if (!rawText) return null;

    const prompt = `
You are a Real Estate Assistant AI for Indian property brokers in Gurgaon, Haryana.
Extract structured search parameters from the WhatsApp tenant requirement message below.
The message may be in Hindi, English, or Hinglish (mix). Understand it intelligently.
Return ONLY a valid JSON object. No markdown, no explanation, just raw JSON.

JSON Schema:
{
  "propertyType": "Apartment" | "Villa" | "Independent Floor" | "Penthouse" | null,
  "unitType": "BHK" | "RK" | "HK" | "Studio" | "Room Set" | null,
  "bhk": number | null,
  "sector": string | null,
  "projectName": string | null,
  "budget": number | null,
  "furnishing": "Fully Furnished" | "Semi Furnished" | "Unfurnished" | null,
  "tenantType": "Family" | "Bachelors" | "Company Lease" | null,
  "summary": "One short sentence in English summarizing the requirement"
}

Rules:
- "3bhk", "3 BHK", "teen bhk", "3 bedroom" all mean unitType: "BHK", bhk: 3
- "1 RK", "one RK", "room kitchen", "studio" mean unitType: "RK" or "Studio"; do NOT convert RK to BHK
- "1 room set" means unitType: "Room Set", bhk: 1
- "30k", "30,000", "tees hazaar" all mean budget: 30000
- "Sector 89", "sector 89", "sec 89", "89 sector", "near sector 89" all mean sector: "89"
- "furnished", "fully furnished" = "Fully Furnished". "semi" = "Semi Furnished". "unfurnished", "bare" = "Unfurnished"
- "family", "parivar" = Family. "bachelor", "boys", "akela" = Bachelors
- If they mention a project name like "M3M Soulitude", "Smart World Gems", "SS Almeria", set projectName exactly and infer sector if confidently known
- Write summary in English always

Examples of real user queries this parser must understand:
${EXTRACTION_EXAMPLES.map((example, index) => `${index + 1}. ${example}`).join('\n')}

Message: "${rawText}"
`;

    const response = await this.callGemini(prompt);
    if (response) {
      try {
        return JSON.parse(this.cleanJsonText(response));
      } catch (e) {
        console.warn('âš ï¸  Could not parse Gemini extraction JSON â€” using local parser.');
      }
    }

    return this.localExtract(rawText);
  }

  /**
   * Steps 2+3+4 Combined: Explanations + Insights + WhatsApp in ONE call
   */
  async generateConsolidatedMatchData(requirement, matches, brokerName = "Kawal", agencyName = "Vastu Rentals") {
    if (matches.length === 0) {
      return {
        explanations: [],
        insights: this.localInsights(requirement, matches),
        whatsappMessage: this.localWhatsApp(requirement, matches, brokerName, agencyName)
      };
    }

    // Build compact properties description
    const propertiesList = matches.map((p, idx) =>
      `[Property ${idx + 1}] ${p.projectName || p.propertyName || 'Property'} (${this.cleanSectorLabel(p.sector)}) - ${p.bhk} BHK (${p.propertyType || 'Apartment'}) - ${this.cleanFurnishingLabel(p.furnishing)} - Rent: Rs ${Number(p.rent || 0).toLocaleString('en-IN')}${p.area ? ' - Area: ' + p.area : ''}`
    ).join('\n');

    const prompt = `
You are a premium real estate broker at "${agencyName}".
We have a client requirement and some matched properties.
Please generate 3 things and return ONLY a valid JSON object matching the schema. No markdown wrapping.

Client Requirement:
- Summary: ${requirement.summary || 'Looking for property'}
- BHK: ${requirement.bhk || 'Any'}
- Sector: ${requirement.sector || 'Any'}
- Budget: ${requirement.budget || 'Any'}
- Furnishing: ${requirement.furnishing || 'Any'}

Matched Properties:
${propertiesList}

JSON Schema expected:
{
  "explanations": [
    "A 2-3 sentence explanation for the broker on why Property 1 matches...",
    "A 2-3 sentence explanation for the broker on why Property 2 matches..."
  ],
  "insights": {
    "budgetAnalysis": "Analysis of the client's budget for this area",
    "marketDemand": "High" or "Medium" or "Low",
    "agentTips": [
      "Negotiate on security deposit",
      "Show this as a primary alternative"
    ],
    "nearbySectorAnalysis": "Analysis of adjacent sectors..."
  },
  "whatsappMessage": "A clean professional WhatsApp message pitch to the client using the matched properties. Hide owner details completely. Do not use emojis. Use Rs instead of rupee symbols. Use *bold* formatting. Do not show properties with missing or zero rent. Add signature: Regards, ${brokerName}, ${agencyName}. Use \\n for line breaks."
}
`;

    const response = await this.callGemini(prompt);
    if (response) {
      try {
        const parsed = JSON.parse(this.cleanJsonText(response));
        // Validate essential fields
        if (parsed.explanations && parsed.insights && parsed.whatsappMessage) {
          return parsed;
        }
      } catch (e) {
        console.warn('âš ï¸  Could not parse Gemini consolidated JSON â€” using local generation.');
      }
    }

    // Fallback to local generation
    return {
      explanations: matches.map(p => this.localExplanation(requirement, p)),
      insights: this.localInsights(requirement, matches),
      whatsappMessage: this.localWhatsApp(requirement, matches, brokerName, agencyName)
    };
  }

  /**
   * Step 5: Follow-up message builder
   */
  async generateFollowUpMessage(tenantName = "Client", brokerName = "Kawal", agencyName = "Vastu Rentals") {
    const prompt = `
Write a short, polite WhatsApp follow-up message to send to a client named "${tenantName}" who was sent property options. Invite them to schedule a site visit. Use emojis. Keep it to 1-2 short paragraphs.
Regards,
${brokerName}
${agencyName}
`;

    const response = await this.callGemini(prompt);
    if (response) return response.trim();

    return `Hi ${tenantName} ðŸ‘‹\n\nHope you had a chance to review the property options I shared earlier. I have some excellent choices that I think would be perfect for you!\n\nWould you be available for a quick site visit this weekend? I can arrange viewings at your convenience. ðŸ âœ¨\n\nLooking forward to hearing from you!\n\nRegards,\n*${brokerName}*\n*${agencyName}*`;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // LOCAL (OFFLINE) GENERATION â€” works without any API calls
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /**
   * Local requirement extraction â€” handles Hindi/English/Hinglish
   */
  localExtract(rawText) {
    console.log('ðŸ”§ Using local AI extraction...');
    const text = normalizeText(rawText); // handles Hindi, English, and Hinglish tokens

    // Unit/BHK detection — order matters: RK first, then strict BHK, then HK (NOT inside BHK)
    let unitType = null;
    let bhk = null;

    // RK: "1rk", "rk", "room kitchen", "studio"
    const rkMatch = text.match(/(\d)?\s*(?:rk|room\s*kitchen|studio)\b/i);
    // BHK: must have the full word "bhk" or "bedroom" — checked BEFORE hk
    const bhkMatch = text.match(/(\d)\s*(?:bhk|bh\s*k|bedroom|bed\s*room|bk)\b/i)
      || text.match(/\b(\d)\s*(?:bhk|bedroom)\b/i);
    // HK: standalone "hk" word — use negative lookbehind to NOT match 'bhk'
    const hkMatch  = text.match(/(\d)?\s*(?<![a-z])hk\b/i);
    // Room set — not confused with "bedroom"
    const roomSetMatch = text.match(/(\d)?\s*room\s*set\b/i);

    if (rkMatch) {
      unitType = text.includes('studio') ? 'Studio' : 'RK';
      bhk = parseInt(rkMatch[1] || '1');
    } else if (bhkMatch) {
      // BHK checked before HK so "2 bhk" never hits hkMatch
      unitType = 'BHK';
      bhk = parseInt(bhkMatch[1]);
    } else if (hkMatch) {
      unitType = 'HK';
      bhk = parseInt(hkMatch[1] || '1');
    } else if (roomSetMatch) {
      unitType = 'Room Set';
      bhk = parseInt(roomSetMatch[1] || '1');
    } else {
      // Fallback text-based detection
      if      (text.includes('teen bhk') || text.includes('3bhk') || text.includes('3 bhk'))   { bhk = 3; unitType = 'BHK'; }
      else if (text.includes('do bhk')   || text.includes('2bhk') || text.includes('2 bhk'))   { bhk = 2; unitType = 'BHK'; }
      else if (text.includes('ek bhk')   || text.includes('1bhk') || text.includes('1 bhk'))   { bhk = 1; unitType = 'BHK'; }
      else if (text.includes('chaar bhk')|| text.includes('4bhk') || text.includes('4 bhk'))   { bhk = 4; unitType = 'BHK'; }
      else if (text.includes('1 rk')     || text.includes('1rk')  || text.includes('one rk'))  { bhk = 1; unitType = 'RK';  }
    }


    // Sector detection
    let sector = null;
    // Matches "sec-89", "sec 89", "sec89", "sector-89", "sector 89", "sector89"
    const sectorMatch = text.match(/(?:sector|sec|sector\s*no\.?|near\s*sector)[\s\-_]*(\d+[a-z]?)/i)
      || text.match(/(\d+[a-z]?)[\s\-_]*(?:sector|sec|s)\b/i);
    if (sectorMatch) {
      sector = sectorMatch[1];
    }

    // Project name detection (also infer sector from known projects)
    const PROJECT_MAP = {
      'soulitude': { name: 'M3M Soulitude', sector: '89' },
      'm3m soulitude': { name: 'M3M Soulitude', sector: '89' },
      'gems': { name: 'Smart World Gems', sector: '89' },
      'smart world gems': { name: 'Smart World Gems', sector: '89' },
      'smart world one': { name: 'Smart World One Rx', sector: '84' },
      'one rx': { name: 'Smart World One Rx', sector: '84' },
      'almeria': { name: 'SS Almeria', sector: '84' },
      'ss almeria': { name: 'SS Almeria', sector: '84' },
      'primus': { name: 'DLF The Primus', sector: '82' },
      'dlf primus': { name: 'DLF The Primus', sector: '82' },
      'emaar imperial': { name: 'Emaar Imperial Gardens', sector: '102' },
      'imperial garden': { name: 'Emaar Imperial Gardens', sector: '102' },
      'woodshire': { name: 'M3M Woodshire', sector: '107' },
      'm3m woodshire': { name: 'M3M Woodshire', sector: '107' },
      'vatika': { name: 'Vatika City Homes', sector: '83' },
      'synera': { name: 'Signature Global Synera', sector: '81' },
      'landmark': { name: 'Landmark', sector: '81' },
      'devaan': { name: 'Pivotal Devaan', sector: '84' },
      'pivotal devaan': { name: 'Pivotal Devaan', sector: '84' },
      'orris': { name: 'Orris Carnation', sector: '85' },
      'carnation': { name: 'Orris Carnation', sector: '85' },
      'park view': { name: 'Bestech Park View', sector: '92' },
      'bestech': { name: 'Bestech Park View Grand Spa', sector: '92' },
      'pyramid elite': { name: 'Pyramid Elite', sector: '86' },
      'palam vihar': { name: 'Palam Vihar', sector: 'Palam Vihar' },
      'sushant lok': { name: 'Sushant Lok', sector: 'Sushant Lok 1' },
      'golf extension': { name: 'Golf Extension', sector: 'Golf Extension' },
    };

    let projectName = null;
    for (const [key, val] of Object.entries(PROJECT_MAP)) {
      if (text.includes(key)) {
        projectName = val.name;
        if (!sector) sector = val.sector;
        break;
      }
    }

    // Budget detection
    let budget = null;
    const budgetThousand = text.match(/(\d+(?:\.\d+)?)\s*(?:k|thousand|hazaar|hazar|thousand|th)\b/i);
    if (budgetThousand) {
      budget = Math.round(parseFloat(budgetThousand[1]) * 1000);
    } else {
      const budgetLakh = text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)\b/i);
      if (budgetLakh) {
        budget = Math.round(parseFloat(budgetLakh[1]) * 100000);
      } else {
        const budgetNum = text.match(/(?:under|budget|upto|up to|around|approx|tak|ke\s*andar)\s*(\d+)/i)
          || text.match(/(\d+)\s*(?:000)/i);
        if (budgetNum) {
          budget = parseInt(budgetNum[1]);
          if (budget < 200) budget *= 1000;
        }
      }
    }

    // Furnishing
    let furnishing = null;
    if (text.includes('semi furnished') || text.includes('semi-furnished') || text.includes('semi ')) furnishing = 'Semi Furnished';
    else if (text.includes('fully furnished') || text.includes('fully-furnished') || (text.match(/\bfurnished\b/) && !text.includes('semi'))) furnishing = 'Fully Furnished';
    else if (text.includes('unfurnished') || text.includes('bare shell')) furnishing = 'Unfurnished';

    // Tenant type
    let tenantType = null;
    if (text.includes('family') || text.includes('parivar') || text.includes('married')) tenantType = 'Family';
    else if (text.includes('bachelor') || text.includes('boys') || text.includes('akela') || text.includes('single') || text.includes('girls')) tenantType = 'Bachelors';
    else if (text.includes('company') || text.includes('corporate') || text.includes('lease')) tenantType = 'Company Lease';

    // Property type
    let propertyType = 'Apartment';
    if (text.includes('independent floor') || text.includes('builder floor') || text.includes('floor')) propertyType = 'Independent Floor';
    else if (text.includes('villa') || text.includes('kothi') || text.includes('house')) propertyType = 'Villa';
    else if (text.includes('penthouse')) propertyType = 'Penthouse';

    // Generate summary
    const parts = [];
    if (bhk && unitType && unitType !== 'BHK') parts.push(`${bhk} ${unitType}`);
    else if (bhk) parts.push(`${bhk} BHK`);
    if (furnishing) parts.push(furnishing.toLowerCase());
    parts.push(propertyType.toLowerCase());
    if (sector) parts.push(`in Sector ${sector}`);
    else if (projectName) parts.push(`in ${projectName}`);
    else parts.push('in Gurgaon');
    if (budget) parts.push(`under â‚¹${budget.toLocaleString('en-IN')}`);
    const summary = `Need ${parts.join(' ')}`;

    return { propertyType, unitType, bhk, sector, projectName, budget, furnishing, tenantType, summary };
  }

  /**
   * Local property-match explanation
   */
  localExplanation(requirement, property) {
    const parts = [];

    // Sector match
    if (property.sector && requirement.sector) {
      if (String(property.sector).toLowerCase() === String(requirement.sector).toLowerCase()) {
        parts.push(`Located in the exact requested Sector ${property.sector}`);
      } else {
        parts.push(`Located in nearby Sector ${property.sector}`);
      }
    }

    // BHK match
    if (property.bhk && requirement.bhk) {
      if (property.bhk === requirement.bhk) {
        parts.push(`exact ${property.bhk} BHK configuration match`);
      } else {
        parts.push(`${property.bhk} BHK (client requested ${requirement.bhk} BHK)`);
      }
    }

    // Budget match
    if (property.rent && requirement.budget) {
      const rent = Number(property.rent);
      const budget = Number(requirement.budget);
      if (rent <= budget) {
        const savings = budget - rent;
        parts.push(`rent of â‚¹${rent.toLocaleString('en-IN')}/month is${savings > 0 ? ` â‚¹${savings.toLocaleString('en-IN')} under` : ' exactly within'} budget`);
      } else {
        const over = Math.round(((rent - budget) / budget) * 100);
        parts.push(`rent of â‚¹${rent.toLocaleString('en-IN')}/month is ${over}% above budget but negotiable`);
      }
    }

    // Furnishing
    if (property.furnishing) {
      parts.push(`${property.furnishing} as per preference`);
    }

    if (parts.length === 0) {
      return `${property.projectName || 'This property'} is a viable match based on overall parameters.`;
    }

    return `${property.projectName || 'This property'}: ${parts.join(', ')}.`;
  }

  /**
   * Local market insights generation
   */
  localInsights(requirement, matches) {
    const budget = Number(requirement.budget) || 25000;
    const sector = requirement.sector || 'your preferred area';
    const bhk = requirement.bhk || 2;
    const matchCount = matches.length;

    // Budget analysis
    let budgetStatus;
    if (budget >= 35000) {
      budgetStatus = `Very comfortable budget of â‚¹${budget.toLocaleString('en-IN')} for Sector ${sector}. This opens up fully furnished and premium society options. Standard ${bhk} BHK rents here range â‚¹25,000-â‚¹40,000.`;
    } else if (budget >= 25000) {
      budgetStatus = `Realistic budget of â‚¹${budget.toLocaleString('en-IN')} for Sector ${sector}. Good semi-furnished ${bhk} BHK options are available in this range. Market average for this configuration is â‚¹25,000-â‚¹32,000.`;
    } else if (budget >= 18000) {
      budgetStatus = `Budget of â‚¹${budget.toLocaleString('en-IN')} is slightly tight for premium societies in Sector ${sector}, but affordable options like Signature Global or similar projects can work well for ${bhk} BHK.`;
    } else {
      budgetStatus = `Budget of â‚¹${budget.toLocaleString('en-IN')} is on the lower side for Sector ${sector}. Consider expanding search to nearby sectors or exploring smaller configurations for better options.`;
    }

    // Demand
    const demand = matchCount >= 4 ? 'High' : matchCount >= 2 ? 'Medium' : 'Low';

    // Tips
    const tips = [];
    if (matchCount > 0) {
      tips.push(`Show ${matches[0]?.projectName || 'the top match'} first â€” highest compatibility with client needs.`);
    }
    if (budget < 35000) {
      tips.push('Negotiate security deposit to 1 month instead of 2 to reduce client upfront cost.');
    }
    if (matchCount >= 2) {
      tips.push('Schedule back-to-back site visits for top 2-3 options to save client time.');
    }
    tips.push('Ask client about move-in timeline â€” owners prefer confirmed dates for faster closure.');
    if (requirement.furnishing === 'Fully Furnished') {
      tips.push('Highlight furniture quality and appliance brands â€” clients paying for fully furnished expect premium fittings.');
    }

    // Nearby sectors
    const NEARBY = {
      '89': '88, 90, 84, 85', '88': '89, 90, 84', '84': '83, 85, 82, 86, 89',
      '83': '82, 84, 81, 85', '82': '83, 81, 84, 80', '81': '82, 83, 86, 95',
      '90': '89, 91, 88, 86', '102': '103, 104, 99, 101', '107': '106, 108, 109, 102',
      '85': '84, 86, 83, 82, 89', '86': '85, 84, 89, 90, 81'
    };
    const nearSectors = NEARBY[sector] || '83, 84, 89';
    const nearbySectorAnalysis = `Sector ${sector} is adjacent to Sectors ${nearSectors}. These sectors have similar society profiles and comparable rental rates, making them excellent alternatives if the exact sector is unavailable.`;

    return { budgetAnalysis: budgetStatus, marketDemand: demand, agentTips: tips, nearbySectorAnalysis };
  }

  /**
   * Local WhatsApp message generation â€” professional broker pitch
   */
  cleanSectorLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'N/A';
    const match = raw.match(/(?:sector|sec)?\s*(\d+[a-z]?)/i);
    return match ? `Sector ${match[1]}` : raw.replace(/^sector\s+/i, 'Sector ');
  }

  cleanFurnishingLabel(value) {
    const text = String(value || '').trim().replace(/[()]/g, '').replace(/\s+/g, ' ');
    if (!text) return 'Furnishing not specified';
    if (/raw|bare|unfurnished/i.test(text)) return 'Unfurnished';
    if (/semi/i.test(text)) return 'Semi Furnished';
    if (/fully|full|furnished/i.test(text)) return 'Fully Furnished';
    return text;
  }

  buildRequirementLabel(requirement) {
    const parts = [];
    if (requirement.bhk) parts.push(`${requirement.bhk} BHK`);
    if (requirement.sector) parts.push(this.cleanSectorLabel(requirement.sector));
    if (requirement.budget) parts.push(`budget Rs ${Number(requirement.budget).toLocaleString('en-IN')}`);
    if (requirement.furnishing) parts.push(this.cleanFurnishingLabel(requirement.furnishing));
    return parts.length > 0 ? parts.join(', ') : 'your rental requirement';
  }

  localWhatsApp(requirement, matches, brokerName, agencyName) {
    const validMatches = matches.filter(p => Number(p.rent || 0) > 0);
    const requirementLabel = this.buildRequirementLabel(requirement);

    if (validMatches.length === 0) {
      return `Hello Sir/Ma'am,\n\nThank you for sharing ${requirementLabel}. I am checking fresh inventory and will share suitable options shortly.\n\nRegards,\n*${brokerName}*\n*${agencyName}*`;
    }

    let msg = `Hello!\n\nAs per *${requirementLabel}*, here are the best available options:\n\n`;

    validMatches.forEach((p, idx) => {
      const projectName = p.projectName || p.propertyName || 'Property';
      const rent = Number(p.rent || 0).toLocaleString('en-IN');

      msg += `*Option ${idx + 1}: ${projectName}*\n`;
      msg += `Location: ${this.cleanSectorLabel(p.sector)}\n`;
      msg += `Type: ${p.bhk || 'N/A'} BHK ${p.propertyType || 'Apartment'}\n`;
      msg += `Furnishing: ${this.cleanFurnishingLabel(p.furnishing)}\n`;
      msg += `Rent: *Rs ${rent}/month*\n`;
      if (p.area) msg += `Area: ${p.area}\n`;
      if (p.floor) msg += `Floor: ${p.floor}\n`;
      msg += `\n`;
    });

    msg += `Site visit ka convenient time bata dijiye, main viewing arrange kar deta hoon.\n\n`;
    msg += `Regards,\n*${brokerName}*\n*${agencyName}*`;

    return msg;
  }

  // Keep backward-compat names for controller fallback calls
  mockGenerateResponse(requirement, matches, brokerName, agencyName) {
    return this.localWhatsApp(requirement, matches, brokerName, agencyName);
  }

  mockInsights(requirement, matches) {
    return this.localInsights(requirement, matches);
  }
}

module.exports = new GeminiService();


