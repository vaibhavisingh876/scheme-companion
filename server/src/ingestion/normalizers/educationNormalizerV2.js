import prisma from "../../config/prisma.js";
import { fileURLToPath } from "url";

// =========================================================
// BASIC HELPERS
// =========================================================

const normalizeText = (text = "") => {
  return String(text)
    .replace(/&amp;amp;/gi, "&")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeForMatching = (text = "") =>
  normalizeText(text).toLowerCase();

const addUnique = (arr, value) => {
  if (value && !arr.includes(value)) {
    arr.push(value);
  }
};

// =========================================================
// CLAUSE SPLITTING
// =========================================================

const splitClauses = (text = "") => {
  if (!text) return [];

  return normalizeText(text)
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\n+/)
    .flatMap((line) =>
      line.split(
        /(?=\s*(?:[-•▪◦]|\d+[.)]|\([a-z]\)|\([ivxlcdm]+\))\s+)/i
      )
    )
    .map((clause) =>
      clause
        .replace(
          /^\s*(?:[-•▪◦]|\d+[.)]|\([a-z]\)|\([ivxlcdm]+\))\s*/i,
          ""
        )
        .trim()
    )
    .filter(Boolean);
};

// =========================================================
// COMMON NEGATIVE CLAUSE
// =========================================================

const isNegativeClause = (text = "") => {
  return /\b(?:not eligible|ineligible|not entitled|not admissible|shall not be eligible|will not be eligible|not allowed|not covered|not permitted)\b/i.test(
    text
  );
};

// =========================================================
// EDUCATION
// =========================================================

const EDUCATION_PATTERNS = [
  [
    "5th",
    /\b(?:class\s+v\b|class\s+5(?:th)?|5th(?:\s+(?:standard|class|grade|std))?|v\s+standard)\b/i,
  ],
  [
    "8th",
    /\b(?:class\s+viii\b|class\s+8(?:th)?|8th(?:\s+(?:standard|class|grade|std))?|viii\s+standard)\b/i,
  ],
  [
    "10th",
    /\b(?:class\s+x\b|class\s+10(?:th)?|10th(?:\s+(?:standard|class|grade|std))?|matric(?:ulation)?|metric|sslc|x\s+standard)\b/i,
  ],
  [
    "11th",
    /\b(?:class\s+xi\b|class\s+11(?:th)?|11th(?:\s+(?:standard|class|grade|std))?|xi\s+standard)\b/i,
  ],
  [
    "12th",
    /\b(?:class\s+xii\b|class\s+12(?:th)?|12th(?:\s+(?:standard|class|grade|std))?|xii\s+standard|higher\s+secondary|senior\s+secondary|intermediate|hsc|puc|10\s*\+\s*2)\b/i,
  ],
  ["diploma", /\b(?:diploma|polytechnic)\b/i],
  [
    "graduate",
    /\b(?:graduat(?:e|ed|ion)|undergraduate|bachelor(?:'s)?(?:\s+degree)?)\b/i,
  ],
  [
    "post graduate",
    /\b(?:post[\s-]?graduat(?:e|ed|ion)|post[\s-]?graduate|master(?:'s)?(?:\s+degree)?|masters?)\b/i,
  ],
  ["PhD", /\b(?:ph\.?\s*d\.?|phd|doctorate|doctoral)\b/i],
];

const QUALIFICATION_PATTERNS = [
  ["B.Tech", /\bB\.\s*Tech\b/i],
  ["M.Tech", /\bM\.\s*Tech\b/i],
  ["B.E.", /\bB\.\s*E\./i],
  ["M.E.", /\bM\.\s*E\./i],
  ["B.Sc", /\bB\.\s*Sc\.?/i],
  ["M.Sc", /\bM\.\s*Sc\.?/i],
  ["B.Com", /\bB\.\s*Com\.?/i],
  ["M.Com", /\bM\.\s*Com\.?/i],
  ["BCA", /\bBCA\b/i],
  ["MCA", /\bMCA\b/i],
  ["BBA", /\bBBA\b/i],
  ["MBA", /\bMBA\b/i],
  ["B.Ed", /\bB\.\s*Ed\.?/i],
  ["M.Ed", /\bM\.\s*Ed\.?/i],
  ["B.Pharm", /\bB\.\s*Pharm\.?/i],
  ["M.Pharm", /\bM\.\s*Pharm\.?/i],
  ["D.Pharm", /\bD\.\s*Pharm\.?/i],
  ["LLB", /\bLLB\b/i],
  ["LL.M", /\bLL\.\s*M\.?/i],
  ["MBBS", /\bMBBS\b/i],
  ["BDS", /\bBDS\b/i],
  ["MDS", /\bMDS\b/i],
];

const isOtherPersonsEducation = (text = "") => {
  return (
    /\b(?:child(?:ren)?|son|daughter|dependent|spouse|husband|wife|ward)(?:'s)?\s+(?:education|studies|schooling|qualification|degree|college|school)\b/i.test(
      text
    ) ||
    /\b(?:education|studies|schooling|qualification|degree)\s+of\s+(?:the\s+)?(?:child(?:ren)?|son|daughter|dependent|spouse|ward)\b/i.test(
      text
    )
  );
};

const isCurrentEducation = (text = "") => {
  return /\b(?:studying|pursuing|enrolled|currently studying|currently pursuing|final year|student of)\b/i.test(
    text
  );
};

const isCompletedEducation = (text = "") => {
  return /\b(?:completed|passed|obtained|possesses|holding|graduated|having passed|qualified)\b/i.test(
    text
  );
};

const isPreferredEducation = (text = "") => {
  return /\b(?:preference|preferred|desirable)\b/i.test(text);
};

const extractEducation = (clauses = []) => {
  const result = {
    status: "not_specified",
    completedLevels: [],
    currentLevels: [],
    currentRanges: [],
    fundedLevels: [],
    preferredLevels: [],
    specificQualifications: [],
    rules: [],
  };

  for (const clause of clauses) {
    const text = normalizeText(clause);

    if (!text) continue;
    if (isNegativeClause(text)) continue;
    if (isOtherPersonsEducation(text)) continue;

    const levels = [];
    const qualifications = [];

    for (const [level, regex] of EDUCATION_PATTERNS) {
      if (regex.test(text)) {
        addUnique(levels, level);
      }
    }

    for (const [qualification, regex] of QUALIFICATION_PATTERNS) {
      if (regex.test(text)) {
        addUnique(qualifications, qualification);
      }
    }

    // "student", "course", "college", etc.
    // alone do not specify an education level.
    if (!levels.length && !qualifications.length) {
      continue;
    }

    const current = isCurrentEducation(text);
    const completed = isCompletedEducation(text);
    const preferred = isPreferredEducation(text);

    if (preferred) {
      levels.forEach((level) => {
        addUnique(result.preferredLevels, level);
      });
    } else if (current) {
      levels.forEach((level) => {
        addUnique(result.currentLevels, level);

        if (completed) {
          addUnique(result.completedLevels, level);
        }
      });
    } else {
      // Bare requirements such as:
      // "8th standard", "matriculation", "10+2", "graduation"
      // are treated as completed-level requirements.
      levels.forEach((level) => {
        addUnique(result.completedLevels, level);
      });
    }

    qualifications.forEach((qualification) => {
      addUnique(result.specificQualifications, qualification);
    });

    result.rules.push({
      type: preferred ? "preference" : "requirement",
      field: "education",
      values: [...levels],
      specificQualifications: [...qualifications],
      evidence: text,
    });
  }

  if (
    result.completedLevels.length ||
    result.currentLevels.length ||
    result.currentRanges.length ||
    result.fundedLevels.length ||
    result.preferredLevels.length ||
    result.specificQualifications.length
  ) {
    result.status = "specific";
  }

  return result;
};

// =========================================================
// AGE
// =========================================================

const extractAge = (clauses = []) => {
  const result = {
    minAge: null,
    maxAge: null,
    rules: [],
  };

  for (const clause of clauses) {
    if (isNegativeClause(clause)) continue;

    let match = clause.match(
      /\b(?:age|aged)\s*(?:should be|must be|of)?\s*(\d{1,3})\s*(?:to|-)\s*(\d{1,3})\b/i
    );

    if (match) {
      result.minAge = Number(match[1]);
      result.maxAge = Number(match[2]);

      result.rules.push({
        type: "requirement",
        field: "age",
        min: result.minAge,
        max: result.maxAge,
        evidence: clause,
      });

      continue;
    }

    match = clause.match(
      /\b(?:age|aged)\s*(?:should be|must be|of)?\s*(?:at least|minimum)\s*(\d{1,3})\b/i
    );

    if (match) {
      result.minAge = Number(match[1]);

      result.rules.push({
        type: "requirement",
        field: "age",
        min: result.minAge,
        max: null,
        evidence: clause,
      });

      continue;
    }

    match = clause.match(
      /\b(?:age|aged)\s*(?:should be|must be|of)?\s*(?:not more than|maximum|below|under)\s*(\d{1,3})\b/i
    );

    if (match) {
      result.maxAge = Number(match[1]);

      result.rules.push({
        type: "requirement",
        field: "age",
        min: null,
        max: result.maxAge,
        evidence: clause,
      });
    }
  }

  return result;
};

// =========================================================
// GENDER
// =========================================================

const extractGender = (clauses = []) => {
  const result = {
    values: [],
    rules: [],
  };

  for (const clause of clauses) {
    if (isNegativeClause(clause)) continue;

    const values = [];

    if (/\b(?:female|woman|women|girl|girls|lady|ladies)\b/i.test(clause)) {
      addUnique(values, "female");
    }

    if (/\b(?:male|man|men|boy|boys)\b/i.test(clause)) {
      addUnique(values, "male");
    }

    if (!values.length) continue;

    values.forEach((value) => {
      addUnique(result.values, value);
    });

    result.rules.push({
      type: "requirement",
      field: "gender",
      values,
      evidence: clause,
    });
  }

  return result;
};

// =========================================================
// CATEGORY
// =========================================================

const extractCategory = (clauses = []) => {
  const result = {
    values: [],
    rules: [],
  };

  const categories = [
    ["SC", /\bSC\b|scheduled caste/i],
    ["ST", /\bST\b|scheduled tribe/i],
    ["OBC", /\bOBC\b|other backward classes/i],
    ["EWS", /\bEWS\b|economically weaker section/i],
    ["General", /\bgeneral category\b|\bopen category\b/i],
  ];

  for (const clause of clauses) {
    if (isNegativeClause(clause)) continue;

    const values = [];

    for (const [label, regex] of categories) {
      if (regex.test(clause)) {
        addUnique(values, label);
      }
    }

    if (!values.length) continue;

    values.forEach((value) => {
      addUnique(result.values, value);
    });

    result.rules.push({
      type: "requirement",
      field: "category",
      values,
      evidence: clause,
    });
  }

  return result;
};

// =========================================================
// INCOME
// =========================================================

const extractIncome = (clauses = []) => {
  const result = {
    minIncome: null,
    maxIncome: null,
    currency: "INR",
    rules: [],
  };

  for (const clause of clauses) {
    if (isNegativeClause(clause)) continue;

    const match = clause.match(
      /\b(?:annual|yearly|family|household|parental)?\s*income\b[^₹\d]{0,40}(?:₹|rs\.?|inr)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(lakh|lakhs|crore|crores|thousand|k)?/i
    );

    if (!match) continue;

    let value = Number(String(match[1]).replace(/,/g, ""));

    const unit = (match[2] || "").toLowerCase();

    if (unit.includes("lakh")) {
      value *= 100000;
    } else if (unit.includes("crore")) {
      value *= 10000000;
    } else if (unit.includes("thousand") || unit === "k") {
      value *= 1000;
    }

    let min = null;
    let max = null;

    if (
      /\b(?:below|less than|not more than|maximum|up to|upto|does not exceed)\b/i.test(
        clause
      )
    ) {
      max = value;
      result.maxIncome = value;
    } else if (
      /\b(?:above|more than|minimum|at least)\b/i.test(clause)
    ) {
      min = value;
      result.minIncome = value;
    }

    result.rules.push({
      type: "requirement",
      field: "income",
      min,
      max,
      evidence: clause,
    });
  }

  return result;
};

// =========================================================
// TEST: FIRST 20 REAL SCHEMES FROM DATABASE
// =========================================================

const runEducationTest = async () => {
  try {
    const schemes = await prisma.scheme.findMany({
      orderBy: {
        id: "asc",
      },
      take: 20,
    });

    console.log(
      `\nTesting ${schemes.length} fixed real schemes from database...\n`
    );

    for (const scheme of schemes) {
      const eligibility =
        scheme.eligibility ||
        scheme.eligibilityCriteria ||
        "";

      const clauses = splitClauses(eligibility);
      const education = extractEducation(clauses);

      console.log("========================================");
      console.log(`SCHEME: ${scheme.name}`);
      console.log("RAW:", eligibility);
      console.log("EDUCATION:");
      console.log(JSON.stringify(education, null, 2));
    }
  } catch (error) {
    console.error("Education test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
};

// =========================================================
// RUN TEST WHEN FILE IS EXECUTED DIRECTLY
// =========================================================

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  runEducationTest();
}