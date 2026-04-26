import { api } from "./api.js";
import { clearAuthState, installAuthStorageGuards, rememberAuthState, repairAuthState } from "./auth-storage.js";

installAuthStorageGuards();
repairAuthState();

function getCurrentRequestPath() {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function sanitizeRedirectTarget(target, fallback = "/index") {
  const safeFallback = typeof fallback === "string" && fallback.startsWith("/") ? fallback : "/index";
  const raw = typeof target === "string" ? target.trim() : "";
  if (!raw) return safeFallback;
  if (/^(?:[a-z][a-z0-9+\-.]*:)?\/\//i.test(raw)) return safeFallback;

  const normalized = raw.startsWith("/") ? raw : `/${raw.replace(/^\/+/, "")}`;
  try {
    const resolved = new URL(normalized, location.origin);
    if (resolved.origin !== location.origin) return safeFallback;
    const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    if (path === "/login" || path.startsWith("/login?") || path === "/register" || path.startsWith("/register?")) {
      return safeFallback;
    }
    return path || safeFallback;
  } catch {
    return safeFallback;
  }
}

export function getSessionRedirectTarget(fallback = "/index") {
  const params = new URLSearchParams(location.search);
  return sanitizeRedirectTarget(params.get("redirect"), fallback);
}

export function redirectToLogin(target = getCurrentRequestPath()) {
  const redirect = sanitizeRedirectTarget(target, "/index");
  const href = `/login?redirect=${encodeURIComponent(redirect)}`;
  location.href = href;
  return href;
}

function redirectToBannedAccount(err) {
  if (err?.status === 403 && err?.data?.error === "account_banned") {
    location.href = "/Permanetly-Banned";
    return true;
  }
  if (err?.status === 403 && err?.data?.error === "account_timed_out") {
    const until = err?.data?.until ? `?until=${encodeURIComponent(err.data.until)}` : "";
    location.href = `/temporay-banned${until}`;
    return true;
  }
  return false;
}

if (typeof window !== "undefined") {
  window.YOBBLE_AUTH = {
    sanitizeRedirectTarget,
    getSessionRedirectTarget,
    redirectToLogin
  };
}

export async function requireAuth(){
  const token = localStorage.getItem("token");
  if(!token){
    redirectToLogin();
    throw new Error("no token");
  }
  try{
    const res = await api.get("/api/auth/me");
    const user = res.user || res;
    window.PLATFORM_USER = user;
    return user;
  }catch(err){
    if (redirectToBannedAccount(err)) {
      throw err;
    }
    if (err?.status === 401 || err?.status === 403) {
      clearAuthState();
      redirectToLogin();
    }
    throw err;
  }
}
export async function requireAuthAllowBanned(){
  const token = localStorage.getItem("token");
  if(!token){
    redirectToLogin();
    throw new Error("no token");
  }
  try{
    const res = await api.get("/api/auth/me-allow-banned");
    const user = res.user || res;
    window.PLATFORM_USER = user;
    return user;
  }catch(err){
    if (redirectToBannedAccount(err)) {
      throw err;
    }
    if (err?.status === 401 || err?.status === 403) {
      clearAuthState();
      redirectToLogin();
    }
    throw err;
  }
}
export async function logout(){
  try{
    await api.post("/api/auth/logout", {});
  }catch{}
  clearAuthState();
  location.href = "/login";
}

export async function requireLogin(){
  return requireAuth();
}

export async function requireLoginOrRedirect(){
  return requireAuth();
}

export async function login(username, password, extras = {}){
  const payload = {
    username: String(username || "").trim(),
    password: String(password || ""),
    ...extras
  };
  const data = await api.post("/api/auth/login", payload);
  rememberAuthState({
    token: data?.token,
    username: data?.user?.username,
    role: data?.user?.role
  });
  return data;
}

export async function register(username, email, password){
  const payload = {
    username: String(username || "").trim(),
    password: String(password || "")
  };
  const data = await api.post("/api/auth/register", payload);
  rememberAuthState({
    token: data?.token,
    username: data?.user?.username,
    role: data?.user?.role
  });
  return data;
}
