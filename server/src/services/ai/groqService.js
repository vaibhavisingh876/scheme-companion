import Groq from "groq-sdk";
import { profileSchema } from "../../validators/profileValidator.js";


const groqClientInstance = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});


export const normalize = (str = "") =>
  String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();


const stateMap = {
  up: "uttarpradesh", uttarpradesh: "uttarpradesh",
  mp: "madhyapradesh", madhyapradesh: "madhyapradesh",
  dl: "delhi", delhi: "delhi", nctdelhi: "delhi",
  mh: "maharashtra", maharashtra: "maharashtra",
  gujarat: "gujarat", gujrat: "gujarat", gj: "gujarat",
  pb: "punjab", punjab: "punjab",
  hr: "haryana", haryana: "haryana",
  kar: "karnataka", karnataka: "karnataka",
  tn: "tamilnadu", tamilnadu: "tamilnadu",
  tg: "telangana", telangana: "telangana",
  ap: "andhrapradesh", andhrapradesh: "andhrapradesh",
  rj: "rajasthan", rajasthan: "rajasthan",
  br: "bihar", bihar: "bihar",
  wb: "westbengal", westbengal: "westbengal",
  jk: "jammukashmir", jammukashmir: "jammukashmir",
  uk: "uttarakhand", uttarakhand: "uttarakhand",
  cg: "chhattisgarh", chhattisgarh: "chhattisgarh",
  odisha: "odisha", orissa: "odisha",
  assam: "assam", as: "assam",
  hp: "himachalpradesh", himachalpradesh: "himachalpradesh",
  goa: "goa",
  mn: "manipur", manipur: "manipur",
  mg: "meghalaya", meghalaya: "meghalaya",
  tr: "tripura", tripura: "tripura",
  sk: "sikkim", sikkim: "sikkim",
  ar: "arunachalpradesh", arunachalpradesh: "arunachalpradesh",
  naga: "nagaland", nagaland: "nagaland",
  mz: "mizoram", mizoram: "mizoram",
  jh: "jharkhand", jharkhand: "jharkhand",
  ch: "chandigarh", chandigarh: "chandigarh",
  puducherry: "puducherry", pondicherry: "puducherry", py: "puducherry",
  andamannicobar: "andamannicobar",
  ladakh: "ladakh",
  lakshadweep: "lakshadweep",
};


// ✅ FIXED: Added "widow" to occupationMap
const occupationMap = {
  student:    ["student","engineeringstudent","medicalstudent","learner","college","school","btech","mtech","bsc","msc","ba","ma","bcom","mcom","mba","bca","mca","university"],
  farmer:     ["farmer","agriculture","agricultureworker","kisan","cultivator","farming","khet","fasal","krishak","annadata"],
  startup:    ["startup","entrepreneur","business","businessman","businesswoman","shopowner","trader","merchant","msme","selfemployed","self-employed","vyapari","dukandaar"],
  worker:     ["worker","labour","labourer","mazdoor","employee","constructionworker","artisan","craftsman","carpenter","welder","shramik","majdoor","kamgar"],
  unemployed: ["jobless","unemployed","jobseeker","lookingforjob","berozgaar","naukri"],
  housewife:  ["housewife","homemaker","grihini","gharelu"],
  // ✅ NEW: Widow occupation
  widow:      ["widow","patavya","bereaved","bereavedwife","deceasedhusband","widowed"],
};


export const normalizeState = (state = "") => {
  const cleaned = normalize(state);
  return stateMap[cleaned] || cleaned;
};


export const normalizeOccupation = (occupation = "") => {
  const cleaned = normalize(occupation);
  for (const key in occupationMap) {
    if (occupationMap[key].some((kw) => cleaned.includes(kw))) return key;
  }
  return cleaned || "unknown";
};


const extractJson = (content = "") => {
  try {
    return JSON.parse(content);
  } catch {
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
  return {};
};


const defaultProfile = () =>
  profileSchema.parse({
    age: null,
    gender: "unknown",
    occupation: "unknown",
    state: "unknown",
    income: null,
    educationLevel: "unknown",
    casteCategory: "unknown",
    primaryIntent: "unknown",
    secondaryIntents: [],
    emotion: "unknown",
    intentConfidence: 0,
    emotionConfidence: 0,
  });


export const extractUserProfile = async (message) => {
  try {
    const response = await groqClientInstance.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an expert profile extraction engine for an Indian Government Schemes Recommendation System.
You MUST understand English, Hindi, and Hinglish text equally well. Always extract every possible signal.


HINDI/HINGLISH VOCABULARY (critical — always recognise these):


Occupations:
- kisan, kisaan, krishak, annadata, kheti, khet, fasal → occupation: "farmer", primaryIntent: "farmer"
- vidyarthi, chhatra, padhai, college, school, university → occupation: "student"
- majdoor, mazdoor, shramik, kamgar, mistri → occupation: "worker"
- vyapari, dukandaar, vyavsayi → occupation: "startup"
- grihini, gharelu mahila, ghar pe rehna → occupation: "housewife"
- berozgaar, naukri nahi, rojgaar nahi → occupation: "unemployed"
- ✅ NEW: widow, patavya, bereaved, husband died, husband dead → occupation: "widow", primaryIntent: "widow-support"


States (abbreviated or informal):
- up, u.p., utar pradesh, uttar pradesh → state: "Uttar Pradesh"
- mp, m.p., madhya pradesh → state: "Madhya Pradesh"
- delhi, dilli → state: "Delhi"
- mh, maharashtra, mumbai (when referring to state) → state: "Maharashtra"
- rajasthan, raj → state: "Rajasthan"
- bihar, br → state: "Bihar"
- bengal, wb, west bengal, paschim banga → state: "West Bengal"
- punjab, pb → state: "Punjab"
- haryana, hr → state: "Haryana"
- gujarat, gj → state: "Gujarat"
- karnataka, kar → state: "Karnataka"


Intent signals (Hindi):
- yojana chahiye, scheme chahiye, madad chahiye → extract intent from occupation/context
- paisa chahiye, loan chahiye → primaryIntent: "loan"
- ilaaj, treatment, dawai, hospital → primaryIntent: "treatment"
- scholarship chahiye, padhai ke liye madad → primaryIntent: "scholarship"
- kheti ke liye, fasal ke liye, beej, khaad → primaryIntent: "farmer"
- naukri chahiye, rojgaar chahiye → primaryIntent: "job"
- business karna chahta, dukaan kholni → primaryIntent: "startup-funding"
- ✅ NEW: widow pension, bereaved, husband died → primaryIntent: "widow-support"


Common Hinglish patterns:
- "mai ek X hu" → I am a X → extract X as occupation
- "X se hu" or "X ka rehne wala hu" → from state X
- "mujhe schemes bta" / "yojana btao" → user wants scheme recommendations
- "hu" = "hoon" = "am" → identity marker
- "se" = "from" → location marker
- "bta" / "btao" = "tell me" → intent to find schemes


INCOME PARSING:
- "3 lakh" / "3L" / "3,00,000" → 300000
- "monthly 25000" → annualise: 300000
- "daily 500" → annualise: 182500


EDUCATION LEVEL:
- engineering, btech, college, degree, graduation, university → "higher_education"
- MBA, MTech, masters, PhD → "higher_education"
- school, 10th, 12th, matric, intermediate → "school"
- Not mentioned → "unknown"


Return ONLY valid JSON with these exact fields:
{
  "age": number | null,
  "gender": "male" | "female" | "other" | "unknown",
  "occupation": "student" | "farmer" | "startup" | "worker" | "housewife" | "unemployed" | "widow" | "unknown",
  "state": string | "unknown",
  "income": number | null,
  "educationLevel": "higher_education" | "school" | "unknown",
  "casteCategory": "general" | "sc" | "st" | "obc" | "minority" | "unknown",
  "primaryIntent": "student" | "business" | "job" | "medical" | "treatment" | "loan" | "scholarship" | "marriage" | "death" | "disability" | "maternity" | "farmer" | "unemployed" | "startup-funding" | "widow-support" | "unknown",
  "secondaryIntents": string[],
  "emotion": "urgent" | "worried" | "desperate" | "anxious" | "frustrated" | "hopeful" | "calm" | "unknown",
  "intentConfidence": number between 0.0 and 1.0,
  "emotionConfidence": number between 0.0 and 1.0
}


EXAMPLES (study these carefully):
- "mai ek kisan hu up se mujhe schemes bta" → occupation:"farmer", state:"Uttar Pradesh", primaryIntent:"farmer", intentConfidence:0.95
- "mai ek kisan hu up se schemes bta" → occupation:"farmer", state:"Uttar Pradesh", primaryIntent:"farmer", intentConfidence:0.95
- "kisan hoon bihar se" → occupation:"farmer", state:"Bihar", primaryIntent:"farmer", intentConfidence:0.90
- "mujhe scholarship chahiye engineering ke liye" → occupation:"student", primaryIntent:"scholarship", educationLevel:"higher_education", intentConfidence:0.95
- "meri maa ki tabiyat theek nahi ilaaj ke liye paisa chahiye" → primaryIntent:"treatment", secondaryIntents:["loan"], emotion:"worried", intentConfidence:0.88
- "berozgaar hu delhi se" → occupation:"unemployed", state:"Delhi", primaryIntent:"job", intentConfidence:0.85
- "mai ek chhoti dukaan chalata hu rajasthan mein" → occupation:"startup", state:"Rajasthan", primaryIntent:"startup-funding", intentConfidence:0.82
- "sc category ka student hu" → occupation:"student", casteCategory:"sc", primaryIntent:"scholarship", intentConfidence:0.80
- "father's treatment ke liye loan chahiye" → primaryIntent:"treatment", secondaryIntents:["loan","medical"], emotion:"urgent", intentConfidence:0.92
- "help chahiye" → primaryIntent:"unknown", intentConfidence:0.1
- ✅ NEW: "i am a widow from delhi" → occupation:"widow", state:"Delhi", primaryIntent:"widow-support", intentConfidence:0.90
- ✅ NEW: "meri husband died hui widow pension chahiye" → occupation:"widow", primaryIntent:"widow-support", intentConfidence:0.88


intentConfidence rules:
- occupation + intent both clear → 0.85-0.95
- only occupation clear, no explicit intent → 0.70-0.80 (infer intent from occupation)
- vague message → 0.1-0.4`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });


    const rawContent = response?.choices?.[0]?.message?.content || "{}";
    const parsed = extractJson(rawContent);


    for (const f of ["gender","occupation","casteCategory","state","primaryIntent","educationLevel"]) {
      if (typeof parsed[f] === "string")
        parsed[f] = parsed[f].toLowerCase().trim();
    }


    if (parsed.age !== null && parsed.age !== undefined) {
      parsed.age = Number(parsed.age);
      if (Number.isNaN(parsed.age) || parsed.age < 0 || parsed.age > 120)
        parsed.age = null;
    }
    if (parsed.income !== null && parsed.income !== undefined) {
      parsed.income = Number(parsed.income);
      if (Number.isNaN(parsed.income) || parsed.income < 0) parsed.income = null;
    }


    parsed.secondaryIntents = Array.isArray(parsed.secondaryIntents)
      ? parsed.secondaryIntents
      : [];


    parsed.intentConfidence = Math.min(1, Math.max(0, Number(parsed.intentConfidence) || 0.5));
    parsed.emotionConfidence = Math.min(1, Math.max(0, Number(parsed.emotionConfidence) || 0.5));


    parsed.state = normalizeState(parsed.state);
    parsed.occupation = normalizeOccupation(parsed.occupation);


    return profileSchema.parse(parsed);
  } catch (err) {
    console.error("[Groq Profile Extraction Error]", err);
    return defaultProfile();
  }
};