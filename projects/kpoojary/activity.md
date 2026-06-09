# MutaNotes — Agent Activity Log

Append-only diary of everything the coder agent shipped.
Most recent entry at the top.

---

## 2026-06-09 16:25 — [kpoojary] Cyclic mutation levels — reset after every 10 views

- **Issue:** #20
- **Branch:** kpoojary/cyclic-mutation
- **PR:** kanikasp113/notepad-offsite#23
- **What:** Mutation levels now cycle every 10 views instead of permanently sticking at unhinged; the cycle number is displayed in the view toolbar
- **Files changed:**
  - `projects/kpoojary/server.js` — Rewrote `baseLevelForViewCount()` with cyclic formula `(view_count - 1) % 10`, added `cycleForViewCount()`, included `cycle` in list/view/original API responses
  - `projects/kpoojary/public/app.js` — View toolbar shows "cycle N" next to view count
  - `projects/kpoojary/activity.md` — This entry
- **Notes:** The 15% random escalation chance is preserved within each cycle. Cycle 0 means untouched (0 views). The formula matches the issue spec exactly.

---

## 2026-06-09 16:17 — [kpoojary] Show timestamp on notes — created and last viewed time

- **Issue:** #19
- **Branch:** kpoojary/note-timestamps
- **PR:** kanikasp113/notepad-offsite#22
- **What:** Added relative timestamps to the sidebar and absolute/relative timestamps to the note view toolbar, with live refresh every 60 seconds
- **Files changed:**
  - `projects/kpoojary/server.js` — Added `last_viewed_at` field set on each view; included in list and view responses
  - `projects/kpoojary/public/app.js` — Added `relativeTime()` and `formatAbsoluteDate()` helpers; sidebar shows relative time; toolbar shows "Created … at …" and "Last viewed … ago"; 60s setInterval refreshes timestamps
  - `projects/kpoojary/public/index.html` — Added `#note-timestamps` span in view toolbar
  - `projects/kpoojary/public/style.css` — Added `.view-timestamps`, `.ts-created`, `.ts-viewed`, `.ts-sep` styles
- **Notes:** Existing notes without `last_viewed_at` gracefully show null until first view. The `formatDate()` function was refactored to use `relativeTime()` internally.

---

## 2026-06-09 16:09 — [kpoojary] Color scheme selector — 5 themes

- **Issue:** #18
- **Branch:** kpoojary/color-themes
- **PR:** kanikasp113/notepad-offsite#21
- **What:** Added 5 switchable color themes (Void, Fog, Terminal, Dusk, Blood) with localStorage persistence and a swatch picker in the sidebar
- **Files changed:**
  - `projects/kpoojary/public/style.css` — Added CSS variable overrides for 4 new themes via `[data-theme]` selectors, plus theme picker styles
  - `projects/kpoojary/public/index.html` — Added theme swatch picker to sidebar bottom
  - `projects/kpoojary/public/app.js` — Added `initTheme()` / `applyTheme()` with localStorage persistence
- **Notes:** Theme switches instantly via CSS custom properties with no page reload. The mutation badge, unhinged glow, and all UI elements inherit theme colors through existing CSS variables.

---

## 2026-06-09 16:00 — [kpoojary] Fix invalid date display in note sidebar

- **Issue:** #15
- **Branch:** kpoojary/fix-invalid-date
- **PR:** kanikasp113/notepad-offsite#17
- **What:** Fixed `formatDate()` appending "Z" unconditionally, which caused "Invalid Date" when the ISO string already contained a timezone suffix
- **Files changed:**
  - `projects/kpoojary/public/app.js` — `formatDate()` now checks for existing timezone indicator before appending "Z"; also returns empty string for unparseable dates
- **Notes:** The JSON file store uses `new Date().toISOString()` which includes "Z", so the old code produced strings like "...ZZ" → Invalid Date.

---

## 2026-06-09 15:51 — [kpoojary] Mutation engine — word-swap level 1 and sentence rewrite level 2

- **Issue:** #5
- **Branch:** kpoojary/mutation-engine
- **PR:** kanikasp113/notepad-offsite#16
- **What:** Enhanced the local mutation engine with expanded synonym table (20+ new entries), improved level-1 punctuation preservation, more level-2 sentence transforms (unreliable narrator, qualifier, citation needed), 4 new unhinged templates (patient file, recipe, breaking news, fairy tale), and a level-3 fallback for very short text
- **Files changed:**
  - `projects/kpoojary/mutation.js` — Expanded SYNONYMS map, fixed punctuation-stripping bug in level-1 swaps, added 3 new level-2 transforms, added 4 new unhinged templates, added short-text fallback in level-3
- **Notes:** The mutation engine skeleton was created in PR #1 but issue #5 was never formally closed. This PR expands coverage and fixes edge cases.

---

## 2026-06-09 15:44 — [kpoojary] Mutation level tracking per note

- **Issue:** #4
- **Branch:** kpoojary/mutation-level-tracking
- **PR:** kanikasp113/notepad-offsite#14
- **What:** Added `mutation_level` to list and original API responses so the sidebar can display the level name (untouched/subtle/moderate/unhinged) alongside the colored dot, making mutation progression visible at a glance
- **Files changed:**
  - `projects/kpoojary/server.js` — Extracted `baseLevelForViewCount` helper; added `mutation_level` to list and original endpoints
  - `projects/kpoojary/public/app.js` — Sidebar now uses server-provided `mutation_level` and shows level name label
  - `projects/kpoojary/public/style.css` — Added `.level-label` styles with per-level colors
- **Notes:** The core level calculation, 15% escalation, badge pulse, and view_count reset were already in place. This PR surfaces the level in list/original responses and makes it visible in the sidebar.

---

## 2026-06-09 15:32 — [kpoojary] Peek original feature

- **Issue:** #3
- **Branch:** kpoojary/peek-original
- **PR:** kanikasp113/notepad-offsite#13
- **What:** Fixed hold-to-peek vs click conflict so the peek button works both as a toggle (click to open, click outside/Escape to close) and as hold-to-peek (hold to show, release to hide) without the trailing click reopening the overlay
- **Files changed:**
  - `projects/kpoojary/public/app.js` — Replaced conflicting click+mousedown/mouseup handlers with a `peekHeld` flag that suppresses the click after a hold gesture
- **Notes:** The peek overlay, original API endpoint, and Escape-to-close were already implemented in PR #1. This PR fixes the interaction bug and formally closes issue #3.

---

## 2026-06-09 15:24 — [kpoojary] Mutation animation — highlight changed words on view

- **Issue:** #2
- **Branch:** kpoojary/mutation-animation
- **PR:** kanikasp113/notepad-offsite#12
- **What:** Refined the mutation word-diff animation so it only fires at level 1+, tracks previous body per-note (not globally), and smoothly fades changed words from accent purple back to normal color within 1.5 seconds
- **Files changed:**
  - `projects/kpoojary/public/app.js` — Per-note lastBodyCache, mutation_level-aware animateMutation, fade-out class scheduling
  - `projects/kpoojary/public/style.css` — word-highlight keyframes with color in animation, .fade-out transition for smooth purple→normal fade
- **Notes:** Level 0 now shows text as-is with no spans/animation. Switching between notes no longer causes false word diffs. The unhinged red tint on the container was already implemented.

---

## 2026-06-09 15:12 — [kpoojary] Core note CRUD — create, read, update, delete

- **Issue:** #1
- **Branch:** kpoojary/crud-foundation
- **PR:** kanikasp113/notepad-offsite#1
- **What:** Implemented full note lifecycle with CRUD API, mutation engine, and frontend UI
- **Files changed:**
  - `projects/kpoojary/server.js` — Express server with all CRUD endpoints
  - `projects/kpoojary/mutation.js` — Local mutation engine (levels 0–3)
  - `projects/kpoojary/package.json` / `package-lock.json` — Express dependency
  - `projects/kpoojary/mutanotes.json` — JSON file store with seed data
  - `projects/kpoojary/public/index.html` — App shell with sidebar, view, editor panels
  - `projects/kpoojary/public/app.js` — Frontend logic: list, create, edit, delete, peek original
  - `projects/kpoojary/public/style.css` — Dark theme with mutation badges and animations
- **Notes:** All endpoints return correct HTTP status codes (201/200/204/404). Edit mode fetches /original endpoint. Sidebar refreshes after every operation without page reload.
