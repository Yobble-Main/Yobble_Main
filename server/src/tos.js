import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_TOS_PATH = path.resolve(__dirname, "..", "tos-deafult");

export function createDefaultTos() {
  return {
    title: "Terms of Service",
    intro: "These terms govern your access to Yobble.",
    updated: new Date().toISOString().slice(0, 10),
    contact: "botte0games@gmail.com",
    meta: [],
    highlights: [],
    sections: [
      {
        id: "acceptance",
        title: "1. Acceptance of these terms",
        paragraphs: [
          "By accessing or using Yobble, you agree to these Terms of Service and our related policies. If you do not agree, do not use the service."
        ]
      }
    ]
  };
}

function isUsableTos(value) {
  return !!(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.title &&
    Array.isArray(value.sections) &&
    value.sections.length
  );
}

export async function loadDefaultTos() {
  try {
    const raw = await fs.readFile(DEFAULT_TOS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (isUsableTos(parsed)) return parsed;
  } catch (err) {
    console.error("default tos load error", err);
  }
  return createDefaultTos();
}

export async function ensureTosFile(tosPath) {
  let shouldWrite = false;
  try {
    const raw = await fs.readFile(tosPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!isUsableTos(parsed)) {
      shouldWrite = true;
    } else {
      return parsed;
    }
  } catch {
    shouldWrite = true;
  }

  if (!shouldWrite) return loadDefaultTos();

  const fallback = await loadDefaultTos();
  await fs.mkdir(path.dirname(tosPath), { recursive: true });
  await fs.writeFile(tosPath, JSON.stringify(fallback, null, 2) + "\n", "utf8");
  return fallback;
}
