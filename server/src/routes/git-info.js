import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

export const gitInfoRouter = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const SERVER_PACKAGE_JSON = path.join(PROJECT_ROOT, "server", "package.json");

gitInfoRouter.get("/versions", async (_req, res) => {
  try {
    const packageJson = JSON.parse(fs.readFileSync(SERVER_PACKAGE_JSON, "utf8"));
    const packageStat = fs.statSync(SERVER_PACKAGE_JSON);
    const version = String(packageJson.version || "unknown");
    const packageUpdatedAt = packageStat?.mtimeMs
      ? new Date(packageStat.mtimeMs).toISOString()
      : null;

    res.json({
      summary: {
        version,
        source: "disk",
        package_updated_at: packageUpdatedAt,
        source_file: path.relative(PROJECT_ROOT, SERVER_PACKAGE_JSON).replace(/\\/g, "/")
      },
      entries: [{
        version,
        created_at: packageUpdatedAt,
        commit: "",
        subject: path.relative(PROJECT_ROOT, SERVER_PACKAGE_JSON).replace(/\\/g, "/")
      }]
    });
  } catch (err) {
    res.status(500).json({
      error: "version_info_unavailable",
      detail: err?.message || "Unable to read on-disk version metadata"
    });
  }
});
