# Kids Sketch Editor — Educational Vector Drawing Tool

A browser-based vector sketch editor designed for young creators (ages 10–18). Think Figma meets a sketchpad — precise enough to teach real geometric thinking, friendly enough that a 10-year-old never sees the word "constraint."

## Scope

A fully interactive, client-side SVG editor that runs in the browser. No backend, no accounts, no install. Open → draw → export.

**In scope:**
- Precise 2D vector drawing (lines, arcs, circles, rectangles, pen/bezier, text)
- Editable dimensions that *drive* geometry (type 120mm, shape updates)
- Auto-constraints (horizontal, vertical, parallel, tangent, etc.) — applied silently, shown as friendly tags
- Smart guides, snapping, alignment, distribution
- Boolean operations (union, subtract, intersect)
- Path/point editing with bezier handles
- SVG import/export
- Object library (star, heart, arrow, house, etc.)
- Layers, groups, undo/redo
- Responsive (desktop, tablet, phone)

**Out of scope (by design):**
- 3D, animation, raster editing, collaboration/multiplayer
- Fabrication/CNC hand-off (export is the only output action)
- User accounts, cloud storage, backend services

## Intention

Make geometric drawing accessible to kids learning design, engineering, or just having fun. The tool should feel immediate and rewarding — not like homework. Every feature should pass the test: *"Would a 10-year-old understand this without reading a manual?"*

## Vision

A single-page app that loads instantly and lets you sketch precise vector shapes with real dimensions. The gap this fills: kid-friendly drawing tools (Canva, etc.) have no precision; precision tools (AutoCAD, FreeCAD) are hostile to beginners. This sits in the middle — real constraints, real dimensions, zero jargon.

Long-term, this becomes the kind of tool a kid uses to design a laser-cut box, a 3D-printed bracket, or a poster — and actually learns geometry along the way.

## Philosophy

1. **The canvas is the product.** UI is minimal, floating, contextual. No modal dialogs, no settings panels, no toolbar soup. ≥85% of the screen is always canvas.
2. **Direct manipulation over forms.** You don't fill in a property panel — you click a dimension on the shape and type a number. Geometry updates live.
3. **Smart defaults, zero config.** Constraints auto-apply. Snapping just works. The grid is there. You don't configure the tool, you use it.
4. **No CAD vocabulary.** A "coincident constraint" is shown as a magenta dot and a friendly tag. Over/under-constrained feedback uses plain language, not DOF counts.
5. **Progressive disclosure.** A beginner draws rectangles and sees dimensions. An advanced user discovers constraints, booleans, and path editing naturally.
6. **Transient heuristics first, persistent constraints later.** Snapping and smart guides are cheap and forgiving; the constraint solver is powerful but comes after the UX is proven.

## Design Language

- **Background:** warm off-white `#FAFAF8` with dot grid
- **Origin:** faint magenta axis cross at (0, 0)
- **Blue (`#3B82F6`)** = you / your selection (handles, active tool, highlights)
- **Magenta (`#FF4DA6`)** = the system helping you (guides, auto-constraints, snap indicators)
- **Light-purple pills** = constraint tags attached to geometry
- **Chrome:** floating, translucent-feeling, contextual toolbars — nothing docked or heavy
- **Typography:** system font stack, dimensions in monospace
- **Transitions:** 150ms (Framer Motion, opacity + slide)
- **Handles:** 12px visual / 24px hit target, white fill + blue stroke
- **Touch:** 44px minimum targets on tablet/phone

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Paper.js** — geometry engine and canvas renderer
- **Zustand** + **zundo** — state management with undo/redo history
- **Framer Motion** — UI transitions
- No backend. Pure client-side.

## Architecture

```
Document Model (Zustand store, Shape[])
    ↓ reconcile
Paper.js Canvas (geometry rendering)
    ↓ overlay
Handles / Guides / Labels (selection UI, smart guides, dimensions)
    ↓ (Phase 8)
Constraint Graph (persistent geometric relationships, solver)
```

The document model is the single source of truth. Paper.js is a renderer that reconciles from the model. Inference (snapping, guides) and constraints (solver) are separate systems built on top.

## Project Phases

| Phase | Name | Status |
|-------|------|--------|
| 0–2 | Foundation, model, drawing | Done |
| 3a | Selection & editing core | Done |
| 3b | Drawing precision & smart guides | Done |
| 4 | Multi-select & navigation polish | Done |
| 5 | Editable dimensions | Done |
| 6 | Geometry operations & context toolbar | Done |
| 7 | Path & point editing | Done |
| 8 | Geometric constraint solver | Done |
| 9 | Import / export & content tools | Done |
| **10** | **Layers** | **Next** |
| 11 | Responsive, a11y, performance | Planned |

See [docs/ROADMAP.md](docs/ROADMAP.md) for detailed phase breakdowns, [docs/STATUS.md](docs/STATUS.md) for the current "done / to-do" log, and [docs/UI_UX_SPEC.md](docs/UI_UX_SPEC.md) for the full interaction specification.

## Getting Started

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173` (Vite default).

## Tests

Pure-logic self-tests run under `tsx` (no browser needed):

```bash
npx tsx src/core/constraints/constraints.selftest.ts   # 13 checks: detection + solver
npx tsx src/core/io/io.selftest.ts                      # 13 checks: SVG export
npx tsc --noEmit                                         # full type-check
```

Import + round-trip (needs `DOMParser`) is verified in the browser. Module-level
notes live in [src/core/constraints/README.md](src/core/constraints/README.md) and
[src/core/io/README.md](src/core/io/README.md).

> **Dev aid:** in dev builds (`import.meta.env.DEV`) the Zustand stores are exposed
> on `window` (`docStore`, `conStore`, `selStore`, `fbStore`, `toolStore`) for
> console debugging. They are never bundled into production. See [src/main.tsx](src/main.tsx).
