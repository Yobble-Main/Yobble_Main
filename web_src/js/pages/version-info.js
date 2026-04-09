import { api } from "../api.js";

const summaryEl = document.getElementById("summary");
const statusEl = document.getElementById("status");
const entriesEl = document.getElementById("entries");
const listTitleEl = document.getElementById("listTitle");

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function card(title, value) {
  const el = document.createElement("div");
  el.className = "card";
  el.innerHTML = `
    <div class="muted">${title}</div>
    <div style="font-size:1.1rem;font-weight:700;margin-top:8px">${value}</div>
  `;
  return el;
}

function entryCard(entry) {
  const el = document.createElement("div");
  el.className = "card";
  el.innerHTML = `
    <h3>${entry.version || "Unknown"}</h3>
    <div class="muted">Package updated: ${formatDate(entry.created_at)}</div>
    <div class="muted">Source file: ${entry.subject || "Unknown"}</div>
  `;
  return el;
}

async function load() {
  try {
    const data = await api.get("/api/git-info/versions");
    const summary = data.summary || {};
    const entries = Array.isArray(data.entries) ? data.entries : [];
    listTitleEl.textContent = "Latest On-Disk Version";

    summaryEl.innerHTML = "";
    summaryEl.appendChild(card("Version", summary.version || "unknown"));
    summaryEl.appendChild(card("Source", summary.source || "unknown"));
    summaryEl.appendChild(card("Package Updated", formatDate(summary.package_updated_at)));

    statusEl.textContent = entries.length
      ? "Showing the version from the on-disk package file."
      : "No on-disk version data found.";

    entriesEl.innerHTML = "";
    for (const entry of entries) {
      entriesEl.appendChild(entryCard(entry));
    }
  } catch (err) {
    statusEl.textContent = err?.data?.detail || err?.message || "Failed to load version info.";
  }
}

load();
