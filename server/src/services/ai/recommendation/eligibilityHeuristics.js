/**
 * Text-based domain heuristics for targeting criteria (gender, reserved categories,
 * service/trade occupations) that may not be captured in structured scheme columns.
 */

export const checkTextGenderHeuristics = (schemeText, userGender) => {
  const conflicts = [];
  if (userGender === "male") {
    if (
      /\b(?:widow|widows|maternity|pregnan(?:t|cy)|girl child|women in distress)\b/.test(schemeText) ||
      /\b(?:only|exclusively|solely)\s+(?:for\s+)?(?:women|woman|female|girls?)\b/.test(schemeText) ||
      /\b(?:women|woman|female)\s+(?:entrepreneurs?|applicants?|beneficiaries|students?|founders?)\b/.test(schemeText)
    ) {
      conflicts.push("female_targeted_scheme");
    }
  }
  return conflicts;
};

export const checkTextReservedCasteHeuristics = (titleAndTags, userCategory) => {
  const conflicts = [];
  if (userCategory === "general") {
    const reservedOnlyPattern =
      /\b(?:sc(?:\s*(?:&|and|\/)\s*st)?|st|scheduled caste(?:s)?|scheduled tribes?|obcs?|ebcs?|bcs?|backward classes?|minorities)\b/;

    if (reservedOnlyPattern.test(titleAndTags)) {
      conflicts.push("reserved_category_only");
    }
  }

  const explicitReservedTarget =
    /\b(?:scheduled castes?|sc students?|\bsc\b|scheduled tribes?|st students?|\bst\b|obc students?|\bobc\b|ebc students?|\bebc\b|backward classes?|minority students?)\b/.exec(titleAndTags);
  if (explicitReservedTarget) {
    const label = explicitReservedTarget[0];
    const target = /scheduled caste|\bsc\b/.test(label)
      ? "sc"
      : /scheduled tribe|\bst\b/.test(label)
      ? "st"
      : /\bobc\b|backward class/.test(label)
      ? "obc"
      : /\bebc\b/.test(label)
      ? "ebc"
      : "minority";
    if (userCategory !== target) {
      conflicts.push("reserved_category_only");
    }
  }
  return conflicts;
};

export const checkTextTargetGroupHeuristics = (titleAndTags, rawMessage, profile) => {
  const conflicts = [];
  const targetRules = [
    {
      pattern: /\b(?:safai karamchari|sanitation worker|scavenger)\b/i,
      allowed: /\b(?:safai karamchari|sanitation worker|scavenger)\b/i.test(rawMessage),
    },
    {
      pattern: /\b(?:unorganised|unorganized)\s+(?:sector\s+)?workers?|\bcrafts(?:wo)?men\b/i,
      allowed: profile.occupation === "worker" || /\b(?:unorganised|unorganized)\s+(?:sector\s+)?workers?|\bcrafts(?:wo)?men\b/i.test(rawMessage),
    },
    {
      pattern: /\b(?:construction worker|building worker|registered construction labourer)\b/i,
      allowed: /\b(?:construction worker|building worker|labou?rer|mazdoor)\b/i.test(rawMessage),
    },
    {
      pattern: /\b(?:ex[- ]servicemen|ex[- ]serviceman|veteran)\b/i,
      allowed: /\b(?:ex[- ]servicemen|ex[- ]serviceman|veteran|army|navy|air force)\b/i.test(rawMessage),
    },
    {
      pattern: /\b(?:central armed police|police force personnel|paramilitary personnel)\b/i,
      allowed: /\b(?:central armed police|police force|paramilitary)\b/i.test(rawMessage),
    },
    {
      pattern: /\b(?:farmer|agricultural worker|cultivator)\b/i,
      allowed: profile.occupation === "farmer" || /\b(?:farmer|farming|agriculture)\b/i.test(rawMessage),
    },
    {
      pattern: /\b(?:teachers?|lecturers?)\b/i,
      allowed: /\b(?:teachers?|lecturers?)\b/i.test(rawMessage),
    },
  ];

  if (targetRules.some(({ pattern, allowed }) => pattern.test(titleAndTags) && !allowed)) {
    conflicts.push("target_group_mismatch");
  }
  return conflicts;
};
