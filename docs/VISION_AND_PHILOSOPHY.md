# Vision & Philosophy — Kids Sketch Editor

## The Problem

There's a gap in drawing tools for young people:

- **Kid-friendly tools** (Canva, Google Drawings, Tux Paint) are approachable but imprecise. You can't set a dimension, snap to a point, or reason about geometry.
- **Precision tools** (AutoCAD, FreeCAD, SolidWorks, even Figma) are powerful but hostile to beginners. Dense toolbars, jargon-heavy panels, steep learning curves.

Kids learning design, engineering, robotics, or fabrication deserve a tool that's both precise and humane.

## The Vision

A browser-based sketch editor where a 10-year-old can draw a precise rectangle, set its dimensions to 80mm × 60mm, snap lines to its corners, and export clean SVG — all without ever reading a manual or encountering the word "parametric."

Long-term, this is the tool a teenager uses to:
- Design a laser-cut enclosure for a school project
- Sketch a 3D-printable bracket before moving to a slicer
- Create precise vector art for a poster or logo
- *Learn geometry by doing* — angles, tangency, perpendicularity — through direct manipulation, not textbook definitions

## Core Philosophy

### 1. Canvas-first

The drawing surface is 85%+ of the screen at all times. UI elements float, fade, and appear contextually. There is no permanent sidebar, no property panel, no settings page that takes you away from your work. The tool disappears; the sketch stays.

### 2. Direct manipulation over indirect control

You don't open an "Edit Dimensions" dialog. You click the `80.0 mm` label on the rectangle and type `120`. The shape updates live. Every value on screen is clickable and editable in place. This principle comes from Bret Victor's "Learnable Programming" — the representation *is* the interface.

### 3. The system helps silently

Auto-constraints detect geometric relationships as you draw and apply them with a magenta flash and a friendly tag ("Horizontal", "Parallel"). You never configure constraint rules or manage a constraint panel. The system is always helping; you notice only when it's useful.

If a constraint is wrong, you click the tag to remove it. No undo-redo dance, no solver reconfiguration.

### 4. No jargon

| CAD term | What we show |
|----------|-------------|
| Coincident constraint | Magenta dot at the junction |
| Degrees of freedom | (hidden — never shown) |
| Over-constrained | "This shape can't move — remove a lock?" |
| Parametric dimension | A clickable number on the shape |
| Boolean union | "Combine" button with a preview |

Every label, tooltip, and error message is written for someone who has never used a CAD tool.

### 5. Progressive disclosure

- **Level 1 (beginner):** Draw shapes, see dimensions, undo/redo. That's it.
- **Level 2 (comfortable):** Snap to points, use smart guides, align and distribute.
- **Level 3 (advanced):** Edit bezier points, use boolean operations, work with groups.
- **Level 4 (power user):** Understand constraints, set precise angles, use the object library.

No feature is hidden — but nothing screams at a beginner either.

### 6. Build heuristics first, solver later

Snapping and smart guides (Phase 3) are cheap transient heuristics — they help you place geometry approximately right. The constraint solver (Phase 8) is a powerful persistent engine that maintains exact relationships on every edit. We built the easy, forgiving layer first and proved the UX; the solver plugs in behind a stable interface without reworking the interaction model.

## Design Language

### Color semantics

| Color | Hex | Meaning |
|-------|-----|---------|
| Off-white background | `#FAFAF8` | Warm, paper-like canvas |
| Blue | `#3B82F6` | User / selection / active state |
| Magenta | `#FF4DA6` | System assistance (guides, constraints, snaps) |
| Light purple pill | — | Constraint tag on geometry |
| Dot grid | Light gray | Spatial reference without distraction |
| Magenta axis cross | — | Origin marker at (0, 0) |

### Interaction patterns

- **Two-click drawing** (not drag): click to start, move, click to finish. Forgiving and precise.
- **Click-to-edit values**: every numeric label is an inline editor with ✓/✕ commit/cancel.
- **Hover → highlight → click → select → context toolbar appears**: progressive reveal.
- **Shift = constraint key** (ortho lines, add-to-selection).
- **Double-click = go deeper** (enter point-edit mode).
- **Esc = go back** (exit mode, deselect, cancel).

### UI chrome

- Floating, rounded, semi-translucent toolbars
- Bottom-center contextual toolbar morphs based on selection (the "dynamic heart")
- Left tool rail: 7 tools, icon-only, blue highlight on active
- No modals except three deliberate panels (Shape Library, Import, Export)
- Transitions: 150ms with Framer Motion (opacity + vertical slide)

## Who This Is For

**Primary:** Students aged 10–18 in design, STEM, or maker education.

**Secondary:** Teachers setting up sketch exercises, hobbyist makers who find FreeCAD overwhelming, anyone who wants quick precise SVG without installing desktop software.

**Not for:** Professional engineers who need full parametric CAD, artists who need raster/painting tools, teams who need collaboration features.
