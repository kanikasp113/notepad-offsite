// server.js — MutaNotes backend
// Express + plain JSON file store (no native deps, no build tools needed).
// Notes persist to mutanotes.json in the project directory.

const express = require("express");
const fs      = require("fs");
const path    = require("path");
const { mutate } = require("./mutation");

const PORT    = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "mutanotes.json");

// ── JSON store helpers ────────────────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DB_FILE)) return { notes: [], nextId: 1 };
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return { notes: [], nextId: 1 }; }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

// ── Mutation level from view_count ────────────────────────────────────────────
// 0 views  → level 0 (untouched)
// 1–2      → level 1 (subtle)
// 3–5      → level 2 (moderate)
// 6+       → level 3 (unhinged)
// +15% random escalation for surprise
function levelForViewCount(count) {
  let base = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : 3;
  if (base < 3 && Math.random() < 0.15) base = Math.min(base + 1, 3);
  return base;
}

function nowIso() { return new Date().toISOString(); }

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// List all notes (no body, no mutation)
app.get("/api/notes", (_req, res) => {
  const db = loadDB();
  const summary = db.notes.map(({ id, title, view_count, created_at, updated_at }) => ({
    id, title, view_count, created_at, updated_at,
  }));
  res.json(summary.sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
});

// Create a note
app.post("/api/notes", (req, res) => {
  const { title = "Untitled", body = "" } = req.body;
  if (typeof title !== "string" || typeof body !== "string") {
    return res.status(400).json({ error: "title and body must be strings" });
  }
  const db = loadDB();
  const note = {
    id: db.nextId++,
    title: title.trim().slice(0, 200),
    body,
    view_count: 0,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.notes.push(note);
  saveDB(db);
  res.status(201).json(note);
});

// View a note — increments view_count, returns mutated body
app.get("/api/notes/:id", (req, res) => {
  const db = loadDB();
  const note = db.notes.find((n) => n.id === parseInt(req.params.id, 10));
  if (!note) return res.status(404).json({ error: "Note not found" });

  const level = levelForViewCount(note.view_count);
  note.view_count += 1;
  note.updated_at = nowIso();
  saveDB(db);

  res.json({
    id: note.id,
    title: note.title,
    body: mutate(note.body, level),
    mutation_level: level,
    view_count: note.view_count,
    created_at: note.created_at,
  });
});

// Peek at original — does NOT increment view_count
app.get("/api/notes/:id/original", (req, res) => {
  const db = loadDB();
  const note = db.notes.find((n) => n.id === parseInt(req.params.id, 10));
  if (!note) return res.status(404).json({ error: "Note not found" });
  res.json({ id: note.id, title: note.title, body: note.body, view_count: note.view_count });
});

// Update a note — resets view_count (you wrote something new)
app.put("/api/notes/:id", (req, res) => {
  const db = loadDB();
  const note = db.notes.find((n) => n.id === parseInt(req.params.id, 10));
  if (!note) return res.status(404).json({ error: "Note not found" });

  const { title, body } = req.body;
  if (title !== undefined && typeof title !== "string") {
    return res.status(400).json({ error: "title must be a string" });
  }
  if (body !== undefined && typeof body !== "string") {
    return res.status(400).json({ error: "body must be a string" });
  }

  if (title !== undefined) note.title = title.trim().slice(0, 200);
  if (body  !== undefined) note.body  = body;
  note.view_count = 0;  // reset — fresh text, fresh start
  note.updated_at = nowIso();
  saveDB(db);
  res.json(note);
});

// Delete a note
app.delete("/api/notes/:id", (req, res) => {
  const db = loadDB();
  const idx = db.notes.findIndex((n) => n.id === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).json({ error: "Note not found" });
  db.notes.splice(idx, 1);
  saveDB(db);
  res.status(204).end();
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, "127.0.0.1", () => {
  console.log(`MutaNotes running → http://localhost:${PORT}`);
});
