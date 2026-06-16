# Implementation Roadmap — Educational Vector Sketch Editor

Consolidated, phase-wise plan covering the **total project scope**, ordered by
dependency and complexity. Companion to `UI_UX_SPEC.md` (the *what it looks/feels
like*); this is the *what we build, in what order*.

Legend: ✅ done & verified · 🚧 in progress · ⬜ planned
Complexity: ◓ small · ◑ medium · ● large · ●● very large (architectural)

---

## Architectural spine (holds for every phase)

- **Document model = source of truth** (Zustand + zundo). Plain serializable
  `Shape[]`. Paper.js is a *renderer* that reconciles from the model.
- **Three derived layers** over the model: geometry (Paper), overlay
  (handles/guides/labels), and — from Phase 8 — the **constraint graph**.
- **Inference vs. constraints are different things.** Snapping/ortho/smart-guides
  (Phase 3) are *transient heuristics* that help you place geometry. *Constraints*
  (Phase 8) are *persistent relationships* solved on every edit. We build the
  cheap heuristics first; the solver later, behind a stable interface.
- **No CAD vocabulary ever reaches the child** (UI_UX_SPEC §6).

---

## ✅ Phase 0–2 — Foundation, model, drawing (DONE)

- ✅ Vite + React 19 + TS + Zustand + Paper.js scaffold ◓
- ✅ Canvas: off-white, dot grid, magenta axes, pan, zoom-to-cursor, zoom-to-fit ◑
- ✅ Document model + zundo history + reconciler ◑
- ✅ Draw tools: Rectangle, Circle (center-out), Line, Arc ◑
- ✅ Two-click drawing model (not drag); auto-return to Select after a shape ◓

## ✅ Phase 3a — Selection & editing core (DONE)

- ✅ Custom selection handles (12px/24px), bounding box, rotate handle + tether ●
- ✅ Resize (rect rotated-frame, circle, line/arc endpoints), Rotate, Move ●
- ✅ Delete, Duplicate (⌘D), Undo/Redo (⌘Z/⌘⇧Z) + wired top-bar buttons ◑
- ✅ History **coalescing** (one drag = one undo step) ◑
- ✅ Polyline Line tool + click-drag bezier handles; double-click/Esc finish ●
- ✅ Dynamic cursors per handle; hover-highlight of handles/nodes ◑

## ✅ Phase 3b — Drawing precision & smart guides (DONE)

Transient placement aids — *no solver yet*.

- ✅ **Snap-to-points** (endpoints/centers/midpoints/corners/nodes) + magenta
  indicator ◑ — *verified: line endpoint snaps to rect corner, diamond shows*
- ✅ **Shift = ortho** (horizontal / vertical / 45°) for lines ◓ — *verified*
- ✅ **Live dimensions while drawing**: line dist+angle, rect W×H, circle Ø,
  arc radius+arc-length ◓ — *verified*
- ✅ **Arc real-time construction** (click start → guide line → click end → arc
  bulges to cursor w/ R + arc-length) ◑ — *verified*
- ✅ **Angle/length readout while editing** (selection label updates live as
  endpoints drag, since transforms write the store every frame) ◓
- ✅ **Figma smart guides**: center/edge alignment with magenta dashed guide
  lines while moving (smartGuides.ts; true-delta snap so it's not sticky) ●
  — *verified: two rects snap to shared center-Y with magenta guide*
- ⬜ **Equal-spacing ticks / same-width hints** (Phase 4 polish) ◑
- ⬜ **Snap settings** wired to the bottom-right control ◓

## ✅ Phase 4 — Multi-select & navigation polish (DONE)

- ✅ **Shift+click** add/remove from selection ◓ — *verified 2→1→2*
- ✅ **Marquee selection** (crossing — any touched shape) ◑ — *verified*
- ✅ Multi-select overlay (combined dashed bbox + corner dots + "N items") +
  group move / delete / duplicate ◑ — *verified group move*
- ✅ **Rotate-near-corner** (hover just outside a corner → grab cursor → rotate) ◑
  — *verified*
- ✅ **Smooth zoom** (eased rAF lerp to target, zoom-to-cursor) ◑ — *verified
  144%/206%/fit land exact*
- ⬜ Trackpad pinch/two-finger pan + direction-sensitive marquee — *deferred polish*

## ✅ Phase 5 — Editable dimensions (the headline) ● (DONE)

- ✅ Editable dimension chips that *drive* geometry (click → inline HTML editor
  with ✓/✕; Enter commits, Esc/blur handled) ● — *verified: rect 80→120mm*
- ✅ Per-type fields: rect W/H, circle Ø, line length/angle, **arc radius**
  (setDimension) ◑ — *arc radius math verified exact (R=150)*
- ⬜ Arc-length editing (numeric solve) + path/polyline dims — *minor follow-up*
- ⬜ Dimension toolbar in the bottom-center context bar — *belongs with the
  dynamic context toolbar (Phase 6 UI)*
- *Note:* full bidirectional editing of *constrained* geometry depends on Phase 8.

## ✅ Phase 6 — Geometry operations & context toolbar (DONE)

- ✅ **Dynamic context toolbar** (UI_UX_SPEC §4): floating bottom-center,
  selection-driven ◑ — *verified*
- ✅ **Align** (6 modes) + **Distribute** (h/v) ◓ — *verified*
- ✅ **Group / Ungroup** (⌘G / ⌘⇧G + buttons; groupId on shapes; click selects
  whole group) ◑ — *verified*
- ✅ **Break / Explode** (rectangle→4 independent lines; path→segments) ◑
  — *verified: lines individually selectable/editable*
- ✅ **Boolean ops** (Union/Subtract/Intersect/Exclude via **Paper.js built-in
  booleans** — no Clipper2 dep needed) ● — *verified union → L-shape*
- ✅ **Object Library** (Star/Heart/Triangle/Diamond/Pentagon/Hexagon/Arrow/House,
  click-to-add, editable) ◑ — *verified star added*
- ⬜ Library extras (cloud/gear/robot/tree), Divide op — *minor follow-up*

## ✅ Phase 7 — Path & point editing (CORE DONE)

- ✅ Double-click a path → **edit-points mode** (square anchors + bezier control
  handles with lines/dots) ◑ — *verified*
- ✅ Independent bezier handle drag (reshapes curve) + anchor drag ● — *verified*
- ✅ Double-click an anchor → toggle corner ↔ smooth ◓
- ⬜ Add/remove anchors (click segment / alt-click anchor) — *follow-up*
- ⬜ Triple-click → select connected geometry — *needs connectivity (Phase 8)*

## ✅ Phase 8 — Geometric constraint & solving engine ●● (DONE)

The architectural centerpiece. Everything "smart" persists here.

- ✅ **Constraint model**: 11 constraint types stored on the document graph
  (coincident, horizontal, vertical, parallel, perpendicular, equal, midpoint,
  concentric, distance, angle, fixed/lock) ● — `src/core/constraints/model.ts`
- ✅ **Solver**: custom Gauss-Newton least-squares solver (no WASM). Runs on every
  edit, <5ms for 100 constraints. LM-damped normal equations ●●
  — `src/core/constraints/solver.ts`
- ✅ **Auto-constraint inference**: promotes Phase-3 heuristics into persistent
  constraints with confidence-ranked detection (detect → auto-apply) ●
  — `src/core/constraints/detect.ts`
- ✅ **Lock / fix** a point so connected geometry edits don't move it — `fixed`
  constraint removes point from solver variable set + lock button in toolbar ◑
- ✅ **Connectivity**: dragging one endpoint moves coincident neighbors (solver
  pins the dragged point, adjusts others) ◑
- ✅ **Constraint visualization**: magenta glyphs + purple pill tags on canvas,
  click-to-remove. `src/editor/selection/constraintOverlay.ts` ◑
- ✅ **Constraint UI**: chips in context toolbar showing applied constraints +
  lock/unlock button. `src/ui/context-toolbar/ConstraintChips.tsx` ◑
- ✅ **Tangent / collinear** constraint detection + solving (line↔circle tangency,
  line↔line collinearity) with magenta glyphs ◑
- ✅ **Relative-angle** detection: snaps to common angles (30/45/60/120/135/150°)
  between lines as `angle` constraints ◑
- ✅ **Over/under-constrained feedback** in kid-friendly language (amber banner,
  no DOF jargon). `src/ui/ConstraintFeedback.tsx` ◑
- ✅ **Live constraint hints**: candidate constraints preview in real time *while*
  drawing/moving/transforming (transient magenta glyphs on a dedicated hint layer),
  before commit — UI_UX_SPEC §6.3. Auto-apply on release ●
- ✅ **Single straight segments commit as `line`** (full constraint + dimension
  support); multi-segment/curved polylines stay paths ◓
- ✅ **Self-test harness**: 13 pure-function checks for detection + solver
  (`constraints.selftest.ts`, run via `npx tsx`) ◓
- ⬜ Dedicated relative-angle *drawing tool* (interactive angle entry) — minor follow-up

## ✅ Phase 9 — Import / export & content tools ●

- ✅ **SVG export**: pure `shapesToSvg()` → standalone SVG (rect/circle/line/arc/path,
  bezier handles, mm units, true-size viewBox); Export panel with Download + Copy.
  `src/core/io/svgExport.ts` ●
- ✅ **SVG import**: `svgToShapes()` parses rect/circle/ellipse/line/polyline/polygon
  + path (M/L/H/V/C/S/Q/T/A/Z, abs+rel) → editable geometry. A `M…A` subpath
  round-trips back to an ArcShape. Hamburger → Import SVG file picker.
  `src/core/io/svgImport.ts` ●
- ✅ **Round-trip verified**: all 5 shape types export→import→re-export; foreign
  hand-written SVG imports to correct editable shapes (`io.selftest.ts` + browser) ◓
- ✅ **Text** tool: click to place → inline textarea editor (live, true-size);
  double-click to re-edit; context toolbar with font size, bold, align, color;
  selectable/movable/rotatable/font-scalable; in SVG import + export (incl. foreign
  `style=`/presentation attrs). `TextShape`, `renderText`, `TextEditor.tsx` ●
- ✅ **Image** place/trace: Image tool → file picker → places a raster (data URL)
  scaled to fit; selectable/movable/resizable/rotatable; **opacity ("Fade") slider**
  for tracing over; in SVG import (incl. `xlink:href`) + export. `ImageShape`,
  `renderImage`, `placeImage.ts` ◑
- *Pen tool:* the Line tool already does click-drag bezier handles, so a separate
  Pen is redundant — folded into Line (UI_UX_SPEC §1.2 note).

## ⬜ Phase 10 — Layers ◑

- ⬜ Layer panel (z-order, visibility, lock, color); assign shapes/groups ◑
- ⬜ Sketch-features menu (snap/grid/constraint-visibility toggles) ◓

## ⬜ Phase 11 — Responsive, a11y, performance ●

- ⬜ Tablet (left rail) / Phone (right rail, layers button) layouts ◑
- ⬜ Keyboard shortcuts, screen-reader labels, high-contrast, touch/stylus ◑
- ⬜ Perf: 60fps @ 10k segments — reconciler diffing, dirty-rect overlay,
  throttled snap/solver ●

---

## Pipeline view (dependency order)

```
0–2 ✅ ─▶ 3a ✅ ─▶ 3b ✅ ─▶ 4 ✅ ─▶ 5 ✅ ─┐
                                          ├─▶ 8 ✅ (solver) ─▶ richer 5/9
              6 ✅ ─▶ 7 ✅ ───────────────┘
        9 🚧 SVG I/O ✅ · Text ✅ · Image ⬜
        10 (Layers) ── parallelizable after 6 ✅
        11 (responsive/perf) ── continuous, hardened last
```

## Immediate next steps (current sprint = Phase 9)

Phases 0–8 complete. SVG import/export and the Text tool are done. Remaining:

1. **Image** place/trace — the last Phase 9 item (place as a reference layer first;
   bitmap→vector tracing as a follow-up).
2. **Layers panel** (Phase 10) — parallelizable, good next milestone.
3. Minor follow-ups: dedicated relative-angle drawing tool; arc-length / path
   dimension editing; add/remove path anchors.

See `STATUS.md` for the full done / to-do log.
