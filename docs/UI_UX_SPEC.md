# UI/UX Specification — Educational Vector Sketch Editor

> Derived from the written brief **and** the 5 reference mockup sheets.
> This document is the source of truth for layout, components, and interaction
> behavior. Where the mockups refine or contradict the brief, the mockups win
> and the difference is flagged with **⚠︎ DELTA**.

---

## 0. Design DNA (one paragraph)

The canvas is the product. A near-frameless workspace on a warm off-white (`#FAFAF8`)
dot grid, with a faint magenta axis cross at the origin. All chrome is floating,
translucent-feeling, and contextual. Blue (`#3B82F6`) means *you/selection*; magenta
(`#FF4DA6`) means *the system is helping you* (guides + auto-constraints). Nothing is
modal except the three deliberate panels (Shape Library, Import, Export). A 10-year-old
never sees the word "constraint" as a setting — it just happens and gets a friendly tag.

---

## 1. Screen Regions (Desktop)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TOP BAR                                                                    │
│ [☰] [Untitled ▾]   [↶] [↷] [🗑]      ( Sketch features ▾ )   [⬆Export] [Finish sketch] │
├──┬───────────────────────────────────────────────────────────────────────┤
│TL│                                                                        │
│OO│                                                                        │
│OL│                          CANVAS (≥85% area)                            │
│  │                       dot grid + magenta axes                          │
│RA│                                                                        │
│II│                                                                        │
│ L│                                                                        │
│  │  [− 100% + ⤢]        ( contextual bottom-center toolbar )   [Snap Grid 1.0mm ▾] │
└──┴───────────────────────────────────────────────────────────────────────┘
```

### 1.1 Top bar (left → right)
| Element | Behavior |
|---|---|
| `☰` Hamburger | App/project menu (New, Open, Save, Settings, Help) |
| `Untitled ▾` | Document name; click to rename inline, ▾ for doc actions |
| `↶ ↷` Undo / Redo | zundo-backed history; disabled state when empty |
| `🗑` Delete | Deletes current selection; disabled when nothing selected |
| **`Sketch features ▾`** (green pill, centered) | Primary mode/feature menu — drawing aids, constraint visibility toggle, layers. The single accent CTA in the center. |
| `⬆ Export` (blue pill) | Opens Export panel (§7.3) — primary right-side CTA |

> ~~`Finish sketch`~~ — **REMOVED.** Appeared in mockups by accident; no fabrication
> hand-off. Export is the only commit/output action.

### 1.2 Left tool rail (vertical, 8 tools)
Decision: keep the brief's dedicated **Arc** tool (8 total), inserted after Line.

1. **Select** (arrow) — default
2. **Line** (`╱`)
3. **Arc** (`⌒`)
4. **Circle** (`○`)
5. **Rectangle** (`▢`)
6. **Pen** (`✎` bezier)
7. **Text** (`T`)
8. **Image / Import** (picture icon)

- Active tool = blue-tinted rounded square highlight (see Select in every frame).
- 12px icon / 24px hit target minimum (touch rule applies to rail too).
- **No standalone Arc tool in the rail.** Arc is produced via Pen or appears as a
  dimensionable entity; arc dimensions (radius/length/angle) still exist (§5).

### 1.3 Bottom-left cluster
`[ − ]  100%  [ + ]  [ ⤢ fit ]` — zoom out, zoom %, zoom in, zoom-to-fit.

### 1.4 Bottom-center contextual toolbar
The dynamic heart of the app. Empty by default (or shows draw aids). Its contents are
entirely selection-/tool-driven — see §4 for the full state table.

### 1.5 Bottom-right
`Snap Grid  1.0 mm ▾` — grid snap increment selector (e.g. 0.5 / 1.0 / 5.0 mm, Off).

---

## 2. Responsive Behavior

| Region | Desktop | Tablet | Phone |
|---|---|---|---|
| Top bar | Full | Full, slightly condensed | Reduced: `☰  Untitled ▾   ↶ ↷   ⚙` (Export moves into ☰/⚙) |
| Tool rail | **Left** | **Left** | **Right edge** — ⚠︎ DELTA (flips side for thumb reach) |
| Zoom cluster | Bottom-left | Bottom-left | Bottom-left, compact |
| Contextual toolbar | Bottom-center | Bottom-center | Bottom-center (always visible — primary contextual surface) |
| Snap Grid | Bottom-right | Bottom-right | Folded into ⚙ / hidden |
| Layers | In `Sketch features` | same | dedicated **bottom-right layers icon** (⚠︎ DELTA — visible on phone) |

Canvas remains ≥85% on all three. Touch targets grow to 44px on phone/tablet.
Stylus = same as mouse-precise pointer; finger = larger hit slop.

---

## 3. Core Interaction Model

### 3.1 Selection semantics
| Gesture | Result |
|---|---|
| Single click | Select object → context toolbar appears |
| Double click | Enter **point-edit** mode (segments + bezier handles shown) |
| Triple click | Select connected geometry (whole chain) |
| Click empty | Deselect |
| Drag empty | Marquee select |
| Shift+click | Add/remove from selection |

### 3.2 Handles (selected, not editing points)
- 8 transform handles (corners + edge midpoints) + rotate affordance.
- Visual 12px, hit area 24px. Color: selection blue, white fill, blue stroke.
- Rotate: handle offset above top-edge midpoint (image 1 shows the detached square handle with a tether line). Shows live `°` label while rotating (image: "30°").

### 3.3 Point-edit mode (double-click)
- Anchor points = blue dots; active anchor = filled solid blue.
- Bezier control handles = thin line + small square terminus (image 1 & scenario 2).
- Drag anchors/handles to reshape; auto-constraints may fire (§6).

---

## 4. Dynamic Context Toolbar — State Table

> The single most important feature. Bottom-center toolbar morphs by selection.
> Transitions: 150ms (Framer Motion, opacity+slide). Plus an **inline floating
> mini-bar directly under the shape** for the most-used actions (⚠︎ DELTA, scenario 3).

| Selection | Bottom-center toolbar | Inline under-shape mini-bar |
|---|---|---|
| **Nothing** | Draw aids / empty | — |
| **Rectangle** | Width · Height · Corner Radius · Align · Duplicate | `W 120.0 mm  H 80.0 mm  [align] [⧉ dup] [🗑] [⋯]` |
| **Circle** | Radius · Diameter · Align | `Ø / R value [align] [dup] [del]` |
| **Line** | Length · Angle | `Length · Angle` |
| **Arc** | Radius · Arc Length · Angle | same |
| **Text** | Font ▾ · Size ▾ · **B** · align L/C/R · color swatch (scenario 8) | floats above text |
| **Multiple** | Align · Distribute · Group · Boolean ops | `[⊞ Group ⌘G] [Ungroup]` |
| **Group selected** | Ungroup · Align · Boolean | `[Ungroup ⌘⇧G]` |

**Break / Explode** appears on single compound shapes (rect, circle, polygon, library
shapes) and works like Ungroup but one level deeper — it decomposes geometry into its
primitive segments. See §13.3.

### 4.1 Inline value editing (no panels, no modals)
- Click a value (e.g. `120.0 mm`) → it becomes a text field with **✓ / ✕** buttons
  (scenarios 6, 10, 12).
- Type → Enter / ✓ commits; geometry updates instantly. Esc / ✕ cancels.
- Units shown inline (`mm`, `°`, `Ø`, `R`).

### 4.2 Alignment toolbar (multi-select, scenario 17)
Icons in order: align-left, align-h-center, align-right, align-top, align-v-center,
align-bottom, distribute-horizontal, distribute-vertical.

### 4.3 Boolean toolbar (overlapping multi-select, scenario 18)
**Union · Subtract · Intersect · Exclude · Divide** (Clipper2-backed). Active op
highlighted blue. Live preview on hover.

### 4.4 Duplicate / Group menus
Small popover with shortcut hints: `Duplicate ⌘D`, `Group ⌘G`, `Ungroup`.

---

## 5. Dimensions (editable objects)

Dimensions are first-class, selectable, editable entities — never a property panel.

| Type | Display | Edit |
|---|---|---|
| Linear (scenario 10) | extension + dimension lines, arrowheads, `120.0 mm` label | inline ✓/✕ |
| Vertical & Horizontal (11) | multiple stacked dims on an L-shape (60/40/80/100 mm) | each independent |
| Angle (12) | arc between two lines, `45.0°` | inline ✓/✕ |
| Radius (13) | leader from center, `R 25.0 mm` | inline |
| Diameter (14) | through-center leader, `Ø 50.0 mm` | inline |
| Arc Length (15) | curved dim over arc, `120.0 mm` | inline |

Behavior: select geometry → relevant dimension(s) auto-appear. The dimension-type
toolbar (bottom-center) lets the user add/toggle specific dimension styles (the icon
sets visible in scenarios 10–15). Editing a dimension **drives** the geometry.

---

## 6. Auto-Constraint System

> Header from mockups: **"Constraints are applied automatically as you draw."**
> ⚠︎ DELTA — stronger than brief's "suggested." Model = auto-apply with visible,
> friendly feedback and the ability to choose when ambiguous.

### 6.1 Visual language
- **Blue dot** = a point / endpoint.
- **Magenta** = an auto-constraint (the system helping).
- **Light-purple pill** = a constraint indicator/tag attached to geometry.

### 6.2 The 8–10 constraints (icon + trigger + glyph)
| Constraint | Trigger | On-canvas magenta glyph | Tag |
|---|---|---|---|
| **Coincident** | endpoint dragged onto endpoint/point | filled magenta dot at junction | "Coincident" |
| **Horizontal** | line within tol. of 0° | magenta horizontal dash mid-line | "Horizontal" |
| **Vertical** | line within tol. of 90° | magenta vertical bar mid-line | "Vertical" |
| **Parallel** | line near-parallel to another | magenta `//` marks on both | "Parallel" |
| **Perpendicular** | two lines near 90° | magenta right-angle square at corner | "Perpendicular" |
| **Tangent** | line/arc touches circle at 1 pt | magenta dot at tangency | "Tangent" |
| **Collinear** | points/lines on same infinite line | dashed magenta line | "Collinear" |
| **Equal** | two lines/arcs same length/radius | magenta `=` tick marks on each | "Equal" |
| **Midpoint** | point at segment center | magenta centered point | "Midpoint" |
| **Concentric** | shared circle center | shared-center magenta marks | "Concentric" |

### 6.3 Detection → application UX (scenarios 7–9)
1. **Detected** (7): as geometry approaches a relationship, a row of candidate
   constraint **chips** appears in the bottom-center toolbar
   (e.g. `Tangent · Coincident · Midpoint · Parallel · Perpendicular`), each a small
   icon + label.
2. **Multiple options** (8): ambiguous case shows a short horizontal list; the most
   likely is pre-highlighted (pink-filled chip).
3. **Applied** (9): user clicks the chip (or it auto-applies if unambiguous) →
   120ms apply animation → a light-purple/magenta tag (e.g. `Tangent`) pins beside
   the geometry. No dialog, ever.

### 6.4 Architecture note
Constraint *detection* and *tagging* ship now (geometric predicates + tags). A real
solver (slvs/jsketcher) integrates later behind the same `Constraint` interface; the
UI never changes. Constraints stored on the document model, not in Paper.

---

## 7. Modal Surfaces (the only 3)

### 7.1 Shape Library (scenario 11)
- Panel titled **Shapes**, search box, category tabs (Basic, …).
- Grid of editable prebuilt shapes: Star, Heart, Arrow, Cloud, Speech Bubble, Gear,
  Robot, Tree, House (+ basics).
- **Drag-and-drop** onto canvas; dropped shape is fully editable geometry.

### 7.2 Import SVG (scenario 14)
- Panel titled **Import**, `⬆ Upload SVG` button, list of imported objects
  (e.g. `robot.svg`).
- Imported SVG becomes selectable/editable geometry (image shows robot with selection
  handles). Target: <1s import.

### 7.3 Export (scenario 15)
- Panel titled **Export**, **Format ▾** (SVG default, + more), `⬇ Download`,
  "More options" link.

---

## 8. Smart Guides (during move) — scenarios 3 & 16

- On drag, magenta alignment lines appear when edges/centers align to other objects.
- Labeled pills on the guide: **Center**, equal-spacing ticks, same-width/height hints.
- Red/magenta dashed line spans the aligned axis (image: rect↔circle center alignment).
- Guides are **transient** — appear during drag, vanish on drop. Snap budget <5ms.
- Snap types: center, edge, midpoint, endpoint, tangent (+ grid snap from §1.5).

---

## 9. Visual Style Tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FAFAF8` | canvas / app background |
| `--grid` | `#EAEAEA` | dot grid |
| `--axis` | `#FF4DA6` @ low opacity | origin cross |
| `--selection` | `#3B82F6` | selection, handles, anchors |
| `--guide` | `#FF4DA6` | smart guides + auto-constraints |
| `--text` | `#1F2937` | labels |
| `--success` | `#22C55E` | Sketch-features pill, confirms |
| `--warning` | `#F59E0B` | warnings |
| `--error` | `#EF4444` | errors |
| `--cta` | `#3B82F6` | Finish sketch button |
| selected-fill | selection @ ~8–10% alpha | shape interior when selected |

Typography: clean sans (Inter). Generous radii on pills/panels. Soft shadows on
floating chrome only.

### Animation timings
Selection 100ms · Snap 80ms · Toolbar transition 150ms · Constraint apply 120ms.
Framer Motion for DOM/overlay only — **never** inside the Paper render loop.

---

## 10. Component Inventory (maps to build)

```
TopBar
  ├─ MenuButton, DocTitle, UndoRedo, DeleteButton
  ├─ SketchFeaturesMenu (green pill)
  └─ ExportButton, FinishButton
ToolRail (7 ToolButton)               ← side flips on phone
CanvasStage (Paper.js)
  ├─ GridLayer, AxisLayer
  ├─ ShapeRenderer (reconciler)
  └─ OverlayLayer (handles, guides, dim labels, constraint glyphs)
BottomLeftZoom
BottomRightSnapGrid (+ LayersButton on phone)
ContextToolbar (state-driven)         ← §4 table
  ├─ ShapeControls (W/H/R/Ø/Length/Angle inline editors)
  ├─ AlignTools, DistributeTools
  ├─ BooleanTools
  ├─ DimensionTypeTools
  ├─ ConstraintChips
  └─ TextTools
InlineValueEditor (✓/✕)
InlineShapeMiniBar (under-shape actions)
ConstraintTag (magenta/purple pill)
  ├─ GroupTools (Group / Ungroup / Break-Explode)
  └─ LayerAssign (Move to layer ▸)
Panels: ShapeLibraryPanel, ImportPanel, ExportPanel, LayersPanel, SketchFeaturesMenu
```

Core ops: `ungroup()`, `breakShape()` (§13.3 decomposition table),
`layers[]` + `layerId` on document model.

---

## 11. Resolved Decisions & Remaining Questions

**Resolved (2026-06-13):**
- ✅ **Arc tool**: dedicated 8th rail tool (kept from brief).
- ✅ **Finish sketch**: removed — accidental in mockups. Export is the only output.
- ✅ **Units**: mm-only, with Snap Grid increments. No unit switcher.
- ✅ **`Sketch features` menu**: Layers · Snap toggles · Constraint-visibility toggle ·
  Grid settings · Construction-geometry toggle. (See §13.1.)
- ✅ **Layers**: light layer system — assign shapes/groups to layers (§13.2).
- ✅ **Break/Explode**: decompose shape → primitives, sibling to Ungroup (§13.3).

All planning questions resolved. Ready to build.

---

## 13. Sketch Features Menu, Layers & Decomposition

### 13.1 `Sketch features ▾` menu (green pill, top-center)
Dropdown contents:
- **Layers** — opens the Layers panel (§13.2)
- **Snap** — toggle Grid snap, Object snap (center/edge/midpoint/endpoint/tangent)
- **Constraints** — show/hide auto-constraint glyphs + tags
- **Grid** — grid style (dots/lines), spacing, show/hide
- **Construction geometry** — toggle reference-only geometry on/off

### 13.2 Layers
A light z-order layer system (not Photoshop-grade).

- **Layers panel**: ordered list, top = front. Each row: name, visibility 👁,
  lock 🔒, color chip. Reorder by drag.
- **Assign to layer**: select shape(s)/group(s) → "Move to layer ▸" (context action /
  right-click / panel drag). A shape belongs to exactly one layer.
- **Groups** live on a layer as a unit; their children move with them.
- New shapes land on the **active layer**.
- Phone: opened via the dedicated bottom-right layers icon.
- Stored on the document model (`layerId` per shape, ordered `layers[]`). Affects
  render order in the Paper reconciler.

### 13.3 Decomposition hierarchy (Ungroup → Break)
Two distinct "take it apart" operations, both non-destructive (undoable):

| Op | Applies to | Result |
|---|---|---|
| **Ungroup** (`⌘⇧G`) | a Group | releases members back to independent shapes (one level) |
| **Break / Explode** | a single compound shape | decomposes into primitive segments |

**Break rules:**
| Shape | Breaks into |
|---|---|
| Rectangle | 4 Lines (corner-coincident; coincident constraints auto-added at corners) |
| Polygon / star | N Lines |
| Rounded rectangle | 4 Lines + 4 Arcs |
| Circle | 1 closed Arc / or 2–4 Arcs (configurable) |
| Library shape (robot, gear…) | its underlying Lines / Arcs / Bezier segments |
| Bezier path | individual curve segments |

- After Break, each primitive is independently selectable, dimensionable, and
  constraint-able — coincident constraints preserve connectivity so editing one
  endpoint still moves its neighbor.
- Break is offered in the context toolbar (and right-click) when exactly one
  compound shape is selected. Greyed out for already-primitive Lines/Arcs.

---

## 12. Success Test (unchanged, from brief)
A 10-year-old can: draw a rectangle → make a circle → align them → dimension them →
apply tangent → edit a dimension → import an SVG → modify it — with **zero docs and
zero CAD vocabulary**. Every interaction above is covered by §3–§8.
