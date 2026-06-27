/**
 * Scoring helpers for matching tenant requirements with owner inventory rows.
 * The sheet data is often messy, so every comparison goes through a small
 * normalization layer before scoring.
 */
const NEARBY_SECTORS = {
  // Golf Course Extension Road cluster from the Gurgaon sector map.
  "58": ["59", "60", "61", "62", "63"],
  "59": ["58", "60", "61", "62", "63"],
  "60": ["58", "59", "61", "62", "63", "64"],
  "61": ["58", "59", "60", "62", "63", "64", "65"],
  "62": ["58", "59", "60", "61", "63", "64", "65"],
  "63": ["58", "59", "60", "61", "62", "64", "65", "66"],
  "64": ["60", "61", "62", "63", "65", "66", "67"],
  "65": ["61", "62", "63", "64", "66", "67"],
  "66": ["63", "64", "65", "67", "68", "69"],
  "67": ["64", "65", "66", "68", "69"],
  // SPR / Sohna Road cluster.
  "68": ["66", "67", "69", "70", "71"],
  "69": ["66", "67", "68", "70", "71", "72"],
  "70": ["68", "69", "71", "72", "73", "76"],
  "71": ["68", "69", "70", "72", "73", "74"],
  "72": ["69", "70", "71", "73", "74"],
  "73": ["70", "71", "72", "74", "75", "76"],
  "74": ["71", "72", "73", "75", "76"],
  "75": ["73", "74", "76", "77"],
  "76": ["70", "73", "74", "75", "77", "78"],
  // New Gurgaon / Manesar-side cluster.
  "77": ["75", "76", "78", "79", "82", "83"],
  "78": ["76", "77", "79", "80", "81", "82"],
  "79": ["77", "78", "80", "81", "82"],
  "80": ["78", "79", "81", "82", "83"],
  "89": ["88", "90", "84", "85", "86", "37c"],
  "88": ["89", "90", "84", "37c"],
  "84": ["83", "85", "82", "86", "89"],
  "83": ["82", "84", "81", "85"],
  "82": ["83", "81", "84", "85", "80"],
  "81": ["80", "82", "83", "86", "95", "82a"],
  "87": ["86", "90", "91", "92"],
  "90": ["89", "91", "88", "86", "87", "92"],
  "91": ["87", "90", "92", "93"],
  "92": ["87", "90", "91", "93", "95"],
  "93": ["91", "92", "94", "95"],
  "94": ["88", "89", "93", "95"],
  "95": ["81", "92", "93", "94", "96", "97", "98"],
  "96": ["95", "97", "98"],
  "97": ["95", "96", "98"],
  "98": ["95", "96", "97", "99"],
  "99": ["88", "98", "100", "101", "102"],
  // Dwarka Expressway cluster.
  "100": ["99", "101", "102", "104"],
  "101": ["99", "100", "102", "103", "104"],
  "102": ["99", "100", "101", "103", "104", "106"],
  "103": ["101", "102", "104", "105", "106"],
  "104": ["100", "101", "102", "103", "105", "106"],
  "105": ["103", "104", "106", "109", "110"],
  "106": ["102", "103", "104", "105", "107", "108", "109", "110"],
  "107": ["106", "108", "109", "102", "103"],
  "108": ["106", "107", "109"],
  "109": ["105", "106", "107", "108", "110", "112"],
  "110": ["105", "106", "109", "111", "112"],
  "111": ["110", "112", "113"],
  "112": ["109", "110", "111", "113"],
  "113": ["111", "112", "114", "115"],
  "114": ["113", "115"],
  "115": ["113", "114"],
  "85": ["84", "86", "83", "82", "89"],
  "86": ["85", "84", "89", "90", "81"]
};

function addNearbyPair(sectorA, sectorB) {
  const a = String(sectorA).toLowerCase();
  const b = String(sectorB).toLowerCase();
  if (!NEARBY_SECTORS[a]) NEARBY_SECTORS[a] = [];
  if (!NEARBY_SECTORS[b]) NEARBY_SECTORS[b] = [];
  if (!NEARBY_SECTORS[a].includes(b)) NEARBY_SECTORS[a].push(b);
  if (!NEARBY_SECTORS[b].includes(a)) NEARBY_SECTORS[b].push(a);
}

function addNearbyGroup(sectors, windowSize = 2) {
  const normalized = sectors.map(sector => String(sector).toLowerCase());
  normalized.forEach((sector, index) => {
    for (let offset = 1; offset <= windowSize; offset++) {
      const next = normalized[index + offset];
      if (next) addNearbyPair(sector, next);
    }
  });
}

// Road-wise Gurgaon clusters inferred from the supplied sector maps.
// The window keeps suggestions geographically tight while still covering
// nearby road-belt alternatives when the exact sector is unavailable.
addNearbyGroup(["1", "2", "3", "3a", "4", "5", "6", "7", "8", "9", "9a", "9b", "10", "10a", "11", "12", "12a", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "23a"], 3); // Old Gurgaon
addNearbyGroup(["24", "25", "25a", "26", "26a", "27", "28", "29", "30", "31", "32", "33", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "51", "52"], 3); // NH8 / Sohna Road central belt
addNearbyGroup(["26", "26a", "27", "28", "42", "43", "53", "54", "55", "56", "57"], 2); // Golf Course Road
addNearbyGroup(["58", "59", "60", "61", "62", "63", "63a", "64", "65", "66", "67", "67a"], 3); // Golf Course Extension Road
addNearbyGroup(["68", "69", "70", "70a", "71", "72", "72a", "73", "74", "74a", "75", "75a", "76"], 3); // SPR / Sohna Road
addNearbyGroup(["77", "78", "79", "79a", "79b", "80", "81", "81a", "82", "82a", "83", "84", "85", "86", "87", "88", "88a", "88b", "89", "89a", "89b", "90", "91", "92", "93", "94", "95", "95a", "95b", "96", "97", "98"], 3); // New Gurgaon / Manesar side
addNearbyGroup(["36", "36a", "36b", "37", "37a", "37b", "37c", "37d", "88a", "88b", "89a", "89b", "99", "99a", "100", "101", "102", "102a", "103", "104", "105", "106", "107", "108", "109", "110", "110a", "111", "112", "113", "114", "115"], 3); // Dwarka Expressway / Pataudi Road

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'sector', 'sec', 'gurgaon', 'gurugram', 'residences',
  'residence', 'floors', 'floor', 'apartment', 'apartments', 'homes', 'home',
  'flat', 'property', 'society'
]);

const CONFIG_WORDS = new Set([
  'bhk', 'rk', 'hk', 'bedroom', 'bedrooms', 'room', 'rooms',
  'rent', 'budget', 'lakh', 'lac', 'l', 'k', 'thousand', 'hazaar', 'hazar',
  'fully', 'semi', 'unfurnished', 'furnished', 'furnishing',
  'family', 'bachelor', 'bachelors', 'boys', 'girls', 'single', 'married',
  'apartment', 'villa', 'floor', 'independent', 'builder', 'penthouse',
  'need', 'want', 'require', 'requirement', 'search', 'find', 'show', 'give', 'me', 'in', 'under', 'for', 'at', 'near',
  'chahiye', 'chahie', 'hai', 'h', 'ka', 'ki', 'ke', 'andar', 'tak', 'below', 'upto', 'up', 'to'
]);

const HINDI_WORDS = [
  [/सस्ते|सस्ता|कम\s*बजट|किफायती/g, ' cheap budget affordable '],
  [/महंगा|प्रीमियम|लक्जरी/g, ' premium luxury '],
  [/फ्लैट|अपार्टमेंट/g, ' flat apartment '],
  [/कमरा|रूम/g, ' room '],
  [/परिवार|फैमिली|घरवाले/g, ' family '],
  [/कुंवारे|बैचलर|लड़के|लडके|लड़कियां|लडकियां/g, ' bachelors '],
  [/फर्निश्ड|फर्नीश्ड/g, ' furnished '],
  [/सेमी/g, ' semi '],
  [/अनफर्निश्ड|खाली/g, ' unfurnished '],
  [/पार्क/g, ' park '],
  [/सामने|फेसिंग/g, ' facing '],
  [/सेक्टर/g, ' sector '],
  [/चाहिए|चाहिये|चाइए/g, ' chahiye '],
  [/हजार|हज़ार/g, ' hazaar '],
  [/लाख/g, ' lakh '],
  [/एक/g, ' 1 '],
  [/दो/g, ' 2 '],
  [/तीन/g, ' 3 '],
  [/चार/g, ' 4 '],
  [/पांच|पाँच/g, ' 5 ']
];

const INTENT_GROUPS = [
  {
    name: 'family',
    query: ['family', 'parivar', 'married'],
    positive: ['family', 'family preferred', 'families', 'married'],
    negative: ['bachelor only', 'bachelors only', 'boys only']
  },
  {
    name: 'bachelors',
    query: ['bachelor', 'bachelors', 'boys', 'girls', 'single'],
    positive: ['bachelor', 'bachelors', 'boys', 'girls', 'single allowed'],
    negative: ['family only', 'families only', 'no bachelor', 'no bachelors']
  },
  {
    name: 'park facing',
    query: ['park facing', 'park view', 'green view'],
    positive: ['park facing', 'park view', 'green view', 'garden facing'],
    negative: []
  },
  {
    name: 'cheap',
    query: ['cheap', 'affordable', 'budget', 'pocket friendly', 'low rent'],
    positive: ['affordable', 'budget', 'pocket friendly', 'low maintenance', 'cheap'],
    negative: ['luxury', 'premium']
  }
];

function expandHindiText(value) {
  let text = String(value || '').toLowerCase();
  HINDI_WORDS.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text;
}

function normalizeText(value) {
  return expandHindiText(value)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getQuerySearchTerms(rawText) {
  return normalizeText(rawText)
    .split(' ')
    .filter(token => token.length > 2 && !STOP_WORDS.has(token) && !CONFIG_WORDS.has(token) && !/^\d+$/.test(token) && !/^\d+(?:bhk|rk|hk|k)$/.test(token));
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

function tokenSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) return 0.92;
  if (a[0] !== b[0]) return 0;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshtein(a, b);
  if (a.substring(0, 2) === b.substring(0, 2) && maxLen >= 5 && distance <= 2) return 0.82;
  return 1 - (distance / maxLen);
}

function scoreSearchTerms(queryTerms, property) {
  if (queryTerms.length === 0) {
    return { score: 100, explanation: 'No search terms' };
  }

  const propText = normalizeText(`${property.projectName || ''} ${property.propertyName || ''} ${property.sector || ''} ${property.additionalNotes || ''}`);
  const propTokens = propText.split(' ').filter(Boolean);

  let points = 0;
  const hits = [];
  queryTerms.forEach(term => {
    if (propText.includes(term)) {
      points += 1;
      hits.push(term);
      return;
    }

    const best = Math.max(...propTokens.map(pToken => tokenSimilarity(term, pToken)), 0);
    if (best >= 0.78) {
      points += best;
      hits.push(term);
    }
  });

  const ratio = points / queryTerms.length;
  if (ratio > 0) {
    return { score: Math.round(Math.min(ratio, 1) * 100), explanation: `Search terms matched: ${hits.join(', ')}` };
  }

  return { score: 0, explanation: 'Search terms did not match property' };
}

function normalizeSector(value) {
  const text = normalizeText(value);
  if (!text) return '';
  const match = text.match(/(?:sector|sec)?\s*(\d+[a-z]?)/i);
  return match ? match[1].toLowerCase() : text;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const raw = expandHindiText(value).replace(/,/g, '').trim();
  const lacMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:l|lac|lakh)/);
  if (lacMatch) return Math.round(parseFloat(lacMatch[1]) * 100000);

  const kMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:k|thousand|hazaar|hazar)/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);

  const plain = raw.match(/\d+(?:\.\d+)?/);
  if (!plain) return null;

  const parsed = parseFloat(plain[0]);
  if (!Number.isFinite(parsed)) return null;
  return parsed < 1000 && /rent|budget|rs|inr|under|below|upto|tak|andar/.test(raw) ? parsed * 1000 : parsed;
}

function normalizeFurnishing(value) {
  const text = normalizeText(value);
  if (!text) return '';
  if (text.includes('semi')) return 'semi furnished';
  if (text.includes('fully') || text === 'furnished' || text.includes('full furnished')) return 'fully furnished';
  if (text.includes('unfurnished') || text.includes('bare')) return 'unfurnished';
  return text;
}

function getProjectTokens(value) {
  return normalizeText(value)
    .split(' ')
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

function tokenOverlapScore(requestProject, property) {
  const reqTokens = getProjectTokens(requestProject);
  if (reqTokens.length === 0) return { score: 100, explanation: 'No specific project requested' };

  const targetTokens = getProjectTokens(`${property.projectName || ''} ${property.propertyName || ''} ${property.additionalNotes || ''}`);
  const hits = [];
  const points = reqTokens.reduce((sum, token) => {
    const best = Math.max(...targetTokens.map(target => tokenSimilarity(token, target)), 0);
    if (best >= 0.78) hits.push(token);
    return sum + (best >= 0.78 ? best : 0);
  }, 0);
  const ratio = points / reqTokens.length;

  if (ratio >= 0.95) return { score: 100, explanation: `Project match: ${requestProject}` };
  if (ratio >= 0.67) return { score: 75, explanation: `Partial project match (${hits.join(', ')})` };
  if (hits.length > 0) return { score: 35, explanation: `Only brand/token matched (${hits.join(', ')})` };
  return { score: 20, explanation: 'Different project name' };
}

function isAvailableStatus(value) {
  const text = normalizeText(value || 'available');
  if (!text) return true;
  if (['not available', 'unavailable', 'rented', 'sold', 'hold', 'blocked', 'no'].some(status => text.includes(status))) {
    return false;
  }
  return ['available', 'vacant', 'fresh', 'ready', 'ready to move', 'yes'].some(status => text.includes(status));
}

function isNearbySector(sectorA, sectorB) {
  const sA = normalizeSector(sectorA);
  const sB = normalizeSector(sectorB);
  if (!sA || !sB) return false;
  if (sA === sB) return true;

  const nearbyA = NEARBY_SECTORS[sA] || [];
  const nearbyB = NEARBY_SECTORS[sB] || [];
  return nearbyA.includes(sB) || nearbyB.includes(sA);
}

function scoreSector(req, property) {
  if (!req.sector && !req.projectName) {
    return { score: 100, explanation: 'No specific sector requested' };
  }

  const reqSector = normalizeSector(req.sector);
  const propSector = normalizeSector(property.sector || property.sheetName);

  if (!reqSector || ['gurgaon', 'gurugram'].includes(reqSector)) {
    return { score: 85, explanation: 'Gurgaon-wide requirement' };
  }
  if (reqSector === propSector) {
    return { score: 100, explanation: `Exact Sector ${propSector} match` };
  }
  if (isNearbySector(reqSector, propSector)) {
    return { score: 72, explanation: `Nearby option: Sector ${propSector}` };
  }
  return { score: 15, explanation: `Different sector: ${propSector || 'not listed'}` };
}

function scoreBudget(reqBudgetRaw, propertyRentRaw) {
  const budget = parseNumber(reqBudgetRaw);
  const rent = parseNumber(propertyRentRaw);

  if (!budget) return { score: 100, explanation: 'No budget specified' };
  if (!rent) return { score: 40, explanation: 'Rent missing in sheet' };

  if (rent <= budget) {
    const savings = budget - rent;
    return {
      score: 100,
      explanation: savings > 0 ? `Rs ${savings.toLocaleString('en-IN')} below budget` : 'Exactly on budget'
    };
  }

  const overPercent = (rent - budget) / budget;
  if (overPercent <= 0.05) {
    return { score: 85, explanation: `Only ${Math.round(overPercent * 100)}% above budget` };
  }
  if (overPercent <= 0.10) {
    return { score: 65, explanation: `${Math.round(overPercent * 100)}% above budget (within 10% limit)` };
  }
  return { score: 0, explanation: 'Too far above budget (exceeds 10% limit)' };
}

function scoreBhk(reqBhkRaw, propBhkRaw) {
  const reqBhk = parseNumber(reqBhkRaw);
  const propBhk = parseNumber(propBhkRaw);

  if (!reqBhk) return { score: 100, explanation: 'No BHK specified' };
  if (!propBhk) return { score: 35, explanation: 'BHK missing in sheet' };
  if (reqBhk === propBhk) return { score: 100, explanation: 'Exact BHK match' };
  if (Math.abs(reqBhk - propBhk) === 1) {
    return { score: 45, explanation: propBhk > reqBhk ? 'One BHK larger' : 'One BHK smaller' };
  }
  return { score: 0, explanation: `${propBhk} BHK does not fit ${reqBhk} BHK` };
}

function inferUnitType(...values) {
  const text = normalizeText(values.filter(Boolean).join(' '));
  // Check for explicit RK markers first – these are unambiguous
  if (/\b(?:1\s*)?rk\b/.test(text) || text.includes('room kitchen') || text.includes('studio')) return 'rk';
  // BHK checked BEFORE HK — "bhk" contains "hk", so we must match "bhk" first
  if (/\bbhk\b/.test(text) || text.includes('bedroom')) return 'bhk';
  // HK is a standalone word — will not match inside "bhk" due to word boundary
  if (/\bhk\b/.test(text)) return 'hk';
  if (text.includes('room set')) return 'room set';
  return '';
}

/**
 * Determine the effective unit type of a property from all available fields.
 * If no label is found we default to 'bhk' since standard apartments never
 * carry an RK label – we must NOT let an unlabelled property match an RK query.
 */
function inferPropertyUnitType(property) {
  const explicit = inferUnitType(
    property.bhkLabel,
    property.bhk,
    property.propertyName,
    property.projectName,
    property.propertyType,
    property.additionalNotes
  );
  // If there is a numeric BHK value in the sheet (1, 2, 3 …) and no RK label,
  // treat it as a standard BHK apartment.
  if (!explicit) {
    const bhkNum = parseNumber(property.bhk);
    if (bhkNum && bhkNum >= 1) return 'bhk';
  }
  return explicit || 'bhk'; // default to bhk rather than unknown
}

function scoreUnitType(req, property) {
  const reqType = normalizeText(req.unitType || inferUnitType(req.rawText, req.propertyType));

  // No specific unit-type constraint from the user – skip this dimension
  if (!reqType) return { score: 100, explanation: 'No unit type specified' };

  const propType = normalizeText(property.unitType || inferPropertyUnitType(property));

  if (reqType === propType) return { score: 100, explanation: `Exact ${reqType.toUpperCase()} match` };

  // RK ↔ studio are interchangeable
  if (reqType === 'rk' && propType === 'studio') return { score: 90, explanation: 'Studio alternative for RK' };
  if (reqType === 'studio' && propType === 'rk') return { score: 90, explanation: 'RK alternative for Studio' };

  // Strict: user asked for RK but property is BHK (or vice-versa) → hard block
  if ((reqType === 'rk' && propType === 'bhk') || (reqType === 'bhk' && propType === 'rk')) {
    return { score: 0, explanation: `${propType.toUpperCase()} does not match ${reqType.toUpperCase()} requirement` };
  }

  // BHK-to-BHK mismatches (e.g. hk vs bhk) – allow with penalty
  if (reqType === 'bhk') return { score: 100, explanation: 'Treating as standard BHK property' };

  return { score: 0, explanation: `${propType.toUpperCase()} does not fit ${reqType.toUpperCase()}` };
}

function scoreFurnishing(reqFurnRaw, propFurnRaw) {
  const reqFurn = normalizeFurnishing(reqFurnRaw);
  const propFurn = normalizeFurnishing(propFurnRaw);

  if (!reqFurn) return { score: 100, explanation: 'No furnishing preference' };
  if (!propFurn) return { score: 45, explanation: 'Furnishing missing in sheet' };
  if (reqFurn === propFurn) return { score: 100, explanation: 'Exact furnishing match' };
  if (reqFurn === 'semi furnished' && propFurn === 'fully furnished') {
    return { score: 90, explanation: 'Fully furnished upgrade' };
  }
  if (reqFurn === 'fully furnished' && propFurn === 'semi furnished') {
    return { score: 55, explanation: 'Semi furnished alternative' };
  }
  if (propFurn === 'unfurnished') return { score: 20, explanation: 'Unfurnished option' };
  return { score: 45, explanation: 'Different furnishing status' };
}

function scorePropertyType(reqTypeRaw, propTypeRaw) {
  const reqType = normalizeText(reqTypeRaw);
  const propType = normalizeText(propTypeRaw || 'apartment');
  if (!reqType) return { score: 100, explanation: 'No property type specified' };
  if (reqType === propType || propType.includes(reqType) || reqType.includes(propType)) {
    return { score: 100, explanation: 'Property type match' };
  }
  if (reqType.includes('floor') && propType.includes('builder')) {
    return { score: 85, explanation: 'Floor-style property' };
  }
  return { score: 45, explanation: `Different type: ${propType || 'not listed'}` };
}

function getRequestedIntents(req) {
  const raw = normalizeText(`${req.rawText || ''} ${req.tenantType || ''}`);
  return INTENT_GROUPS.filter(group => group.query.some(term => raw.includes(term)));
}

function scoreIntent(req, property) {
  const requested = getRequestedIntents(req);
  if (requested.length === 0) return { score: 100, explanation: 'No remarks intent requested' };

  const propText = normalizeText(`${property.additionalNotes || ''} ${property.furnishing || ''} ${property.propertyType || ''}`);
  let score = 0;
  const matched = [];
  const blocked = [];

  requested.forEach(group => {
    const hasNegative = group.negative.some(term => propText.includes(term));
    const hasPositive = group.positive.some(term => propText.includes(term));
    if (hasNegative) {
      blocked.push(group.name);
      return;
    }
    if (hasPositive) {
      matched.push(group.name);
      score += 100;
    } else {
      score += 65;
    }
  });

  if (blocked.length > 0) {
    return { score: 0, explanation: `Remarks conflict: ${blocked.join(', ')}` };
  }

  return {
    score: Math.round(score / requested.length),
    explanation: matched.length > 0 ? `Remarks matched: ${matched.join(', ')}` : 'Remarks do not confirm requested intent'
  };
}

function calculateMatch(req, property) {
  if (!isAvailableStatus(property.availability)) {
    return { score: 0, isMatch: false, breakdown: null, flags: ['Not available'] };
  }

  const sector = scoreSector(req, property);
  const project = tokenOverlapScore(req.projectName, property);
  const budget = scoreBudget(req.budget, property.rent);
  const bhk = scoreBhk(req.bhk, property.bhk);
  const furnishing = scoreFurnishing(req.furnishing, property.furnishing);
  const propertyType = scorePropertyType(req.propertyType, property.propertyType);
  const unitType = scoreUnitType(req, property);
  const intent = scoreIntent(req, property);

  const queryTerms = req.rawText ? getQuerySearchTerms(req.rawText) : [];
  const search = scoreSearchTerms(queryTerms, property);

  const weights = req.projectName
    ? { project: 0.21, sector: 0.17, budget: 0.21, bhk: 0.17, unitType: 0.06, furnishing: 0.07, propertyType: 0.03, search: 0.06, intent: 0.02 }
    : { project: 0.00, sector: 0.21, budget: 0.25, bhk: 0.19, unitType: 0.08, furnishing: 0.10, propertyType: 0.04, search: 0.10, intent: 0.03 };

  const totalScore = Math.round(
    (project.score * weights.project) +
    (sector.score * weights.sector) +
    (budget.score * weights.budget) +
    (bhk.score * weights.bhk) +
    (unitType.score * weights.unitType) +
    (furnishing.score * weights.furnishing) +
    (propertyType.score * weights.propertyType) +
    (search.score * weights.search) +
    (intent.score * weights.intent)
  );

  const sectorMismatch = req.sector && sector.score < 50;
  const searchMismatch = queryTerms.length > 0 && search.score === 0;
  const intentMismatch = intent.score === 0;
  const unitTypeMismatch = unitType.score === 0;
  const hardMismatch = bhk.score === 0 || budget.score === 0 || unitTypeMismatch || sectorMismatch || searchMismatch || intentMismatch || (req.projectName && project.score < 50 && sector.score < 50);
  const isMatch = totalScore >= 55 && !hardMismatch;

  const flags = [];
  if (budget.score < 70) flags.push(budget.explanation);
  if (sector.score < 80) flags.push(sector.explanation);
  if (project.score < 80 && req.projectName) flags.push(project.explanation);
  if (furnishing.score < 70) flags.push(furnishing.explanation);
  if (unitType.score < 70) flags.push(unitType.explanation);
  if (queryTerms.length > 0 && search.score < 80) flags.push(search.explanation);
  if (intent.score < 80) flags.push(intent.explanation);

  return {
    score: totalScore,
    isMatch,
    flags,
    breakdown: { project, sector, budget, bhk, unitType, furnishing, propertyType, search, intent }
  };
}

function rankListings(requirement, listings) {
  if (!requirement || !Array.isArray(listings) || listings.length === 0) return [];

  return listings
    .map(property => {
      const matchResult = calculateMatch(requirement, property);
      return {
        property,
        matchScore: matchResult.score,
        isMatch: matchResult.isMatch,
        breakdown: matchResult.breakdown,
        flags: matchResult.flags || []
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

function findMatches(requirement, listings) {
  return rankListings(requirement, listings).filter(res => res.isMatch);
}

module.exports = {
  calculateMatch,
  findMatches,
  rankListings,
  isNearbySector,
  normalizeSector,
  parseNumber,
  normalizeFurnishing,
  normalizeText,
  inferUnitType,
  inferPropertyUnitType
};


