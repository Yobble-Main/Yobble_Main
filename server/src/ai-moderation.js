/**
 * ai-moderation.js
 *
 * Local Ollama AI content moderation module.
 *
 * Setup:
 *   1. Install Ollama: https://ollama.com/download
 *   2. Pull a model:   ollama pull llama3.2
 *   3. Start Ollama:   ollama serve
 *
 * Optional environment variables:
 *   OLLAMA_BASE_URL  - Ollama server URL (default: http://localhost:11434)
 *   OLLAMA_MODEL     - Model name to use (default: llama3.2)
 */

const MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const BASE_URL = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");

export const ModerationSeverity = Object.freeze({
  NONE: "none",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
});

const SYSTEM_INSTRUCTION = `You are a strict content moderation AI for a game-sharing platform whose audience includes minors.

Analyse the provided user-generated text and return ONLY one valid JSON object. Do not return markdown, code fences, commentary, or any text before or after the JSON.

Return this exact JSON shape:
{
  "flagged": false,
  "severity": "none",
  "reason": "",
  "categories": []
}

Rules:
- "flagged" must be a JSON boolean.
- "severity" must be exactly one of "none", "low", "medium", or "high".
- "reason" must be a short plain string.
- "categories" must be a JSON array of strings.
- Do not include extra keys.

Severity guide:
  none   - clean content
  low    - borderline or mildly inappropriate (e.g. minor rudeness, mild suggestive language)
  medium - clearly inappropriate but not illegal (e.g. profanity, bullying, graphic but not extreme violence)
  high   - illegal, extremely harmful, or zero-tolerance content (CSAM, doxxing, credible threats, hate speech)

Be conservative - only flag content that is genuinely problematic. Do NOT flag gaming terminology, competitive trash-talk within reason, or discussion of mature themes in an educational context.`;

function fallbackResult() {
  return {
    flagged: false,
    severity: ModerationSeverity.NONE,
    reason: "",
    categories: []
  };
}

function extractJsonObject(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";

  const withoutFences = text
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (withoutFences.startsWith("{") && withoutFences.endsWith("}")) {
    return withoutFences;
  }

  const firstBrace = withoutFences.indexOf("{");
  if (firstBrace === -1) return "";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = firstBrace; i < withoutFences.length; i += 1) {
    const ch = withoutFences[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return withoutFences.slice(firstBrace, i + 1);
      }
    }
  }

  return "";
}

function normalizeModerationResult(parsed) {
  return {
    flagged: !!parsed?.flagged,
    severity: Object.values(ModerationSeverity).includes(parsed?.severity)
      ? parsed.severity
      : ModerationSeverity.NONE,
    reason: typeof parsed?.reason === "string" ? parsed.reason.slice(0, 500) : "",
    categories: Array.isArray(parsed?.categories)
      ? parsed.categories.filter((c) => typeof c === "string").slice(0, 20)
      : [],
  };
}

export async function moderateText(text) {
  const fallback = fallbackResult();
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
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[ai-moderation] Ollama returned HTTP ${response.status}`);
      return fallback;
    }

    const data = await response.json();
    const raw = data?.message?.content?.trim() ?? "";
    const jsonStr = extractJsonObject(raw);
    if (!jsonStr) {
      throw new Error("no_json_object_returned");
    }

    return normalizeModerationResult(JSON.parse(jsonStr));
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      console.error("[ai-moderation] request timed out - Ollama may be slow or overloaded");
    } else {
      console.error("[ai-moderation] error:", err?.message ?? err);
    }
    return fallback;
  }
}

export async function moderateFields(fields) {
  const entries = Object.entries(fields).filter(([, v]) => typeof v === "string" && v.trim());
  if (!entries.length) {
    return fallbackResult();
  }

  const combined = entries.map(([name, val]) => `[${name}]: ${val}`).join("\n\n");
  return moderateText(combined);
}
