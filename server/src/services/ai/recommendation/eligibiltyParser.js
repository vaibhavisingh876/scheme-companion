// services/recommendation/eligibilityParser.js

/**
 * Parses free-text eligibility to extract structured age and income limits.
 * Covers common Indian government scheme phrasings.
 * Returns { minAge, maxAge, minIncome, maxIncome } – numbers or null.
 */
export const parseEligibility = (eligibilityText) => {
  const result = {
    minAge: null,
    maxAge: null,
    minIncome: null,
    maxIncome: null,
  };

  if (!eligibilityText || typeof eligibilityText !== "string") return result;

  const text = eligibilityText.toLowerCase().replace(/\n/g, " ");

  // ----- AGE LIMITS -----

  // "60 years or above" / "60 years and above" / "above 60 years"
  const minAgePatterns = [
    /(\d+)\s*(?:\+?)\s*years?\s*(?:or|and|&)\s*above/i,
    /above\s*(\d+)\s*years?/i,
    /minimum\s*age\s*(?:of\s*)?(\d+)\s*years?/i,
    /at\s*least\s*(\d+)\s*years?\s*of\s*age/i,
  ];
  for (const pattern of minAgePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.minAge = parseInt(match[1], 10);
      break;
    }
  }

  // "below 60 years" / "not exceeding 60 years" / "up to 60 years"
  const maxAgePatterns = [
    /(?:up\s*to|upto|maximum|not\s*exceeding|below)\s*(\d+)\s*years?/i,
    /age\s*(?:should|must)\s*not\s*exceed\s*(\d+)\s*years?/i,
    /upper\s*age\s*limit\s*(?:is\s*)?(\d+)\s*years?/i,
  ];
  for (const pattern of maxAgePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.maxAge = parseInt(match[1], 10);
      break;
    }
  }

  // "between 18 and 35 years"
  const rangeMatch = text.match(
    /between\s*(\d+)\s*(?:and|to|-)\s*(\d+)\s*years/i
  );
  if (rangeMatch) {
    result.minAge = parseInt(rangeMatch[1], 10);
    result.maxAge = parseInt(rangeMatch[2], 10);
  }

  // ----- INCOME LIMITS -----

  // Helper to parse Indian number formats
  const parseIncomeValue = (str) => {
    if (!str) return null;
    const clean = str.replace(/[₹,\s]/g, "").toLowerCase();
    if (clean.includes("lakh")) {
      const lakhMatch = clean.match(/(\d+)\s*lakh/);
      return lakhMatch ? parseInt(lakhMatch[1], 10) * 100000 : null;
    }
    // "crore" not handled but could be added if needed
    const num = parseInt(clean, 10);
    return isNaN(num) ? null : num;
  };

  const incomePatterns = [
    /(?:income|annual\s*income)\s*(?:should\s*)?(?:not\s*exceed|less\s*than|below|maximum)\s*(?:₹\s*)?([\d,]+(?:\s*lakh)?)\b/i,
    /(?:not\s*exceeding|maximum\s*income)\s*(?:₹\s*)?([\d,]+(?:\s*lakh)?)\b/i,
    /income\s*limit\s*(?:₹\s*)?([\d,]+(?:\s*lakh)?)/i,
  ];

  for (const pattern of incomePatterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseIncomeValue(match[1]);
      if (val !== null && !isNaN(val)) {
        result.maxIncome = val;
        break;
      }
    }
  }

  // Minimum income is rare but could be added later

  return result;
};