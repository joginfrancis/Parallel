# Constraint Engine (Phase 8)

## What this does

A geometric constraint system that detects and enforces relationships between shapes — coincident points, horizontal/vertical lines, parallel lines, perpendicular angles, equal lengths, and more. Constraints auto-apply as you draw and are maintained by a numerical solver on every edit.

## Architecture

```
detect.ts          →  Detects geometric relationships after shape placement
model.ts           →  Constraint types, PointRef interface, shape-point accessors
residuals.ts       →  Per-constraint residual + Jacobian functions
solver.ts          →  Gauss-Newton least-squares solver (iterative)
solveAndApply.ts   →  Bridge: runs solver and applies results to shapes
```

### Data flow

```
User draws/edits shape
  → toolController calls autoDetect() after commit
  → detect.ts returns candidate constraints (confidence-ranked)
  → High-confidence constraints auto-apply to constraintStore

User drags a constrained point
  → toolController calls runSolver() after mutation
  → solver.ts collects free variables, builds Jacobian
  → Gauss-Newton iterates until residuals < epsilon
  → Updated positions written back to shapes
```

### Constraint store

Separate Zustand store (`constraintStore.ts`) — not inside documentStore's temporal history. Constraints are cleaned up automatically when shapes are deleted.

### Solver

Custom Gauss-Newton least-squares minimizer. No WASM dependencies.

- Collects all free variables (x, y of each unconstrained point)
- Builds residual vector from each constraint
- Builds Jacobian matrix (analytical for most, numerical for angle)
- Solves normal equations `J^T J dx = -J^T r` with LM damping
- Iterates until convergence (max 25 iterations, epsilon 1e-6)
- Performance target: <5ms for 100 constraints

### Constraint types

| Type | Residual | Variables |
|------|----------|-----------|
| Coincident | `[ax-bx, ay-by]` | 2 points |
| Horizontal | `[y2-y1]` | line endpoints |
| Vertical | `[x2-x1]` | line endpoints |
| Parallel | `cross(dA, dB)` | 2 lines (4 points) |
| Perpendicular | `dot(dA, dB)` | 2 lines (4 points) |
| Equal | `lenA² - lenB²` | 2 lines (4 points) |
| Midpoint | `[px-mx, py-my]` | point + line |
| Concentric | `[cxA-cxB, cyA-cyB]` | 2 circle centers |
| Tangent | `dist(center,line) - r` (numerical J) | line + circle |
| Collinear | endpoints of B on A's line (numerical J) | 2 lines |
| Distance | `dist² - value²` | 2 points |
| Angle | numerical Jacobian | 2 lines |
| Fixed | pinned to stored pos, removed from vars | 1 point |

Constraints with awkward analytical derivatives (tangent, collinear, angle) use a
finite-difference Jacobian via the `numericResult` helper in `residuals.ts`.

### Live hints (during a gesture)

Constraints are previewed **live** while drawing, moving, or transforming —
before the gesture commits (UI_UX_SPEC §6.3). `toolController.liveHints()` runs
detection against the in-progress geometry each frame and `drawConstraintHints()`
renders transient magenta glyphs on a dedicated `hintLayer`. On release, the
relevant constraints auto-apply (`autoDetect`).

- **Draw:** the rubber-band segment is detected as a provisional line (temp id
  `preview`) → "Horizontal" / "Vertical" / "Parallel" etc. show as you draw.
- **Move / resize / point-edit:** the moved shape is re-detected against the
  document each frame → relationships (parallel, coincident, tangent…) preview live.

A **single straight segment** drawn with the Line tool commits as a `line` (not a
2-node path), so it gets full constraint + dimension support. Multi-segment or
curved polylines stay paths.

### Visualization

`constraintOverlay.ts` renders magenta glyphs on the Paper.js overlay layer:
- Coincident: filled magenta dot
- Horizontal/Vertical: dash/bar + purple tag
- Parallel: `//` marks on both lines
- Perpendicular: right-angle square
- Equal: `=` tick marks
- Fixed: lock icon

Tags are hit-testable — clicking removes the constraint.

### UI

`ConstraintChips.tsx` in the context toolbar shows:
- Applied constraint tags (click × to remove)
- Lock/unlock button for the selected shape

`ConstraintFeedback.tsx` shows a friendly amber banner when the solver can't
satisfy every constraint (over-constrained) — plain language, no DOF jargon.
Driven by `feedbackStore.ts`.

### Tests

`constraints.selftest.ts` — 13 pure-function checks covering detection and
solving for every constraint type, connectivity, locking, and over-constrained
reporting. Run with:

```bash
npx tsx src/core/constraints/constraints.selftest.ts
```

### Lock semantics

A `fixed` constraint stores the locked position (`pos`). The solver folds locks
into its pin map and re-asserts them every iteration — so a fully-locked shape
snaps back if dragged, even when it has no free variables.
