/**
 * searchTextBuilder.js
 *
 * Builds the text used to generate vector embeddings for each scheme.
 * The quality of this text directly determines how well cosine-similarity
 * matching works when a user query is compared against stored embeddings.
 *
 * IMPROVEMENT LOG:
 * - Massively expanded inferKeywords: 20+ thematic blocks covering every major scheme type
 * - Added income/age context signals in the output text
 * - Repeats the scheme name and category for higher embedding weight
 * - Added English + Hindi synonym injection per theme to bridge Hinglish queries
 * - Added occupation, eligibility, and ministry as first-class fields
 * - Removed redundant whitespace collapsing that was eating signal
 */

// ── Thematic keyword sets injected based on scheme content ───────────────────
const THEME_INJECTIONS = [
  // ── Death / Breadwinner / Bereavement ────────────────────────────────────
  {
    test: /family benefit|death|deceased|breadwinner|bereaved|antim anudan|funeral|accidental death|natural death|shok|mrityu/i,
    keywords: [
      "death assistance breadwinner death family support widow support financial relief",
      "death grant funeral assistance accidental death benefit family benefit scheme",
      "mrityu sahayata antim anudan bereaved family compensation",
      "death of earning member family security benefit",
    ],
  },

  // ── Widow / Bereaved Women ────────────────────────────────────────────────
  {
    test: /widow|bereaved|vidhwa|patavya|husband.?died|husband.?dead|surviving spouse|death of husband|indira gandhi.*widow/i,
    keywords: [
      "widow pension widow assistance vidhwa pension bereaved wife support",
      "widow financial help deceased husband pension monthly allowance",
      "women in distress single women support akeli aurat madad",
      "widow scheme government support bereaved family survival benefit",
      "pati ke marne ke baad sahayata vidhwa yojana",
    ],
  },

  // ── Scholarship / Education Financial Assistance ──────────────────────────
  {
    test: /scholarship|student|education|fee|tuition|hostel|stipend|merit|post.?matric|pre.?matric|coaching|fellowship|inspire|kvpy/i,
    keywords: [
      "scholarship education support student benefit college assistance fee reimbursement",
      "tuition fee waiver hostel fee stipend merit scholarship financial aid",
      "post matric scholarship pre matric scholarship national scholarship",
      "education loan interest subsidy student financial assistance education grant",
      "chatravritti padhai madad school college fee subsidy coaching grant",
      "higher education support undergraduate postgraduate research fellowship",
    ],
  },

  // ── Medical / Health / Treatment ─────────────────────────────────────────
  {
    test: /health|medical|hospital|treatment|cancer|surgery|disease|illness|ayushman|pmjay|rashtriya arogya|dialysis|transplant|cardiac/i,
    keywords: [
      "medical treatment hospital assistance healthcare support patient benefit",
      "health insurance free treatment government hospital ayushman bharat pmjay",
      "cancer treatment surgery assistance critical illness support",
      "hospital financial aid medical reimbursement health card free medicine",
      "ilaaj sahayata dawai hospital free bimari madad niramaya",
      "dialysis kidney transplant heart surgery rare disease treatment",
    ],
  },

  // ── Farmer / Agriculture / Crops ─────────────────────────────────────────
  {
    test: /agriculture|farmer|crop|kisan|fasal|kheti|irrigation|fertilizer|tractor|pm kisan|soil|harvest|dairy|poultry|fisheries|livestock/i,
    keywords: [
      "farmer support crop assistance kisan yojana agriculture subsidy",
      "pm kisan samman nidhi fasal bima pradhan mantri crop insurance",
      "irrigation subsidy drip irrigation tractor loan soil health card",
      "agriculture equipment subsidy seed subsidy khaad subsidy pesticide",
      "dairy farming poultry livestock animal husbandry fisheries aquaculture",
      "kisan credit card kcc agriculture loan rural development subsidy",
      "crop insurance fasal bima pmfby natural calamity drought flood relief",
      "annadata krishak kheti khetibadi khaad beej sahayata",
    ],
  },

  // ── Startup / Entrepreneurship / MSME ─────────────────────────────────────
  {
    test: /startup|entrepreneur|business|msme|udyam|self.?employ|mudra|pmegp|stand up india|shop|trader|merchant|vyapar|dukaan/i,
    keywords: [
      "startup funding entrepreneurship support business loan msme scheme",
      "mudra loan pmegp self employment business grant micro enterprise",
      "stand up india startup india udyam registration msme credit",
      "small business support shop loan trader merchant financial help",
      "vyapar sahayata dukaan loan apna kaam shuru karne ki madad",
      "micro small medium enterprise working capital term loan collateral free",
      "innovation fund seed grant incubation support startup ecosystem",
    ],
  },

  // ── Worker / Labour / Construction ────────────────────────────────────────
  {
    test: /worker|labour|labourer|construction|bocw|shramik|majdoor|artisan|weaver|handloom|domestic worker|asha|anganwadi worker|beedi|bidi/i,
    keywords: [
      "construction worker welfare labour board bocw building worker benefit",
      "unorganised worker scheme shramik card majdoor sahayata",
      "handloom weaver support artisan craft welfare scheme",
      "domestic worker welfare asha worker anganwadi worker support",
      "beedi bidi worker welfare scheme gig worker social security",
      "mgnrega nrega daily wage worker employment guarantee",
      "labour welfare fund workers insurance accident benefit",
    ],
  },

  // ── Unemployed / Job Seekers / Skill Development ──────────────────────────
  {
    test: /unemployed|berozgaar|job|employment|skill|training|apprentice|placement|vocational|pmkvy|ddugky|kaushal/i,
    keywords: [
      "unemployment assistance skill training job placement employment scheme",
      "pm kaushal vikas yojana pmkvy skill development vocational training",
      "apprenticeship internship on job training industry training",
      "berozgaar bhatta unemployment allowance job search support",
      "employment generation scheme naukri dhundne mein madad",
      "career guidance placement support first employment scheme",
    ],
  },

  // ── Maternity / Pregnancy / Mother Child ──────────────────────────────────
  {
    test: /pregnant|maternity|pregnancy|delivery|antenatal|postnatal|newborn|janani|suman|jsy|jssk|pmmvy|matru|lactating|neonate|prenatal/i,
    keywords: [
      "maternity benefit pregnancy support free delivery hospital janani shishu",
      "pradhan mantri matru vandana yojana pmmvy maternity allowance",
      "suman yojana janani suraksha yojana jsy jssk free delivery government hospital",
      "antenatal care postnatal care newborn baby care nutrition support",
      "garbhavati mahila sahayata prasav sahayata lactating mother benefit",
      "mother child health scheme nutrition assistance breastfeeding support",
    ],
  },

  // ── Disability / Divyang ──────────────────────────────────────────────────
  {
    test: /disab|handicap|divyang|pwd|differently.?abled|blind|deaf|cerebral palsy|autism|locomotor|amputation|specially abled|saksham/i,
    keywords: [
      "disability benefit divyang pwd differently abled specially abled",
      "disability pension handicap allowance physical disability support",
      "blind deaf dumb locomotor disability cerebral palsy autism scheme",
      "assistive devices artificial limb hearing aid white cane support",
      "niramaya adip scheme disability certificate udid card",
      "saksham scholarship divyang scholarship disability scholarship",
      "barrier free infrastructure disability employment support",
    ],
  },

  // ── Housing / Shelter / Awas ──────────────────────────────────────────────
  {
    test: /housing|awas|ghar|makaan|shelter|pmay|pucca|home loan|rural housing|urban housing|slum|jhuggi/i,
    keywords: [
      "housing scheme home loan subsidy pucca ghar rural housing",
      "pradhan mantri awas yojana pmay urban rural housing assistance",
      "house construction grant shelter scheme slum rehabilitation",
      "affordable housing scheme low income housing assistance ghar banane ki madad",
      "home loan interest subsidy credit linked subsidy clss",
    ],
  },

  // ── Pension / Old Age / Senior Citizen ────────────────────────────────────
  {
    test: /pension|old age|senior citizen|vridha|vayoshreshtha|ignoaps|nsap|atal pension|nps|epf|provident fund/i,
    keywords: [
      "old age pension senior citizen scheme monthly allowance retirement benefit",
      "indira gandhi national old age pension ignoaps social security pension",
      "atal pension yojana national pension system nps epf provident fund",
      "vridha pension bujurg pension senior citizen welfare budhapa sahayata",
      "social security old age financial support retire retired person benefit",
    ],
  },

  // ── Sanitation / Clean Water / Swachh ────────────────────────────────────
  {
    test: /toilet|shauchalay|swachh|sanitation|drinking water|jal jeevan|nal jal|odf|hygiene/i,
    keywords: [
      "toilet construction swachh bharat mission sanitation scheme",
      "free toilet scheme shauchalay nirman subsidy open defecation free odf",
      "jal jeevan mission drinking water pipeline nal jal yojana",
      "water connection subsidy household drinking water rural urban sanitation",
    ],
  },

  // ── Marriage / Wedding Assistance ─────────────────────────────────────────
  {
    test: /marriage|vivah|shaadi|nikah|wedding|bride|kanya vivah|beti ki shaadi|marriage grant/i,
    keywords: [
      "marriage assistance marriage grant wedding support kanyadaan vivah anudan",
      "beti ki shaadi ke liye madad kanya vivah yojana marriage financial help",
      "shaadi anudan marriage allowance inter caste marriage incentive",
      "mukhyamantri kanya vivah yojana bride financial support",
    ],
  },

  // ── Ex-Servicemen / Defence ───────────────────────────────────────────────
  {
    test: /ex.?servicem|veteran|sainik|defence|army|navy|air force|fauji|crpf|bsf|cisf|capf|coast guard/i,
    keywords: [
      "ex servicemen welfare defence personnel benefit sainik sahayata",
      "veteran support army navy air force welfare scheme echs",
      "central armed police force capf crpf bsf cisf welfare",
      "military veteran pension war widow support fauji pension",
    ],
  },

  // ── Tribal / Adivasi ──────────────────────────────────────────────────────
  {
    test: /tribal|adivasi|scheduled tribe|van bandhu|forest dweller|primitive tribe|pvtg/i,
    keywords: [
      "tribal welfare adivasi support scheduled tribe scheme van bandhu",
      "forest dwelling community forest rights primitive vulnerable tribal group pvtg",
      "tribal scholarship adivasi scholarship st scholarship",
    ],
  },

  // ── Women Empowerment (general) ───────────────────────────────────────────
  {
    test: /women|mahila|beti|ladki|female|girl|self help group|shg|stree/i,
    keywords: [
      "women empowerment mahila yojana beti bachao beti padhao",
      "self help group shg women microfinance women loan scheme",
      "female entrepreneur women business support stree shakti",
      "girl child scheme ladki padhai fee waiver women welfare",
    ],
  },

  // ── SC / Dalit Welfare ────────────────────────────────────────────────────
  {
    test: /scheduled caste|\bsc\b|dalit|ambedkar|post matric sc|dr\. b\.r\. ambedkar/i,
    keywords: [
      "scheduled caste welfare sc scholarship dalit empowerment ambedkar",
      "post matric scholarship sc dalits dr ambedkar scheme",
      "untouchability removal social justice sc community support",
    ],
  },

  // ── OBC Welfare ───────────────────────────────────────────────────────────
  {
    test: /\bobc\b|other backward class|backward class|socially backward/i,
    keywords: [
      "obc scholarship other backward class welfare scheme backward community support",
      "obc hostel fee subsidy obc coaching scholarship",
    ],
  },

  // ── Minority Welfare ──────────────────────────────────────────────────────
  {
    test: /minority|muslim|sikh|christian|jain|buddhist|parsi|waqf/i,
    keywords: [
      "minority welfare scheme muslim sikh christian jain buddhist minority scholarship",
      "maulana azad scholarship minority community support waqf board scheme",
    ],
  },
];

// ── Income context signal ─────────────────────────────────────────────────────
const incomeContext = (scheme) => {
  if (!scheme.maxIncome) return "";
  if (scheme.maxIncome <= 100000) return "below poverty line bpl very low income economically weak";
  if (scheme.maxIncome <= 300000) return "low income family annual income 3 lakh poor family";
  if (scheme.maxIncome <= 800000) return "middle income family annual income 8 lakh moderate income";
  return "income limit scheme";
};

// ── Age context signal ────────────────────────────────────────────────────────
const ageContext = (scheme) => {
  const parts = [];
  if (scheme.minAge != null) parts.push(`minimum age ${scheme.minAge} years`);
  if (scheme.maxAge != null) parts.push(`maximum age ${scheme.maxAge} years`);
  if (scheme.minAge != null && scheme.minAge >= 60) parts.push("senior citizen old age elderly");
  if (scheme.maxAge != null && scheme.maxAge <= 18) parts.push("child children youth minor below 18");
  if (scheme.maxAge != null && scheme.maxAge <= 35 && (scheme.minAge == null || scheme.minAge >= 14)) parts.push("youth young adult student age");
  return parts.join(" ");
};

// ── Main keyword inference ────────────────────────────────────────────────────
const inferKeywords = (scheme) => {
  const combinedText = `
    ${scheme.name || ""}
    ${scheme.description || ""}
    ${scheme.category || ""}
    ${scheme.ministry || ""}
    ${scheme.benefits || ""}
    ${scheme.eligibility || ""}
    ${(scheme.tags || []).join(" ")}
  `;

  const injected = [];

  for (const { test, keywords } of THEME_INJECTIONS) {
    if (test.test(combinedText)) {
      injected.push(...keywords);
    }
  }

  return injected;
};

// ── Public API ────────────────────────────────────────────────────────────────
export const buildSearchText = (scheme) => {
  if (scheme.searchText && scheme.searchText.trim().length > 50) {
    return scheme.searchText.trim();
  }
  const keywords   = inferKeywords(scheme);
  const incomeCtx  = incomeContext(scheme);
  const ageCtx     = ageContext(scheme);

  // Repeat the scheme name 3× — it's the most signal-dense field,
  // especially when the API only provides name + short description.
  const nameRepeat = [scheme.name, scheme.name, scheme.name]
    .filter(Boolean)
    .join(" ");

  return `
${nameRepeat}
${scheme.description || ""}
${scheme.benefits || ""}
${scheme.eligibility || ""}
${scheme.category || ""}
${scheme.ministry || ""}

occupation: ${(scheme.allowedOccupations || []).join(" ")}
education: ${(scheme.allowedEducationLevels || []).join(" ")}
category: ${(scheme.allowedCategories || []).join(" ")}
gender: ${(scheme.allowedGenders || []).join(" ")}
state: ${(scheme.allowedStates || []).join(" ")}

${incomeCtx}
${ageCtx}

${keywords.join("\n")}
`
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};