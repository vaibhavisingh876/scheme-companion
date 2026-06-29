export const safeString = (value) => (typeof value === "string" ? value.trim() : "");
export const safeArray = (value) => (Array.isArray(value) ? value : []);
export const toLower = (value) => String(value || "").toLowerCase();
export const normalizeSpaces = (value) => String(value || "").replace(/\s+/g, " ").trim();