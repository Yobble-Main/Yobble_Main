import express from "express";
import { all, get, run } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";

export const roadmapRouter = express.Router();

const ROADMAP_ROLES = ["admin", "mod", "moderator"];

roadmapRouter.get("/", async (req, res) => {
  try {
    const status = String(req.query.status || "published");
    const needsMod = status !== "published";
    if (needsMod) {
      return requireAuth(req, res, () =>
        requireRole(...ROADMAP_ROLES)(req, res, async () => {
          const rows = await all(
            `SELECT id, title, body, status, sort_order, created_at, updated_at, created_by
             FROM roadmap_entries
             WHERE (?='all' OR status=?)
             ORDER BY sort_order ASC, created_at DESC, id DESC`,
            [status, status]
          );
          res.json({ entries: rows });
        })
      );
    }

    const rows = await all(
      `SELECT id, title, body, status, sort_order, created_at, updated_at, created_by
       FROM roadmap_entries
       WHERE status='published'
       ORDER BY sort_order ASC, created_at DESC, id DESC`
    );
    res.json({ entries: rows });
  } catch (err) {
    console.error("roadmap list error", err);
    res.status(500).json({ error: "server_error" });
  }
});

roadmapRouter.post("/", requireAuth, requireRole(...ROADMAP_ROLES), async (req, res) => {
  try {
    const title = String(req.body?.title || "").trim().slice(0, 140);
    const body = String(req.body?.body || "").trim().slice(0, 20000);
    const status = String(req.body?.status || "published").trim();
    const sortOrder = Number(req.body?.sort_order || 0);
    if (!title || !body) return res.status(400).json({ error: "missing_fields" });
    if (!["published", "draft"].includes(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }
    if (!Number.isFinite(sortOrder)) {
      return res.status(400).json({ error: "invalid_sort_order" });
    }
    const now = Date.now();
    const result = await run(
      `INSERT INTO roadmap_entries(title, body, created_at, created_by, status, updated_at, sort_order)
       VALUES(?,?,?,?,?,?,?)`,
      [title, body, now, req.user.username, status, now, Math.trunc(sortOrder)]
    );
    res.json({ ok: true, id: result.lastID });
  } catch (err) {
    console.error("roadmap create error", err);
    res.status(500).json({ error: "server_error" });
  }
});

roadmapRouter.put("/:id", requireAuth, requireRole(...ROADMAP_ROLES), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid_id" });
    const row = await get("SELECT id FROM roadmap_entries WHERE id=?", [id]);
    if (!row) return res.status(404).json({ error: "not_found" });

    const title = req.body?.title != null ? String(req.body.title || "").trim().slice(0, 140) : null;
    const body = req.body?.body != null ? String(req.body.body || "").trim().slice(0, 20000) : null;
    const status = req.body?.status != null ? String(req.body.status || "").trim() : null;
    const sortOrder = req.body?.sort_order != null ? Number(req.body.sort_order) : null;

    if (status && !["published", "draft"].includes(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }
    if (sortOrder != null && !Number.isFinite(sortOrder)) {
      return res.status(400).json({ error: "invalid_sort_order" });
    }

    const now = Date.now();
    await run(
      `UPDATE roadmap_entries
       SET title=COALESCE(?, title),
           body=COALESCE(?, body),
           status=COALESCE(?, status),
           sort_order=COALESCE(?, sort_order),
           updated_at=?
       WHERE id=?`,
      [title, body, status, sortOrder != null ? Math.trunc(sortOrder) : null, now, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("roadmap update error", err);
    res.status(500).json({ error: "server_error" });
  }
});
