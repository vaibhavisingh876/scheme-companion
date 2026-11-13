import crypto from "crypto";
import { normalizeText } from "../../../utils/helpers.js";

// The hash is the validity key for persisted Groq rules. It must be derived
// only from the text Groq actually read, so unrelated changes (image, display
// description, ministry) never invalidate a valid extraction.
export const sourceHashOf = (eligibilityText) =>
  crypto
    .createHash("sha256")
    .update(normalizeText(eligibilityText))
    .digest("hex")
    .slice(0, 32);

export const eligibilitySourceChanged = (previousText, nextText) =>
  sourceHashOf(previousText) !== sourceHashOf(nextText);
