import { recommendSchemes } from "../services/ai/recommendation/recommendationService.js";

export const extractProfile = async (req, res) => {
  try {
    const message = req.body?.message;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "message is required" });
    }

    const result = await recommendSchemes(message);

    if (result?.error) {
      return res.status(400).json({ error: result.error });
    }

    return res.json(result);
  } catch (err) {
    console.error("[AI Controller Error]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};