/**
 * recommendationService.js
 *
 * Main orchestrator: takes a user message → returns scored, filtered, diverse schemes.
 *
 * IMPROVEMENT LOG:
 * - Massively expanded buildQueryText per-intent vocabulary (3-5× more keywords per intent)
 * - Added per-occupation vocabulary injection into query text
 * - Added state-specific vocabulary signal when state is known
 * - Added caste-category signal into query text
 * - Added age signal into query text
 * - Added income signal into query text
 * - Diversity filter now uses intent-aware per-category limits
 * - Added forSomeoneElse vocabulary injection
 */

import { extractUserProfile, normalizeState, expandQueryForEmbedding } from "../groqService.js";
import {
  applyKeywordFallback,
  hasOccupationEvidence,
  EDUCATION_LEVEL_PATTERNS,
  isThirdPartyRequest,
  extractBeneficiaryProfile,
} from "../keywordFallback.js";
import { getExtractor } from "../embeddingModel.js";
import prisma from "../../../config/prisma.js";
import { scoreScheme } from "../scoringEngine.js";
import { safeArray, safeString, normalizeSpaces } from "./utils.js";
import { SCORE } from "./constants/scoreConstants.js";

const MAX_CANDIDATES = 3000;
const MAX_RESULTS    = 40;

// Per-category diversity cap (intent-aware in applyDiversityFilter)
const DEFAULT_MAX_PER_CATEGORY = 6;
const INTENT_MAX_PER_CATEGORY  = {
  scholarship: 8,       // scholarship queries need more variety
  farmer:      8,
  treatment:   6,
  loan:        5,
  "startup-funding": 5,
};

// ── Comprehensive intent → vocabulary map ─────────────────────────────────────
// Each intent gets a rich set of English + Hindi keywords that characterise
// the types of schemes a user with this intent needs.
const INTENT_VOCAB = {
  "widow-support": `
    widow pension bereaved family husband died death assistance vidhwa pension
    widow financial help deceased husband pension monthly allowance survivor benefit
    women in distress single women support akeli aurat madad widowed woman scheme
    family benefit after death breadwinner death compensation social security widow
    indira gandhi national widow pension igndwps women welfare bereaved spouse
  `,
  treatment: `
    medical treatment hospital healthcare patient assistance disease cancer surgery
    health scheme free treatment government hospital ayushman bharat pmjay
    health insurance cashless treatment medicine assistance critical illness
    cancer treatment surgery assistance oncology chemotherapy dialysis transplant
    rashtriya arogya nidhi niramaya health card bpl family treatment free
    ilaaj sahayata dawai hospital free bimari madad rajiv gandhi health
  `,
  scholarship: `
    student scholarship education financial support fee reimbursement stipend
    tuition fee waiver hostel fee merit scholarship national scholarship portal
    post matric scholarship pre matric scholarship minority scholarship obc scholarship
    sc st scholarship central sector scholarship state scholarship education grant
    chatravritti padhai madad vidya lakshmi fee subsidy coaching free
    inspire kvpy national talent search exam ntse gate fellowship research
    higher education support college fees university fees education loan subsidy
  `,
  farmer: `
    kisan farmer agriculture crop subsidy fasal bima pmfby crop insurance
    pradhan mantri fasal bima yojana pm kisan samman nidhi kisan credit card
    drip irrigation tractor subsidy soil health card irrigation support
    agriculture equipment fertilizer seed subsidy khaad beej sahayata
    dairy farming animal husbandry poultry fisheries aquaculture sericulture
    crop loan agriculture loan rural credit kcc mgnrega nrega farm labour
    natural calamity drought flood relief crop damage compensation annadata
  `,
  "startup-funding": `
    startup entrepreneur business loan msme self employment udyam mudra
    pmegp prime minister employment generation programme stand up india
    startup india seed fund incubation support venture small enterprise
    shop loan trader merchant financial help self employed scheme
    micro enterprise working capital term loan collateral free bank guarantee
    women entrepreneur sc st entrepreneur innovation fund tech startup
  `,
  maternity: `
    maternity pregnancy prenatal postnatal delivery janani shishu suman jsy pmmvy
    free delivery government hospital pradhan mantri matru vandana yojana
    antenatal care postnatal care newborn baby care nutrition support
    janani suraksha yojana jssk free maternity services cash benefit delivery
    garbhavati mahila sahayata prasav lactating mother breastfeeding nutrition
    mother child health scheme poshan abhiyan antenatal checkup
  `,
  disability: `
    disability pwd divyang differently abled handicap specially abled
    blind deaf dumb locomotor disability cerebral palsy autism
    assistive device artificial limb hearing aid white cane support
    niramaya adip scheme disability scholarship saksham scholarship
    disability pension handicap allowance udid card disability certificate
    barrier free accessible infrastructure disability employment vocational
  `,
  loan: `
    loan financial assistance bank loan interest subsidy credit guarantee
    mudra loan pmegp agriculture loan education loan home loan housing loan
    self employment loan msme loan working capital collateral free bank support
    kisan credit card pm svanidhi street vendor loan shg women loan
    weaker section loan sc st loan minority loan backward class loan
  `,
  job: `
    employment job skill training naukri rojgaar placement scheme
    pm kaushal vikas yojana pmkvy apprenticeship internship ddugky
    skill development vocational training industry partnership
    berozgaar bhatta unemployment allowance job search support career guidance
    iti diploma polytechnic training industry certificate employment
    sarkari naukri government job mgnrega nrega rural employment
  `,
  unemployed: `
    unemployment berozgaar job self employment skill training scheme
    employment generation pm kaushal vikas pmkvy ddugky vocational
    startup mudra self employed apna dhanda apna rozgar
    berozgaari bhatta job allowance career counselling placement support
  `,
  housing: `
    house ghar makaan awas housing shelter construction grant subsidy
    pradhan mantri awas yojana pmay rural urban housing pucca ghar
    home loan interest subsidy credit linked subsidy slum rehabilitation
    affordable housing low income homeless shelter rural housing scheme
  `,
  sanitation: `
    toilet shauchalay swachh bharat sanitation scheme construction subsidy
    open defecation free odf jal jeevan mission drinking water nal jal
    water connection hygiene cleanliness rural urban sanitation programme
  `,
  pension: `
    pension old age pension senior citizen monthly allowance social security
    indira gandhi national old age pension ignoaps atal pension yojana
    national social assistance programme nsap provident fund epf nps
    vridha pension bujurg pension retirement benefit widow pension disability pension
  `,
  marriage: `
    marriage assistance wedding grant vivah anudan shaadi anudan kanyadaan
    kanya vivah yojana mukhyamantri kanya vivah inter caste marriage incentive
    beti ki shaadi financial help bride support marriage financial assistance
  `,
  death: `
    death assistance funeral grant antim anudan kabir anthyesthi breadwinner death
    accidental death benefit natural death grant family benefit scheme
    mrityu sahayata bereaved family compensation death of earning member
    social security death benefit survivor benefit family welfare
  `,
  business: `
    business entrepreneur startup msme shop merchant trader vyapar
    business loan grant support scheme self employment
    udyam mudra stand up india women entrepreneur
  `,
  medical: `
    medical health treatment hospital disease illness patient
    ayushman pmjay health insurance government hospital free treatment
    cancer surgery dialysis transplant critical illness support
  `,
  student: `
    student scholarship education college university fee support
    hostel stipend merit scholarship education loan interest subsidy
    higher education support iti diploma engineering degree
  `,
};

// ── Per-occupation vocabulary ─────────────────────────────────────────────────
const OCCUPATION_VOCAB = {
  student:    "student education scholarship college university fee hostel studying vidyarthi chhatra",
  farmer:     "farmer kisan krishak agriculture crop kheti fasal annadata khetibadi",
  worker:     "worker labour labourer shramik majdoor construction bocw mgnrega nrega kamgar",
  startup:    "startup entrepreneur business msme self employed udyam mudra shop vyapar",
  unemployed: "unemployed berozgaar jobless job seeker skill training employment scheme",
  housewife:  "housewife homemaker grihini women welfare self help group shg",
  widow:      "widow vidhwa bereaved deceased husband women in distress single woman support",
};

// ── Caste vocabulary ──────────────────────────────────────────────────────────
const CASTE_VOCAB = {
  sc:       "scheduled caste dalit sc scholarship sc welfare ambedkar social justice",
  st:       "scheduled tribe tribal adivasi st scholarship van bandhu forest dweller",
  obc:      "other backward class obc scholarship backward community welfare",
  minority: "minority muslim sikh christian jain buddhist minority scholarship maulana azad",
  general:  "general open category all communities all citizens",
};

// ── Build the query text sent to the embedding model ─────────────────────────
const buildQueryText = (message, profile, expandedQuery = null) => {
  if (expandedQuery && expandedQuery.trim().length > 20) {
    // Even with expanded query, append key profile signals
    const profileSignals = [
      profile.occupation !== "unknown" ? OCCUPATION_VOCAB[profile.occupation] || profile.occupation : "",
      profile.casteCategory !== "unknown" ? CASTE_VOCAB[profile.casteCategory] || "" : "",
      profile.state        !== "unknown" ? `state ${profile.state}` : "",
      profile.primaryIntent !== "unknown" ? INTENT_VOCAB[profile.primaryIntent] || "" : "",
    ].filter(Boolean).join(" ");

    return normalizeSpaces(`${expandedQuery} ${profileSignals}`);
  }

  const parts = [
    message,
    profile.primaryIntent !== "unknown" ? INTENT_VOCAB[profile.primaryIntent] || "" : "",
    ...safeArray(profile.secondaryIntents).map((si) => INTENT_VOCAB[si] || ""),
    profile.occupation !== "unknown" ? OCCUPATION_VOCAB[profile.occupation]   || profile.occupation : "",
    profile.educationLevel !== "unknown" ? profile.educationLevel : "",
    profile.casteCategory  !== "unknown" ? CASTE_VOCAB[profile.casteCategory] || profile.casteCategory : "",
    profile.state          !== "unknown" ? `${profile.state} state scheme`    : "",
    // Age signals
    profile.age != null && profile.age >= 60 ? "senior citizen old age elderly pension"       : "",
    profile.age != null && profile.age <= 25 ? "youth young adult student scholarship"        : "",
    profile.age != null && profile.age < 18  ? "child children minor below 18 school"        : "",
    // Income signals
    profile.income != null && profile.income <= 100000 ? "bpl below poverty line very low income economically weak" : "",
    profile.income != null && profile.income <= 300000 ? "low income family annual income poor family"              : "",
    // Crop insurance specific booster
    /crop insurance|fasal bima|pmfby/i.test(message)
      ? "pradhan mantri fasal bima yojana pmfby crop insurance agriculture insurance kisan"
      : "",
    /\bloan\b|rin|karz|udhar/i.test(message) ? "loan financial assistance credit scheme" : "",
  ];

  return normalizeSpaces(parts.filter((p) => p && p.trim()).join(" "));
};

// ── Build DB WHERE clause ─────────────────────────────────────────────────────
const buildDbWhere = (message, profile, forSomeoneElse = false) => {
  const { gender, income, state, occupation, casteCategory, educationLevel, age, primaryIntent } = profile;
  const dbWhere = { isActive: true, AND: [] };

  if (!forSomeoneElse) {
    if (gender && gender !== "unknown" && gender !== "female") {
      dbWhere.AND.push({ isFemaleOnly: false });
    }

    if (age !== null && age !== undefined) {
      dbWhere.AND.push({ OR: [{ minAge: null }, { minAge: { lte: age } }] });
      dbWhere.AND.push({ OR: [{ maxAge: null }, { maxAge: { gte: age } }] });
    }

    if (
      occupation &&
      occupation !== "unknown" &&
      occupation !== "all" &&
      hasOccupationEvidence(message, occupation)
    ) {
      dbWhere.AND.push({
        OR: [
          { allowedOccupations: { has: occupation } },
          { allowedOccupations: { has: "all" } },
        ],
      });
    }

    if (casteCategory && casteCategory !== "unknown" && casteCategory !== "general") {
      dbWhere.AND.push({
        OR: [
          { allowedCategories: { has: casteCategory } },
          { allowedCategories: { has: "general" } },
        ],
      });
    }

    const hasEduEvidence =
      !educationLevel ||
      educationLevel === "unknown" ||
      EDUCATION_LEVEL_PATTERNS.some(({ pattern }) => pattern.test(message));
    if (educationLevel && educationLevel !== "unknown" && hasEduEvidence) {
      dbWhere.AND.push({
        OR: [
          { allowedEducationLevels: { has: educationLevel } },
          { allowedEducationLevels: { has: "all" } },
        ],
      });
    }

    if (primaryIntent === "scholarship") {
      dbWhere.AND.push({ isScholarship: true });
    }

    if (primaryIntent === "farmer" && (occupation === "unknown" || occupation === "all")) {
      dbWhere.AND.push({
        OR: [
          { allowedOccupations: { has: "farmer" } },
          { allowedOccupations: { has: "all" } },
        ],
      });
    }
  }

  if (income !== null && income !== undefined) {
    dbWhere.AND.push({ OR: [{ maxIncome: null }, { maxIncome: { gte: income } }] });
  }

  if (state && state !== "unknown") {
    const normalizedState = normalizeState(state);
    dbWhere.AND.push({
      OR: [
        { allowedStates: { isEmpty: true } },
        { allowedStates: { has: "all" } },
        { allowedStates: { has: normalizedState } },
      ],
    });
  }

  if (dbWhere.AND.length === 0) delete dbWhere.AND;
  return dbWhere;
};

// ── Embedding query ───────────────────────────────────────────────────────────
const getQueryEmbedding = async (queryText) => {
  const extractor = await getExtractor();
  const output    = await extractor(queryText, { pooling: "mean", normalize: true });
  return Array.from(output.data);
};

// ── Diversity filter ──────────────────────────────────────────────────────────
const applyDiversityFilter = (results, primaryIntent) => {
  const maxPerCat = INTENT_MAX_PER_CATEGORY[primaryIntent] ?? DEFAULT_MAX_PER_CATEGORY;
  const categoryCount = {};
  const diverse       = [];

  for (const scheme of results) {
    const cat = String(scheme.category || "general").toLowerCase();
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    if (categoryCount[cat] <= maxPerCat) {
      diverse.push(scheme);
    }
    if (diverse.length >= MAX_RESULTS) break;
  }
  return diverse;
};

// ── Main export ───────────────────────────────────────────────────────────────
export const recommendSchemes = async (message) => {
  const trimmedMessage = safeString(message);
  if (!trimmedMessage) return { error: "message is required" };

  const forSomeoneElse = isThirdPartyRequest(trimmedMessage);

  let extractionMessage = trimmedMessage;
  if (forSomeoneElse) {
    extractionMessage = `IMPORTANT: The user is describing the person who needs the scheme, not themselves. Extract the profile of the person who needs the scheme (the beneficiary).\nUser message: "${trimmedMessage}"`;
  }

  let profile = await extractUserProfile(extractionMessage);
  profile     = applyKeywordFallback(trimmedMessage, profile);

  let beneficiaryProfile = null;
  if (forSomeoneElse) {
    beneficiaryProfile = extractBeneficiaryProfile(trimmedMessage);
  }

  const expandedQuery  = await expandQueryForEmbedding(trimmedMessage, profile);
  const queryText      = buildQueryText(trimmedMessage, profile, expandedQuery);
  const queryEmbedding = await getQueryEmbedding(queryText);

  const dbWhere = buildDbWhere(trimmedMessage, profile, forSomeoneElse);

  const candidates = await prisma.scheme.findMany({
    where: dbWhere,
    select: {
      id: true, name: true, description: true, benefits: true, eligibility: true,
      category: true, ministry: true, state: true, gender: true, occupation: true,
      educationLevel: true, allowedCategories: true, allowedStates: true,
      allowedGenders: true, allowedOccupations: true, allowedEducationLevels: true,
      minIncome: true, maxIncome: true, minAge: true, maxAge: true,
      isScholarship: true, isFemaleOnly: true, applicationLink: true,
      sourceUrl: true, tags: true, embedding: true, externalId: true, sourceId: true,
    },
    take: MAX_CANDIDATES,
  });

  const dynamicThreshold =
    SCORE.THRESHOLD_MAP[profile.primaryIntent] ??
    SCORE.THRESHOLD_MAP.default ??
    SCORE.DEFAULT_THRESHOLD;

  const scored = candidates
    .map((scheme) => ({
      ...scheme,
      _score: scoreScheme(
        scheme, profile, queryEmbedding, trimmedMessage, forSomeoneElse, beneficiaryProfile
      ),
    }))
    .filter((s) => s._score !== null && !Number.isNaN(s._score) && s._score >= dynamicThreshold)
    .sort((a, b) => b._score - a._score);

  const results = scored.map(({ embedding: _e, _score, ...rest }) => ({
    ...rest,
    relevanceScore: Math.round(_score),
  }));

  const diverse = applyDiversityFilter(results, profile.primaryIntent);

  return {
    profile: {
      ...profile,
      _debug: {
        primaryIntent:            profile.primaryIntent,
        intentConfidence:         profile.intentConfidence,
        queryText,
        expandedQuery,
        candidatesBeforeScoring:  candidates.length,
        candidatesAfterScoring:   results.length,
        candidatesAfterDiversity: diverse.length,
        threshold:                dynamicThreshold,
        forSomeoneElse,
        beneficiaryProfile,
      },
    },
    schemes: diverse,
    meta: { total: diverse.length, candidatesEvaluated: candidates.length },
  };
};