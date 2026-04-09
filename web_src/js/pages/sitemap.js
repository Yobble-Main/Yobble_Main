const listEl = document.getElementById("sitemapList");
const statusEl = document.getElementById("sitemapStatus");
const urlCountEl = document.getElementById("urlCount");
const topPriorityEl = document.getElementById("topPriority");
const lastModifiedEl = document.getElementById("lastModified");
const heroArtEl = document.getElementById("sitemapHeroArt");

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function buildEntry(entry) {
  const href = entry.loc || "#";
  const pathname = (() => {
    try {
      return new URL(href).pathname || href;
    } catch {
      return href;
    }
  })();

  const article = document.createElement("article");
  article.className = "card sitemap-entry";
  article.innerHTML = `
    <div class="sitemap-entry__main">
      <div class="sitemap-entry__url">${escapeHtml(pathname)}</div>
      <div class="meta">${escapeHtml(href)}</div>
      <div class="sitemap-entry__meta small">
        Last modified: ${escapeHtml(formatDate(entry.lastmod))}
      </div>
    </div>
    <div class="sitemap-entry__side">
      <span class="pill">${escapeHtml(entry.changefreq || "unknown")}</span>
      <span class="pill">${escapeHtml(entry.priority || "-")} priority</span>
      <a class="action" href="${href}">Open</a>
    </div>
  `;
  return article;
}

async function loadSitemap() {
  statusEl.textContent = "Loading live sitemap feed…";
  try {
    const response = await fetch("/sitemap.xml", { headers: { Accept: "application/xml,text/xml" } });
    if (!response.ok) {
      throw new Error(`Failed to load sitemap (${response.status})`);
    }

    const xmlText = await response.text();
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");
    const parserError = xml.querySelector("parsererror");
    if (parserError) {
      throw new Error("Sitemap XML could not be parsed");
    }

    const entries = Array.from(xml.querySelectorAll("url")).map((node) => ({
      loc: node.querySelector("loc")?.textContent?.trim() || "",
      lastmod: node.querySelector("lastmod")?.textContent?.trim() || "",
      changefreq: node.querySelector("changefreq")?.textContent?.trim() || "",
      priority: node.querySelector("priority")?.textContent?.trim() || ""
    }));

    const sorted = entries.slice().sort((a, b) => {
      const pa = Number(a.priority || 0);
      const pb = Number(b.priority || 0);
      return pb - pa;
    });

    urlCountEl.textContent = String(entries.length);
    topPriorityEl.textContent = sorted[0]?.priority || "-";
    lastModifiedEl.textContent = formatDate(entries[0]?.lastmod || sorted[0]?.lastmod || "");
    heroArtEl.textContent = `${entries.length} indexed pages`;

    listEl.innerHTML = "";
    if (!entries.length) {
      statusEl.textContent = "No sitemap URLs were returned.";
      const empty = document.createElement("div");
      empty.className = "sitemap-empty";
      empty.textContent = "No indexed pages yet.";
      listEl.appendChild(empty);
      return;
    }

    statusEl.textContent = `Showing ${entries.length} URLs from the live sitemap.`;
    for (const entry of sorted) {
      listEl.appendChild(buildEntry(entry));
    }
  } catch (error) {
    heroArtEl.textContent = "Sitemap unavailable";
    statusEl.textContent = error?.message || "Failed to load sitemap.";
    listEl.innerHTML = `<div class="sitemap-empty">The sitemap feed could not be loaded right now.</div>`;
  }
}

loadSitemap();
