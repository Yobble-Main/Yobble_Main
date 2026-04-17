const THEME_KEY = "yobble:theme";
const root = document.documentElement;

function getThemePreference() {
  const value = String(localStorage.getItem(THEME_KEY) || "system").toLowerCase();
  return ["light", "dark", "system"].includes(value) ? value : "system";
}

function resolveTheme(preference = getThemePreference()) {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(preference = getThemePreference()) {
  const theme = resolveTheme(preference);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  return theme;
}

export function setThemePreference(preference) {
  const value = String(preference || "system").toLowerCase();
  const next = ["light", "dark", "system"].includes(value) ? value : "system";
  localStorage.setItem(THEME_KEY, next);
  return applyTheme(next);
}

export function bindThemeSelect(select) {
  if (!select) return;
  select.value = getThemePreference();
  select.addEventListener("change", () => {
    setThemePreference(select.value);
  });
}

let systemWatcherInstalled = false;

export function initTheme() {
  root.classList.add("theme-loading");
  applyTheme();
  if (systemWatcherInstalled) return;
  systemWatcherInstalled = true;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (getThemePreference() === "system") {
      applyTheme("system");
    }
  };
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", onChange);
  } else if (typeof media.addListener === "function") {
    media.addListener(onChange);
  }
  requestAnimationFrame(() => {
    root.classList.remove("theme-loading");
  });
}

initTheme();
