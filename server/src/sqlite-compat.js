import path from "path";
import { DatabaseSync } from "node:sqlite";

function normalizeArgs(paramsOrCb, maybeCb) {
  let params = [];
  let cb = null;

  if (typeof paramsOrCb === "function") {
    cb = paramsOrCb;
  } else {
    if (paramsOrCb !== undefined && paramsOrCb !== null) {
      params = Array.isArray(paramsOrCb) ? paramsOrCb : [paramsOrCb];
    }
    if (typeof maybeCb === "function") cb = maybeCb;
  }

  return { params, cb };
}

class CompatDatabase {
  constructor(filePath) {
    this._db = new DatabaseSync(path.resolve(filePath));
  }

  serialize(fn) {
    if (typeof fn === "function") fn();
    return this;
  }

  exec(sql) {
    this._db.exec(sql);
    return this;
  }

  run(sql, paramsOrCb, maybeCb) {
    const { params, cb } = normalizeArgs(paramsOrCb, maybeCb);
    try {
      const stmt = this._db.prepare(sql);
      const info = stmt.run(...params);
      const context = {
        lastID: Number(info?.lastInsertRowid ?? 0),
        changes: Number(info?.changes ?? 0)
      };
      if (cb) cb.call(context, null);
      return this;
    } catch (error) {
      if (cb) {
        cb(error);
        return this;
      }
      throw error;
    }
  }

  get(sql, paramsOrCb, maybeCb) {
    const { params, cb } = normalizeArgs(paramsOrCb, maybeCb);
    try {
      const stmt = this._db.prepare(sql);
      const row = stmt.get(...params);
      if (cb) cb(null, row);
      return this;
    } catch (error) {
      if (cb) {
        cb(error);
        return this;
      }
      throw error;
    }
  }

  all(sql, paramsOrCb, maybeCb) {
    const { params, cb } = normalizeArgs(paramsOrCb, maybeCb);
    try {
      const stmt = this._db.prepare(sql);
      const rows = stmt.all(...params);
      if (cb) cb(null, rows);
      return this;
    } catch (error) {
      if (cb) {
        cb(error);
        return this;
      }
      throw error;
    }
  }

  close(cb) {
    try {
      this._db.close();
      if (typeof cb === "function") cb(null);
    } catch (error) {
      if (typeof cb === "function") cb(error);
      else throw error;
    }
  }
}

export function openDatabase(filePath) {
  return new CompatDatabase(filePath);
}
