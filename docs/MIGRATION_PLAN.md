# Geometry Graph Migration Plan (Detailed)

## Goal Description
This is the definitive, highly actionable 5-phase execution strategy for migrating the Kids Sketch Editor from a shape-centric model to a true Geometry Graph (Vertices, Edges, Constraints). It guarantees the preservation of the existing design philosophy (minimal UI, direct manipulation, no CAD jargon) while completely replacing the data model beneath it.

## 1. Phased Roadmap: Actionable Items & Validation

### Phase 1: Solver Islanding (Connected Components)
**Objective:** Prevent the dense solver from freezing the browser when entity counts increase.
*   **Actionable Items:**
    1.  **Edit:** `src/core/constraints/solver.ts`.
    2.  **Add Function:** `buildConstraintGraph(constraints)` to represent constraints as edges and shapes as nodes.
    3.  **Add Function:** `findConnectedComponents(graph)` using Breadth-First Search (BFS) to group `ShapeId`s into isolated islands.
    4.  **Modify:** `solve()` to iterate over islands, building a smaller Jacobian matrix for each, rather than one global matrix.
*   **Tests & Validation:**
    *   **Automated:** Run `npx tsx src/core/constraints/constraints.selftest.ts`. Ensure all 13 checks pass without modification.
    *   **Manual Validation:** Draw two disconnected rectangles. Add a horizontal constraint inside Rectangle A. Drag Rectangle A. Place a `console.log` in the solver to verify the matrix size is strictly limited to the variables of Rectangle A.

### Phase 2: Native Intersection Engine (The Math Foundation)
**Objective:** Replace Paper.js booleans with native TypeScript intersection math, required for Trim and Offset.
*   **Actionable Items:**
    1.  **Create File:** `src/core/geometry/intersections.ts`.
    2.  **Add Function:** `intersectLineLine(a, b): Pt[]`.
    3.  **Add Function:** `intersectLineArc(line, arc): Pt[]`.
    4.  **Add Function:** `intersectArcArc(arc1, arc2): Pt[]`.
    5.  **Create File:** `src/core/geometry/intersections.selftest.ts`.
*   **Tests & Validation:**
    *   **Automated:** Write 10+ unit tests in `intersections.selftest.ts` testing parallel lines, orthogonal intersections, overlapping arcs, and tangent lines. Run via `npx tsx`.
    *   **Manual Validation:** Hook the new intersection engine into the Smart Guides system (`src/core/geometry/align.ts`) to visually verify that snapping highlights correct intersections during a drag.

### Phase 3: The Data Model Switch (The Big Bang)
**Objective:** Rip out `Rectangle`, `Circle`, and `Path` primitives. Transition entirely to `Vertex` and `Edge`.
*   **Actionable Items:**
    1.  **Edit:** `src/core/geometry/shapes.ts`. Define new interfaces: `TopologyVertex`, `TopologyEdge`.
    2.  **Edit:** `src/store/documentStore.ts`. Replace `shapes: Shape[]` with `vertices: TopologyVertex[]` and `edges: TopologyEdge[]`.
    3.  **Rewrite Tools:** Edit `src/editor/tools/RectangleTool.ts`. Instead of calling `addShape({type: 'rectangle'})`, macro-generate 4 `TopologyVertex` objects, 4 `TopologyEdge` (line) objects, and inject 4 Coincident + 4 Perpendicular constraints into the store.
    4.  **Update Renderer:** Modify the Paper.js reconciler (`src/editor/canvas/Reconciler.tsx` or equivalent) to iterate over `edges` and draw lines/arcs, completely ignorant of higher-level shapes.
    5.  **Update Dimensions:** Modify `src/core/geometry/dimensions.ts`. Instead of calculating chips from a `Rectangle.width`, calculate chips dynamically by scanning for parallel connected line edges and measuring distance.
*   **Tests & Validation:**
    *   **Manual Validation:** The app must compile. The user must be able to select the Rectangle tool, draw a box, and see dimensions appear exactly as they did before, but the Zustand devtools should show 4 edges instead of 1 shape.

### Phase 4: Point Editing & Corner Radius (Fillet)
**Objective:** Expose the new graph to the user via native point editing and the first topological tool.
*   **Actionable Items:**
    1.  **Update Selection Tool:** Modify `src/editor/tools/SelectTool.ts`. When hovering, highlight `TopologyVertex` nodes (Blue, 12px visual / 24px hit target). Allow dragging individual vertices.
    2.  **Create Fillet Tool:** Create `src/editor/tools/FilletTool.ts`.
    3.  **Fillet Logic:** When a vertex is clicked, delete the `TopologyVertex`, shorten the two connected `TopologyEdge`s, generate a new `TopologyEdge` (type: 'arc') with the user-defined radius, insert two new vertices, and attach 2 Coincident + 2 Tangent constraints.
*   **Tests & Validation:**
    *   **Manual Validation:** Draw a rectangle. Select the Fillet tool. Click a corner. The corner becomes rounded, but the rest of the rectangle remains constrained and behaves properly when dragged.

### Phase 5: Destructive Operations (Trim & Offset)
**Objective:** Utilize the Intersection Engine and the Graph model to execute CAD cuts.
*   **Actionable Items:**
    1.  **Create Trim Tool:** Create `src/editor/tools/TrimTool.ts`. 
    2.  **Trim Logic:** On hover, use `intersections.ts` to find the bounds of the hovered segment. On click, delete the original `TopologyEdge`, generate two new `TopologyEdge`s up to the intersection points, and insert a new `TopologyVertex` at the intersection.
    3.  **Create Offset Tool:** Create `src/editor/tools/OffsetTool.ts`. Traverse connected edges, apply perpendicular math to generate displaced edges, and use the intersection engine to trim overlapping inner corners.
*   **Tests & Validation:**
    *   **Manual Validation:** Draw a line intersecting a rectangle. Use Trim to cut the line segment inside the rectangle. The rectangle remains intact and fully constrained.

---

## 2. Maintaining UI Coherence & Design Philosophy

The highest risk in a CAD migration is accidentally building a CAD UI. We must strictly adhere to the project's philosophy outlined in the README.

**Rule 1: The Canvas is the Product.**
*   *Implementation:* No side panels or "Property Inspectors" will be added for Edge data. Dimensions and constraints remain floating, transient chips near the geometry. If a user fillets a corner, they do not type the radius into a dialog box; a transient dimension chip appears on the arc for them to type into.

**Rule 2: Direct Manipulation Over Forms.**
*   *Implementation:* Point Editing (Phase 4) will not use a separate "Node Tool". The standard Selection Tool will intelligently allow clicking an edge to move the line, or clicking a vertex to stretch the corner. 

**Rule 3: No CAD Vocabulary.**
*   *Implementation:* The new graph model is strictly internal. The user never sees the words "Vertex", "Topology", or "Coincident". When Fillet is implemented, it is labeled "Corner Radius" in the UI.

**Rule 4: Design Language Consistency.**
*   *Implementation:* Ensure all new interactive points (Vertices) adhere to the existing chrome: White fill + Blue stroke (`#3B82F6`), 150ms Framer Motion transitions, and 44px touch targets. System-generated helper lines during Trim operations must use the Magenta (`#FF4DA6`) color to denote "system helping you".

---

## 3. Optimizing AI Token Consumption

During a large refactor, AI agents will consume massive amounts of context window (tokens) if not managed properly. 

1.  **Work in "Silos":** When building Phase 2 (Intersection Engine), do *not* have `App.tsx` or `documentStore.ts` open in your context. Only provide the mathematical files. 
2.  **Use Interface Stubs:** If the AI needs to know how the store works, provide an interface definition (`export interface DocumentStore { ... }`) rather than the entire implementation file.
3.  **Single-Responsibility Prompts:** Do not say "Migrate the Rectangle tool and fix the renderer." Say: "Step 3.1: Update `shapes.ts` with the new interfaces." Then, "Step 3.2: Update the renderer."

---

## 4. Logging & Documentation Strategy

**Where:** All documentation belongs in the `/docs` directory.

**What to maintain:**
*   `docs/MIGRATION_PLAN.md`: The canonical source of truth for this roadmap.
*   `docs/STATUS.md`: The current "Done / To-Do" log.

**When to update logs:**
1.  **At the start of a session:** Read `STATUS.md` to establish context.
2.  **At the completion of a Phase Step (e.g., Step 1.2):** Mark it complete in `MIGRATION_PLAN.md` and `STATUS.md`.
3.  **On Architectural Decisions:** If a mathematical approach changes (e.g., switching from Newton-Raphson to Gradient Descent), log the *Why* in a `docs/DECISIONS.md` file.
