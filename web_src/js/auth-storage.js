const AUTH_KEYS = ["token", "username", "role"];
const AUTH_BACKUP_KEY = "yobble:auth-backup";

const storageProto = Object.getPrototypeOf(window.localStorage);
const rawSetItem = storageProto.setItem;
const rawGetItem = storageProto.getItem;
const rawRemoveItem = storageProto.removeItem;
const rawClear = storageProto.clear;

let authBypassDepth = 0;
let storageGuardsInstalled = false;

function withAuthBypass(fn) {
  authBypassDepth += 1;
  try {
    return fn();
  } finally {
    authBypassDepth -= 1;
  }
}

function isAuthKey(key) {
  return AUTH_KEYS.includes(String(key));
}

function readBackup() {
  try {
    const raw = rawGetItem.call(window.localStorage, AUTH_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeBackup(state) {
  try {
    const snapshot = {};
    for (const key of AUTH_KEYS) {
      if (state?.[key]) {
        snapshot[key] = String(state[key]);
      }
    }
    if (snapshot.token) {
      rawSetItem.call(window.localStorage, AUTH_BACKUP_KEY, JSON.stringify(snapshot));
    } else {
      rawRemoveItem.call(window.localStorage, AUTH_BACKUP_KEY);
    }
  } catch {
    // Ignore backup write errors; the primary storage still matters.
  }
}

function readCurrentAuthState() {
  const state = {};
  for (const key of AUTH_KEYS) {
    const value = rawGetItem.call(window.localStorage, key);
    if (value) {
      state[key] = value;
    }
  }
  return state;
}

function restoreAuthState(state) {
  if (!state?.token) return false;
  withAuthBypass(() => {
    for (const key of AUTH_KEYS) {
      const value = state[key];
      if (value) {
        rawSetItem.call(window.localStorage, key, String(value));
      }
    }
    writeBackup(state);
  });
  return true;
}

export function installAuthStorageGuards() {
  if (storageGuardsInstalled) {
    return;
  }
  storageGuardsInstalled = true;

  storageProto.setItem = function (key, value) {
    const stringKey = String(key);
    const stringValue = String(value);
    if (this === window.localStorage && isAuthKey(stringKey)) {
      const result = rawSetItem.call(this, stringKey, stringValue);
      writeBackup({ ...readCurrentAuthState(), [stringKey]: stringValue });
      return result;
    }
    return rawSetItem.call(this, stringKey, stringValue);
  };

  storageProto.removeItem = function (key) {
    const stringKey = String(key);
    if (this === window.localStorage && isAuthKey(stringKey) && authBypassDepth === 0) {
      return undefined;
    }
    const result = rawRemoveItem.call(this, stringKey);
    if (this === window.localStorage && isAuthKey(stringKey)) {
      writeBackup(readCurrentAuthState());
    }
    return result;
  };

  storageProto.clear = function () {
    if (this === window.localStorage && authBypassDepth === 0) {
      const snapshot = readCurrentAuthState();
      const result = rawClear.call(this);
      restoreAuthState({ ...snapshot, ...readBackup() });
      return result;
    }
    return rawClear.call(this);
  };

  const backup = readBackup();
  if (backup?.token) {
    restoreAuthState(backup);
  }
}

export function rememberAuthState(auth = {}) {
  installAuthStorageGuards();
  const current = readCurrentAuthState();
  const next = {
    token: auth.token != null ? String(auth.token) : (current.token || ""),
    username: auth.username != null ? String(auth.username) : (current.username || ""),
    role: auth.role != null ? String(auth.role) : (current.role || "")
  };
  withAuthBypass(() => {
    if (next.token) {
      rawSetItem.call(window.localStorage, "token", next.token);
    }
    if (next.username) {
      rawSetItem.call(window.localStorage, "username", next.username);
    }
    if (next.role) {
      rawSetItem.call(window.localStorage, "role", next.role);
    }
    writeBackup(next);
  });
  return next;
}

export function repairAuthState() {
  installAuthStorageGuards();
  const current = readCurrentAuthState();
  const backup = readBackup();
  if (current.token) {
    const merged = {
      token: current.token,
      username: current.username || backup?.username || "",
      role: current.role || backup?.role || ""
    };
    writeBackup(merged);
    if ((!current.username && merged.username) || (!current.role && merged.role)) {
      withAuthBypass(() => {
        if (!current.username && merged.username) {
          rawSetItem.call(window.localStorage, "username", merged.username);
        }
        if (!current.role && merged.role) {
          rawSetItem.call(window.localStorage, "role", merged.role);
        }
      });
    }
    return merged;
  }
  if (backup?.token) {
    restoreAuthState(backup);
    return backup;
  }
  return current;
}

export function clearAuthState() {
  installAuthStorageGuards();
  withAuthBypass(() => {
    for (const key of AUTH_KEYS) {
      rawRemoveItem.call(window.localStorage, key);
    }
    rawRemoveItem.call(window.localStorage, AUTH_BACKUP_KEY);
  });
}

export function getAuthToken() {
  installAuthStorageGuards();
  return rawGetItem.call(window.localStorage, "token") || "";
}
