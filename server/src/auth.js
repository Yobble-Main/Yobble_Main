import jwt from "jsonwebtoken";
import { get, run } from "./db.js";

function loadJwtSecret() {
  const configured = String(process.env.JWT_SECRET || "").trim();
  if (configured) return configured;

  const fallback = "yobble-local-development-jwt-secret";
  process.env.JWT_SECRET = fallback;
  console.warn("[auth] JWT_SECRET was not set; using local development fallback.");
  return fallback;
}

const JWT_SECRET = loadJwtSecret();
const TOKEN_TTL = "7d";
const ROLE_ORDER = { user: 0, moderator: 1, admin: 2 };
const USER_SELECT = `SELECT id, username, role, is_banned, ban_reason, banned_at, timeout_until, timeout_reason,
                           delete_at, deleted_at
                    FROM users WHERE id=?`;

export function signToken(user) {
  return jwt.sign(
    { uid: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function getBearerToken(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

async function loadUserFromToken(token) {
  const decoded = verifyToken(token);
  const user = await get(USER_SELECT, [decoded.uid]);
  return user || null;
}

function toRequestUser(user, banState) {
  return {
    uid: user.id,
    username: user.username,
    role: user.role,
    is_banned: banState.isBanned,
    ban_reason: user.ban_reason || banState.ban?.reason || null,
    banned_at: user.banned_at || banState.ban?.created_at || null,
    timeout_until: banState.activeTempBan?.expires_at || user.timeout_until || null,
    timeout_reason: user.timeout_reason || banState.activeTempBan?.reason || null
  };
}

async function hasOpenAppeal(ban) {
  if (!ban?.id) return false;
  const appeal = await get(
    "SELECT id FROM ban_appeals WHERE ban_id=? AND status='open'",
    [ban.id]
  );
  return !!appeal;
}

async function getBanState(user) {
  const now = Date.now();
  const permaBan = await get(
    `SELECT id, reason, created_at, expires_at
     FROM bans
     WHERE target_type='user' AND target_id=?
       AND lifted_at IS NULL
       AND expires_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [user.id]
  );

  if (permaBan) {
    if (user.timeout_until || user.timeout_reason) {
      await run(
        "UPDATE users SET timeout_until=NULL, timeout_reason=NULL WHERE id=?",
        [user.id]
      );
      user.timeout_until = null;
      user.timeout_reason = null;
    }
    return {
      now,
      permaBan,
      activeTempBan: null,
      ban: permaBan,
      isBanned: true,
      hasOpenAppeal: false
    };
  }

  const activeTempBan = await get(
    `SELECT id, reason, created_at, expires_at
     FROM bans
     WHERE target_type='user' AND target_id=?
       AND lifted_at IS NULL
       AND expires_at IS NOT NULL
       AND expires_at > ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [user.id, now]
  );

  if (activeTempBan) {
    const reason = activeTempBan.reason || "temporary_ban";
    if (user.timeout_until !== activeTempBan.expires_at || user.timeout_reason !== reason) {
      await run(
        "UPDATE users SET timeout_until=?, timeout_reason=? WHERE id=?",
        [activeTempBan.expires_at, reason, user.id]
      );
      user.timeout_until = activeTempBan.expires_at;
      user.timeout_reason = reason;
    }
  } else {
    if (user.is_banned) {
      await run(
        `UPDATE users
         SET is_banned=0, ban_reason=NULL, banned_at=NULL
         WHERE id=?`,
        [user.id]
      );
      user.is_banned = 0;
      user.ban_reason = null;
      user.banned_at = null;
    }
    if (user.timeout_until) {
      await run(
        "UPDATE users SET timeout_until=NULL, timeout_reason=NULL WHERE id=?",
        [user.id]
      );
      user.timeout_until = null;
      user.timeout_reason = null;
    }
  }

  return {
    now,
    permaBan: null,
    activeTempBan,
    ban: activeTempBan,
    isBanned: false,
    hasOpenAppeal: await hasOpenAppeal(activeTempBan)
  };
}

export async function getUserAuthState(user) {
  return getBanState(user);
}

function sendAuthBlock(res, user, banState) {
  if (banState.permaBan || (user.is_banned && banState.activeTempBan)) {
    const ban = banState.permaBan || banState.activeTempBan;
    return res.status(403).json({
      error: "account_banned",
      reason: ban?.reason || user.ban_reason || null,
      banned_at: user.banned_at || ban?.created_at || null
    });
  }

  if (banState.activeTempBan && !banState.hasOpenAppeal) {
    return res.status(403).json({
      error: "account_timed_out",
      until: banState.activeTempBan.expires_at,
      reason: banState.activeTempBan.reason || user.timeout_reason || null
    });
  }

  if (user.timeout_until && user.timeout_until > banState.now) {
    return res.status(403).json({
      error: "account_timed_out",
      until: user.timeout_until,
      reason: user.timeout_reason || null
    });
  }

  return null;
}

function normalizeRole(role) {
  return role === "mod" ? "moderator" : role;
}

async function authenticate(req, res, next, { optional = false, allowBanned = false } = {}) {
  const token = getBearerToken(req);
  if (!token) {
    return optional ? next() : res.status(401).json({ error: "not_authenticated" });
  }

  try {
    const user = await loadUserFromToken(token);
    if (!user) return res.status(401).json({ error: "invalid_token" });
    if (user.deleted_at || (user.delete_at && user.delete_at <= Date.now())) {
      return res.status(403).json({ error: "account_deleted" });
    }

    const banState = await getBanState(user);
    req.user = toRequestUser(user, banState);

    if (!allowBanned) {
      const blocked = sendAuthBlock(res, user, banState);
      if (blocked) return blocked;
    }

    return next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

export async function requireAuth(req, res, next) {
  return authenticate(req, res, next);
}

export async function optionalAuth(req, res, next) {
  return authenticate(req, res, next, { optional: true });
}

export async function requireAuthAllowBanned(req, res, next) {
  return authenticate(req, res, next, { allowBanned: true });
}

export function requireRole(...rolesOrMin) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "not_authenticated" });

    const userRole = normalizeRole(req.user.role);
    const roles = rolesOrMin.map(normalizeRole);

    if (rolesOrMin.length > 1) {
      if (!roles.includes(userRole)) {
        return res.status(403).json({ error: "forbidden" });
      }
      return next();
    }

    const minRole = roles[0];
    if (minRole && ROLE_ORDER[minRole] != null) {
      const u = ROLE_ORDER[userRole] ?? -1;
      const m = ROLE_ORDER[minRole] ?? 999;
      if (u < m) return res.status(403).json({ error: "forbidden" });
      return next();
    }

    if (minRole && userRole !== minRole) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}
