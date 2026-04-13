/**
 * ai-moderation.js
 *
 * Google Gemini 2.0 Flash AI content moderation module.
 * Optimised for low memory overhead — all inference runs on Google's cloud
 * so the host device's RAM is not a constraint.
 *
 * Environment variable required:
 *   GOOGLE_AI_API_KEY  — Google AI Studio / Vertex AI API key
 *
 * Usage:
 *   import { moderateText, ModerationSeverity } from "./ai-moderation.js";
 *   const result = await moderateText("some user input");
 *   // result: { flagged, severity, reason, categories }
 */

import { GoogleGenAI } from "@google/genai";

// ── Model selection ──────────────────────────────────────────────────────────
// gemini-2.0-flash: Google's newest high-throughput model, ideal for real-time
// content moderation at low latency and cost.
const MODEL = "gemini-2.0-flash";

// ── Severity levels ──────────────────────────────────────────────────────────
export const ModerationSeverity = Object.freeze({
  NONE: "none",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
});

// ── Singleton client (lazy) ──────────────────────────────────────────────────
let _client = null;
function getClient() {
  if (!_client) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) return null;
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

// ── Moderation prompt ────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `You are a strict content moderation AI for a game-sharing platform whose audience includes minors.

Analyse the provided user-generated text and return ONLY a JSON object — no markdown, no code fences, just raw JSON.

Schema:
{
  "flagged": boolean,
  "severity": "none" | "low" | "medium" | "high",
  "reason": "short plain-text explanation or empty string",
  "categories": string[]   // e.g. ["hate_speech","violence","spam","sexual","harassment","self_harm","other"]
}

Severity guide:
  none   – clean content
  low    – borderline or mildly inappropriate (e.g. minor rudeness, mild suggestive language)
  medium – clearly inappropriate but not illegal (e.g. profanity, bullying, graphic but not extreme violence)
  high   – illegal, extremely harmful, or zero-tolerance content (CSAM, doxxing, credible threats, severe hate speech)

Be conservative — only flag content that is genuinely problematic. Do NOT flag gaming terminology, competitive trash-talk within reason, or discussion of mature themes in an educational context.`;

/**
 * Moderate a piece of text using Gemini 2.0 Flash.
 *
 * @param {string} text  – The user-generated content to check.
 * @returns {Promise<{flagged:boolean, severity:string, reason:string, categories:string[]}>}
 *          Falls back to a safe "pass" result if the API is unavailable or returns an error.
 */
export async function moderateText(text) {
  const fallback = { flagged: false, severity: ModerationSeverity.NONE, reason: "", categories: [] };
  if (!text || typeof text !== "string") return fallback;

  const client = getClient();
  if (!client) {
    // No API key configured — moderation disabled, allow content through.
    return fallback;
  }

  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: String(text).slice(0, 4000) }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        // Low temperature for deterministic classification
        temperature: 0.1,
        maxOutputTokens: 256,
      },
    });

    const raw = response.text?.trim() ?? "";
    // Strip any accidental markdown code fences the model may include.
    const jsonStr = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(jsonStr);

    return {
      flagged: !!parsed.flagged,
      severity: Object.values(ModerationSeverity).includes(parsed.severity)
        ? parsed.severity
        : ModerationSeverity.NONE,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 500) : "",
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.filter((c) => typeof c === "string")
        : [],
    };
  } catch (err) {
    console.error("[ai-moderation] error:", err?.message ?? err);
    // Fail open — do not block content when the AI service is unavailable.
    return fallback;
  }
}

/**
 * Convenience helper: moderate multiple text fields at once.
 * Useful for game/item uploads where you want to check title + description together.
 *
 * @param {Object} fields  – Plain object of { fieldName: text } pairs.
 * @returns {Promise<{flagged, severity, reason, categories}>}
 */
export async function moderateFields(fields) {
  const entries = Object.entries(fields).filter(([, v]) => typeof v === "string" && v.trim());
  if (!entries.length) {
    return { flagged: false, severity: ModerationSeverity.NONE, reason: "", categories: [] };
  }

  // Combine fields into one request to minimise API calls.
  const combined = entries.map(([name, val]) => `[${name}]: ${val}`).join("\n\n");
  return moderateText(combined);
}
