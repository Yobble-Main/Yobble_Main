/**
 * ai-moderation.js
 *
 * Local Ollama AI content moderation module.
 * Inference runs on the local machine via Ollama — no cloud API key required.
 *
 * Setup:
 *   1. Install Ollama: https://ollama.com/download
 *   2. Pull a model:   ollama pull llama3.2
 *   3. Start Ollama:   ollama serve  (or it starts automatically on most platforms)
 *
 * Optional environment variables:
 *   OLLAMA_BASE_URL  — Ollama server URL (default: http://localhost:11434)
 *   OLLAMA_MODEL     — Model name to use  (default: llama3.2)
 *
 * Usage:
 *   import { moderateText, ModerationSeverity } from "./ai-moderation.js";
 *   const result = await moderateText("some user input");
 *   // result: { flagged, severity, reason, categories }
 */

// ── Model selection ──────────────────────────────────────────────────────────
// llama3.2 is a capable, lightweight model well-suited for classification tasks.
// Override with the OLLAMA_MODEL environment variable if you prefer another model.
const MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const BASE_URL = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");

// ── Severity levels ──────────────────────────────────────────────────────────
export const ModerationSeverity = Object.freeze({
  NONE: "none",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
});

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
 * Moderate a piece of text using a local Ollama model.
 *
 * @param {string} text  – The user-generated content to check.
 * @returns {Promise<{flagged:boolean, severity:string, reason:string, categories:string[]}>}
 *          Falls back to a safe "pass" result if Ollama is unavailable or returns an error.
 */
export async function moderateText(text) {
  const fallback = { flagged: false, severity: ModerationSeverity.NONE, reason: "", categories: [] };
  if (!text || typeof text !== "string") return fallback;

  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        options: { temperature: 0.1, num_predict: 256 },
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: String(text).slice(0, 4000) },
        ],
      }),
      // 15-second timeout so a slow/busy model doesn't stall requests.
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[ai-moderation] Ollama returned HTTP ${response.status}`);
      return fallback;
    }

    const data = await response.json();
    const raw = data?.message?.content?.trim() ?? "";
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
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      console.error("[ai-moderation] request timed out — Ollama may be slow or overloaded");
    } else {
      console.error("[ai-moderation] error:", err?.message ?? err);
    }
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
