# Project Status — Done / To-Do Log

A running log of what's built and what's left. Companion to `ROADMAP.md` (the
ordered plan) — this is the "current truth" snapshot. Last updated for the
**Phase 8 (constraints)** and **Phase 9 (import/export + text)** work.

---

## ✅ Done

### Phases 0–7 (foundation → point editing)
Drawing tools, selection/transform, smart guides & snapping, multi-select,
editable dimensions, geometry ops (align/distribute/group/boolean/break),
object library, and path/point editing. See `ROADMAP.md` for the per-phase detail.

### Phase 8 — Geometric constraint & solving engine
- **Constraint model** (`src/core/constraints/model.ts`): coincident, horizontal,
  vertical, parallel, perpendicular, equal, midpoint, concentric, **tangent**,
  **collinear**, distance, angle, and **fixed** (lock).
- **Solver** (`solver.ts`): Gauss-Newton / least-squares, runs on every edit.
  Pins the dragged point so neighbours move (connectivity). Fixed constraints
  store their locked position and are re-asserted every iteration, so a fully
  locked shape snaps back when dragged.
- **Detection** (`detect.ts`): auto-detects relationships within tolerance.
  Strong relations (coincident/horizontal/vertical/concentric) auto-apply; the
  noisier pairwise ones need firmer confidence. Includes tangent (line↔circle),
  collinear (line↔line, preferred over parallel when aligned), and **relative
  angle** snapping to 30/45/60/120/135/150°.
- **Live hints** (`constraintOverlay.drawConstraintHints` + tool wiring): candidate
  constraints preview as transient magenta glyphs **while** drawing/moving/
  transforming, before commit; auto-apply on release.
- **Single straight segments commit as `line`** (not a 2-node path) so they get
  full constraint + dimension support.
- **UI**: removable constraint chips + lock button (`ConstraintChips.tsx`);
  over/under-constrained **feedback banner** in plain language
  (`ConstraintFeedback.tsx` + `feedbackStore.ts`).
- **Tests**: `constraints.selftest.ts` — 13 checks (detection, solving,
  connectivity, lock snap-back, over-constrained reporting).

### Phase 9 — Import / export + Text + Image (done)
- **SVG export** (`src/core/io/svgExport.ts`): pure `shapesToSvg()` →
  standalone SVG. rect (+rx/rotation), circle, line, arc (circumcircle → `A`,
  spec-correct flags), path (with bezier handles → `C`), text. mm units,
  true-size viewBox. `downloadSvg()` helper.
- **SVG import** (`src/core/io/svgImport.ts`): `svgToShapes()` parses rect,
  circle, ellipse(→circle), line, polyline, polygon, path (M/L/H/V/C/S/Q/T/A/Z,
  abs+rel), and text (presentation attrs or `style=`). A lone `M…A` round-trips
  to an ArcShape.
- **UI**: hamburger menu → **Import SVG…** (file picker) / **Export SVG…**;
  Export panel with Download + Copy (`ExportPanel.tsx`). Import adds shapes in
  one undo step, selects them, friendly toast (`importToDocument.ts`).
- **Text tool**: click to place → inline true-size textarea editor
  (`TextEditor.tsx` + `textEditStore.ts`); double-click to re-edit; context
  toolbar with font size / bold / align / color; text is
  selectable/movable/rotatable, corner-drag scales font; participates in
  constraints via its anchor point; in SVG import + export.
- **Image tool**: click → file picker → places a raster (data URL) scaled to fit
  (~120mm); selectable/movable/resizable/rotatable; **opacity "Fade" slider** for
  tracing over; in SVG import (incl. `xlink:href`) + export. `ImageShape`,
  `renderImage` (Paper `Raster`), `placeImage.ts`. Rectangle + image now share box
  transform helpers in `transform.ts`.
- **Tests**: `io.selftest.ts` — 15 export checks (incl. text + image); import +
  round-trip verified in-browser (all geometry types + text + image; foreign
  hand-written SVG with `style=` / presentation attrs / `xlink:href`).

---

## ⬜ To-Do

### Phase 9 — content-tool follow-ups (optional)
- **Image trace** — bitmap→vector auto-trace of a placed image (sizable algorithm;
  deferred. Placing/fading a reference image is done).
- **Dedicated relative-angle drawing tool** ◑ — interactive angle entry while
  drawing. The angle *constraint* and auto-detection already exist; only the
  bespoke entry UX is pending.

### Phase 10 — Layers ◑
- Layer panel (z-order, visibility, lock, color); assign shapes/groups.
- Sketch-features menu (snap/grid/constraint-visibility toggles).

### Phase 11 — Responsive, a11y, performance ●
- Tablet (left rail) / phone (right rail + layers button) layouts.
- Keyboard shortcuts, screen-reader labels, high-contrast, touch/stylus.
- Perf: 60fps @ 10k segments — reconciler diffing, dirty-rect overlay,
  throttled snap/solver.

### Known limitations / smaller follow-ups
- **Arc-length** numeric editing + path/polyline dimension editing (Phase 5 tail).
- **Add/remove anchors** in point-edit mode; triple-click to select connected
  geometry (needs the constraint connectivity graph, now available).
- **SVG import** ignores element transforms other than rect `rotate(...)`; styling
  is dropped (geometry only).
- **Text bounds** use an estimate (char-width heuristic), not true font metrics —
  fine for selection, may differ slightly from rendered glyph extents.
- **Reconciler** rebuilds all Paper items on each change; diff-by-id incremental
  update is a future perf optimization.

---

## Test & debug quick reference

```bash
npx tsc --noEmit                                      # type-check
npx tsx src/core/constraints/constraints.selftest.ts # constraint engine (13)
npx tsx src/core/io/io.selftest.ts                   # SVG export (13)
```

Dev-only `window` store hooks (`docStore`, `conStore`, `selStore`, `fbStore`,
`toolStore`) are available in dev builds for console inspection — see
`src/main.tsx` (gated behind `import.meta.env.DEV`, never shipped).
