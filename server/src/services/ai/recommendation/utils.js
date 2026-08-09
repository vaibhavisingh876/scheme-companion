export const safeString = (value) => (typeof value === "string" ? value.trim() : "");
export const safeArray = (value) => (Array.isArray(value) ? value : []);
export const toLower = (value) => String(value || "").toLowerCase();
export const normalizeSpaces = (value) => String(value || "").replace(/\s+/g, " ").trim();

export const normalizeCategory = (cat) => {
  if (!cat) return "other";
  const c = String(cat).toLowerCase().trim();
  if (/agriculture|farming|farmer|crop|kisan|krishak/.test(c)) return "agriculture";
  if (/education|scholarship|student|tuition|fee|learning/.test(c)) return "education";
  if (/health|medical|treatment|hospital|wellness/.test(c)) return "health";
  if (/housing|shelter|awas|pmay/.test(c)) return "housing";
  if (/social|welfare|empowerment|women|child|pension|widow/.test(c)) return "social";
  if (/skill|employment|job|rojgaar/.test(c)) return "employment";
  if (/business|startup|entrepreneur|udyami/.test(c)) return "business";
  if (/banking|financial|loan|credit/.test(c)) return "finance";
  if (/sanitation|toilet|swachh/.test(c)) return "sanitation";
  return "other";
};