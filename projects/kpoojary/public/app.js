// app.js — MutaNotes frontend
// Vanilla JS, no build step required.

const API = "/api/notes";

// ── State ─────────────────────────────────────────────────────────────────────
let notes = [];        // list from server (no body)
let activeId = null;   // currently viewed note id
let isEditing = false;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const noteList        = document.getElementById("note-list");
const emptyState      = document.getElementById("empty-state");
const noteView        = document.getElementById("note-view");
const noteEditor      = document.getElementById("note-editor");

const titleDisplay    = document.getElementById("note-title-display");
const bodyDisplay     = document.getElementById("note-body-display");
const mutationBadge   = document.getElementById("mutation-badge");
const viewCountLabel  = document.getElementById("view-count-label");
const noteTimestamps  = document.getElementById("note-timestamps");

const btnNew          = document.getElementById("btn-new");
const btnEdit         = document.getElementById("btn-edit");
const btnDelete       = document.getElementById("btn-delete");
const btnPeek         = document.getElementById("btn-peek");
const btnSave         = document.getElementById("btn-save");
const btnCancel       = document.getElementById("btn-cancel");

const editorTitle     = document.getElementById("editor-title");
const editorBody      = document.getElementById("editor-body");

// ── Peek overlay ──────────────────────────────────────────────────────────────
const peekOverlay = (() => {
  const el = document.createElement("div");
  el.id = "peek-overlay";
  el.className = "hidden";
  el.innerHTML = `
    <div id="peek-card">
      <button id="peek-close" title="Close">✕</button>
      <h3>⟵ the original</h3>
      <div id="peek-original-body"></div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector("#peek-close").addEventListener("click", hidePeek);
  el.addEventListener("click", (e) => { if (e.target === el) hidePeek(); });
  return el;
})();
const peekBody = document.getElementById("peek-original-body");

// ── Helpers ───────────────────────────────────────────────────────────────────
function show(el)  { el.classList.remove("hidden"); }
function hide(el)  { el.classList.add("hidden"); }

function levelLabel(level) {
  return ["untouched", "subtle", "moderate", "unhinged"][level] ?? "unknown";
}

function setPanel(panel) {
  hide(emptyState);
  hide(noteView);
  hide(noteEditor);
  if (panel) show(panel);
}

function mutationBadgeClass(level) {
  return `badge badge-${level}`;
}

// ── Mutation reveal animation ─────────────────────────────────────────────────
// Per-note cache of the last displayed body text for accurate word diffs.
const lastBodyCache = {};

// Wraps each word in a span; words that differ from previous view get .changed
// class with staggered animation. Skipped entirely at level 0 (first view).
function animateMutation(container, newText, noteId, mutationLevel) {
  const prevText = lastBodyCache[noteId] || "";
  lastBodyCache[noteId] = newText;

  // Level 0 — show as-is, no animation
  if (mutationLevel === 0) {
    container.textContent = newText;
    return;
  }

  const newWords  = newText.split(" ");
  const prevWords = prevText.split(" ");

  container.innerHTML = "";
  container.classList.add("mutating");

  newWords.forEach((word, i) => {
    const span = document.createElement("span");
    span.className = "word";
    span.textContent = word + (i < newWords.length - 1 ? " " : "");
    if (word !== prevWords[i]) {
      span.classList.add("changed");
      span.style.animationDelay = `${Math.min(i * 15, 600)}ms`;
    }
    container.appendChild(span);
  });

  // After animation completes, remove .changed so words transition to normal color
  setTimeout(() => {
    container.querySelectorAll(".word.changed").forEach((el) => {
      el.classList.add("fade-out");
      el.classList.remove("changed");
    });
  }, 1000);

  // Clean up all animation classes
  setTimeout(() => {
    container.classList.remove("mutating");
    container.querySelectorAll(".word.fade-out").forEach((el) => {
      el.classList.remove("fade-out");
    });
  }, 1500);
}

// ── API calls ─────────────────────────────────────────────────────────────────
async function fetchNotes() {
  const res = await fetch(API);
  return res.json();
}

async function fetchNote(id) {
  const res = await fetch(`${API}/${id}`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

async function fetchOriginal(id) {
  const res = await fetch(`${API}/${id}/original`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

async function createNote(title, body) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body }),
  });
  return res.json();
}

async function updateNote(id, title, body) {
  const res = await fetch(`${API}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body }),
  });
  return res.json();
}

async function deleteNote(id) {
  await fetch(`${API}/${id}`, { method: "DELETE" });
}

// ── Render sidebar list ───────────────────────────────────────────────────────
function renderList() {
  noteList.innerHTML = "";
  if (notes.length === 0) {
    const li = document.createElement("li");
    li.style.color = "var(--text-dim)";
    li.style.fontSize = "0.8rem";
    li.style.padding = "8px";
    li.textContent = "No notes yet.";
    noteList.appendChild(li);
    return;
  }

  notes.forEach((n) => {
    const li = document.createElement("li");
    if (n.id === activeId) li.classList.add("active");
    li.setAttribute("role", "button");
    li.setAttribute("tabindex", "0");

    const level = n.mutation_level ?? 0;

    li.innerHTML = `
      <div class="note-list-title">
        <span class="level-dot level-dot-${level}"></span>${escapeHtml(n.title)}
      </div>
      <div class="note-list-meta">
        <span class="sidebar-time" data-iso="${escapeHtml(n.updated_at || "")}">${relativeTime(n.updated_at)}</span>
        <span class="level-label level-label-${level}">${levelLabel(level)}</span>
        <span>${n.view_count} view${n.view_count !== 1 ? "s" : ""}</span>
      </div>`;

    li.addEventListener("click", () => openNote(n.id));
    li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") openNote(n.id); });
    noteList.appendChild(li);
  });
}

// ── Open / view a note ────────────────────────────────────────────────────────
async function openNote(id) {
  if (isEditing && activeId === id) return;
  isEditing = false;
  activeId = id;
  renderList();

  const note = await fetchNote(id);

  titleDisplay.textContent = note.title;
  mutationBadge.className = mutationBadgeClass(note.mutation_level);
  mutationBadge.textContent = levelLabel(note.mutation_level);
  viewCountLabel.textContent = `view #${note.view_count}` +
    (note.cycle > 0 ? ` · cycle ${note.cycle}` : "");

  const createdStr = formatAbsoluteDate(note.created_at);
  const viewedStr = note.last_viewed_at ? relativeTime(note.last_viewed_at) : "just now";
  noteTimestamps.innerHTML =
    `<span class="ts-created">Created ${escapeHtml(createdStr)}</span>` +
    `<span class="ts-sep">·</span>` +
    `<span class="ts-viewed" data-iso="${escapeHtml(note.last_viewed_at || "")}">Last viewed ${escapeHtml(viewedStr)}</span>`;

  bodyDisplay.classList.toggle("unhinged", note.mutation_level === 3);

  animateMutation(bodyDisplay, note.body, id, note.mutation_level);

  setPanel(noteView);

  // Refresh list to update view_count in sidebar
  notes = await fetchNotes();
  renderList();
}

// ── Peek original ─────────────────────────────────────────────────────────────
async function showPeek() {
  if (!activeId) return;
  const note = await fetchOriginal(activeId);
  peekBody.textContent = note.body;
  show(peekOverlay);
}

function hidePeek() {
  hide(peekOverlay);
}

// ── Editor ────────────────────────────────────────────────────────────────────
function openEditor(title = "", body = "") {
  isEditing = true;
  editorTitle.value = title;
  editorBody.value = body;
  setPanel(noteEditor);
  editorTitle.focus();
}

async function saveNote() {
  const title = editorTitle.value.trim() || "Untitled";
  const body  = editorBody.value;

  if (activeId && isEditing) {
    // Update existing
    await updateNote(activeId, title, body);
  } else {
    // Create new
    const created = await createNote(title, body);
    activeId = created.id;
  }

  isEditing = false;
  notes = await fetchNotes();
  renderList();
  await openNote(activeId);
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function handleDelete() {
  if (!activeId) return;
  const note = notes.find((n) => n.id === activeId);
  if (!confirm(`Delete "${note?.title ?? "this note"}"?`)) return;
  await deleteNote(activeId);
  delete lastBodyCache[activeId];
  activeId = null;
  notes = await fetchNotes();
  renderList();
  setPanel(null);
  show(emptyState);
}

// ── Event wiring ──────────────────────────────────────────────────────────────
btnNew.addEventListener("click", () => {
  activeId = null;
  renderList();
  openEditor();
});

btnEdit.addEventListener("click", async () => {
  if (!activeId) return;
  const note = await fetchOriginal(activeId); // edit the original, not mutated
  openEditor(note.title, note.body);
});

btnDelete.addEventListener("click", handleDelete);

// Click toggles the peek overlay; hold-to-peek shows on press and hides on release.
// A hold (mousedown → mouseup within the button) suppresses the trailing click so
// the overlay doesn't immediately reopen.
let peekHeld = false;

btnPeek.addEventListener("mousedown", () => { peekHeld = true; showPeek(); });
btnPeek.addEventListener("mouseup", () => { if (peekHeld) { peekHeld = false; hidePeek(); } });
btnPeek.addEventListener("touchstart", () => { peekHeld = true; showPeek(); }, { passive: true });
btnPeek.addEventListener("touchend", () => { if (peekHeld) { peekHeld = false; hidePeek(); } });
btnPeek.addEventListener("click", (e) => {
  // If we just finished a hold gesture, suppress the click
  if (!peekOverlay.classList.contains("hidden")) return;
  showPeek();
});

btnSave.addEventListener("click", saveNote);

btnCancel.addEventListener("click", () => {
  isEditing = false;
  if (activeId) {
    openNote(activeId);
  } else {
    setPanel(null);
    show(emptyState);
  }
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Esc closes peek overlay
  if (e.key === "Escape") {
    if (!peekOverlay.classList.contains("hidden")) { hidePeek(); return; }
    if (isEditing) { btnCancel.click(); return; }
  }
  // Ctrl+S / Cmd+S to save in editor
  if ((e.ctrlKey || e.metaKey) && e.key === "s" && isEditing) {
    e.preventDefault();
    saveNote();
  }
  // Ctrl+N / Cmd+N to new note
  if ((e.ctrlKey || e.metaKey) && e.key === "n") {
    e.preventDefault();
    btnNew.click();
  }
});

// ── Utilities ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function parseIsoDate(iso) {
  if (!iso) return null;
  const hasTimezone = /Z|[+-]\d{2}:\d{2}$/.test(iso);
  const d = new Date(hasTimezone ? iso : iso + "Z");
  return isNaN(d.getTime()) ? null : d;
}

function relativeTime(iso) {
  const d = parseIsoDate(iso);
  if (!d) return "";
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDate(iso) {
  return relativeTime(iso);
}

function formatAbsoluteDate(iso) {
  const d = parseIsoDate(iso);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " at " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// ── Live timestamp refresh ────────────────────────────────────────────────────
setInterval(() => {
  document.querySelectorAll(".sidebar-time[data-iso]").forEach((el) => {
    const iso = el.getAttribute("data-iso");
    if (iso) el.textContent = relativeTime(iso);
  });
  document.querySelectorAll(".ts-viewed[data-iso]").forEach((el) => {
    const iso = el.getAttribute("data-iso");
    if (iso) el.textContent = `Last viewed ${relativeTime(iso)}`;
  });
}, 60000);

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  initTheme();
  notes = await fetchNotes();
  renderList();
})();

// ── Theme switcher ────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem("mutanotes-theme") || "";
  applyTheme(saved);

  document.getElementById("theme-picker").addEventListener("click", (e) => {
    const swatch = e.target.closest(".theme-swatch");
    if (!swatch) return;
    const theme = swatch.dataset.theme;
    applyTheme(theme);
    localStorage.setItem("mutanotes-theme", theme);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelectorAll(".theme-swatch").forEach((el) => {
    el.classList.toggle("active", el.dataset.theme === theme);
  });
}
