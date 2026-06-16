import {
  type Shape,
  type ShapeId,
  type PathNode,
  newId,
} from '../../core/geometry/shapes';
import {
  hitHandle,
  cornerRotateHit,
  applyResize,
  applyRotate,
  measureLabel,
  segmentLabel,
  constrainOrtho,
  arcInfo,
  boundsOf,
  type Bounds,
  type Handle,
} from '../../core/geometry/transform';
import { hitEditHandle, applyEdit, toggleNodeSmooth } from '../../core/geometry/pathEdit';
import { smartSnap, type Guide } from '../snapping/smartGuides';
import { solveAndApply } from '../../core/constraints/solveAndApply';
import { detectConstraints } from '../../core/constraints/detect';
import { type Constraint } from '../../core/constraints/model';

export interface Rect { x: number; y: number; w: number; h: number }

/** Union of multiple bounds. */
function unionBounds(list: Bounds[]): Bounds {
  const b: Bounds = {
    minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, cx: 0, cy: 0,
  };
  for (const o of list) {
    b.minX = Math.min(b.minX, o.minX);
    b.minY = Math.min(b.minY, o.minY);
    b.maxX = Math.max(b.maxX, o.maxX);
    b.maxY = Math.max(b.maxY, o.maxY);
  }
  b.cx = (b.minX + b.maxX) / 2;
  b.cy = (b.minY + b.maxY) / 2;
  return b;
}
import { renderShape } from '../canvas/renderShape';
import { makeLabelChip } from '../canvas/labelChip';
import { type ToolId } from '../../store/toolStore';
import paper from 'paper';

const MIN_DRAW_MM = 0.5;

interface ToolDeps {
  layer: paper.Layer;
  getTool: () => ToolId;
  setTool: (t: ToolId) => void;
  getZoom: () => number;
  getConstrain: () => boolean; // Shift held → ortho (h/v/45°)
  getShapes: () => Shape[];
  getSelection: () => ShapeId[];
  commitShape: (s: Shape) => void;
  updateShape: (id: ShapeId, patch: Partial<Shape>) => void;
  moveShapes: (ids: ShapeId[], dx: number, dy: number) => void;
  setSelection: (ids: ShapeId[]) => void;
  clearSelection: () => void;
  beginInteraction: () => void;
  endInteraction: () => void;
  drawGuides: (guides: Guide[]) => void;
  drawMarquee: (rect: Rect | null) => void;
  getShift: () => boolean; // Shift held → add/remove from selection
  getEditPath: () => ShapeId | null;
  setEditPath: (id: ShapeId | null) => void;
  getConstraints: () => Constraint[];
  addConstraints: (cs: Constraint[]) => void;
  updateShapeBatch: (patches: Array<{ id: ShapeId; patch: Partial<Shape> }>) => void;
  notify: (message: string) => void;
  /** Draw transient constraint hints for the given (provisional) shapes. */
  drawHints: (shapes: Shape[], candidates: Constraint[]) => void;
  clearHints: () => void;
  /** Open the inline text editor for a text shape. */
  editText: (id: ShapeId) => void;
  /** Open a file picker and place an image centered at the given project point. */
  placeImage: (at: { x: number; y: number }) => void;
}

/** Two-click span tools (line is a separate polyline tool, handled below). */
const SPAN_TOOLS: ToolId[] = ['rectangle', 'circle'];

function spanShape(tool: ToolId, a: paper.Point, b: paper.Point): Shape | null {
  if (a.getDistance(b) < MIN_DRAW_MM) return null;
  if (tool === 'rectangle')
    return {
      id: newId(),
      type: 'rectangle',
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
      cornerRadius: 0,
      rotation: 0,
    };
  if (tool === 'circle')
    return { id: newId(), type: 'circle', cx: a.x, cy: a.y, r: a.getDistance(b) };
  return null;
}

export interface PointerStyle {
  cursor: string;
  hoverKey: string | null;
}

/**
 * Routes pointer events to the active tool (project/mm coords).
 *
 * - Rectangle/Circle: two clicks (start → finish), then auto-switch to Select.
 * - Line: polyline — each click adds a node, click-drag pulls symmetric bezier
 *   handles; double-click or Escape finishes. Arc: three clicks.
 * - Select drags (move/resize/rotate) write the store every frame so geometry
 *   and selection chrome stay in lock-step. A live dimension chip is shown while
 *   drawing.
 */
export function createToolController(deps: ToolDeps) {
  let span: { tool: ToolId; start: paper.Point } | null = null;
  let arc: { points: paper.Point[] } | null = null;
  let poly: { nodes: PathNode[]; activeIdx: number | null; dragging: boolean } | null = null;
  let move:
    | { ids: ShapeId[]; startPointer: paper.Point; startBounds: Bounds; appliedDx: number; appliedDy: number }
    | null = null;
  let transform: { id: ShapeId; handle: Handle } | null = null;
  let marquee: { start: paper.Point; add: ShapeId[]; rect: Rect } | null = null;
  let editDrag: { pathId: ShapeId; key: string } | null = null;
  let preview: paper.Item | null = null;

  /** Run solver after a mutation, applying results via per-shape patches. */
  const runSolver = (pinnedKeys?: Map<string, { x: number; y: number }>) => {
    const constraints = deps.getConstraints();
    if (constraints.length === 0) return;
    const shapes = deps.getShapes();
    const { shapes: solved, converged } = solveAndApply(shapes, constraints, pinnedKeys);
    if (solved !== shapes) {
      for (const s of solved) {
        const orig = shapes.find((o) => o.id === s.id);
        if (orig && orig !== s) deps.updateShape(s.id, s);
      }
    }
    // Over-constrained: solver couldn't satisfy everything. Tell the user plainly.
    if (!converged) {
      deps.notify("These shapes have too many rules to fit — try removing one.");
    }
  };

  /** Auto-detect and apply unambiguous constraints for a shape. */
  const autoDetect = (shapeId: ShapeId) => {
    const shapes = deps.getShapes();
    const constraints = deps.getConstraints();
    const candidates = detectConstraints(shapeId, shapes, constraints);
    // Candidates are already pre-filtered to within tolerance by the detector.
    // Auto-apply the unambiguous, high-value relations (coincident / horizontal /
    // vertical) for any match; require firmer confidence for the noisier pairwise
    // relations (parallel / perpendicular / equal) so they don't fire everywhere.
    const STRONG = new Set(['coincident', 'horizontal', 'vertical', 'concentric']);
    const toApply = candidates
      .filter((c) => STRONG.has(c.constraint.type) || c.confidence > 0.4)
      .map((c) => c.constraint);
    if (toApply.length > 0) deps.addConstraints(toApply);
  };

  /**
   * Live constraint *preview* during a gesture. `provisional` is the in-progress
   * geometry (a committed shape mid-drag, or a not-yet-committed preview shape
   * with a temp id). Detects what would apply and draws transient magenta hints.
   */
  const liveHints = (provisional: Shape[]) => {
    const committed = deps.getShapes();
    const byId = new Map(committed.map((s) => [s.id, s] as const));
    // Provisional shapes override their committed counterpart (mid-drag state).
    for (const p of provisional) byId.set(p.id, p);
    const all = Array.from(byId.values());
    const existing = deps.getConstraints();
    const seen = new Set<string>();
    const hints: Constraint[] = [];
    for (const p of provisional) {
      for (const c of detectConstraints(p.id, all, existing)) {
        const k = c.constraint.type + ':' + c.constraint.id;
        if (seen.has(k)) continue;
        seen.add(k);
        hints.push(c.constraint);
      }
    }
    deps.drawHints(all, hints);
  };

  /** Build a provisional single-segment line for live hinting (temp id). */
  const previewLine = (a: { x: number; y: number }, b: { x: number; y: number }): Shape => ({
    id: 'preview', type: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y,
  });

  /** The path currently in edit-points mode, if any. */
  const editPathShape = () => {
    const id = deps.getEditPath();
    if (!id) return null;
    const s = deps.getShapes().find((x) => x.id === id);
    return s && s.type === 'path' ? s : null;
  };

  const startMove = (ids: ShapeId[], pt: paper.Point) => {
    const shapes = deps.getShapes().filter((s) => ids.includes(s.id));
    move = {
      ids,
      startPointer: pt,
      startBounds: unionBounds(shapes.map(boundsOf)),
      appliedDx: 0,
      appliedDy: 0,
    };
    deps.beginInteraction();
  };

  const single = (): Shape | null => {
    const sel = deps.getSelection();
    if (sel.length !== 1) return null;
    return deps.getShapes().find((s) => s.id === sel[0]) ?? null;
  };

  /** Expand a shape id to all members of its group (or just itself). */
  const expandGroup = (id: ShapeId): ShapeId[] => {
    const shapes = deps.getShapes();
    const s = shapes.find((x) => x.id === id);
    if (s?.groupId) return shapes.filter((x) => x.groupId === s.groupId).map((x) => x.id);
    return [id];
  };

  /** Apply Shift-ortho to a polyline point relative to the last placed node. */
  const lineTarget = (pt: paper.Point): paper.Point => {
    if (!poly || poly.nodes.length === 0 || !deps.getConstrain()) return pt;
    const last = poly.nodes[poly.nodes.length - 1];
    const o = constrainOrtho(last, { x: pt.x, y: pt.y });
    return new paper.Point(o.x, o.y);
  };

  const clearPreview = () => {
    preview?.remove();
    preview = null;
  };

  /** Draw a translucent preview shape plus an optional dimension chip. */
  const drawPreview = (shape: Shape | null, chip?: { text: string; at: paper.Point }) => {
    clearPreview();
    if (!shape) return;
    const item = renderShape(shape);
    item.opacity = 0.7;
    const group = new paper.Group([item]);
    if (chip) group.addChild(makeLabelChip(chip.text, { x: chip.at.x, y: chip.at.y }, deps.getZoom()));
    preview = group;
  };

  const hitTestId = (pt: paper.Point): ShapeId | null => {
    const tol = 6 / deps.getZoom();
    const res = deps.layer.hitTest(pt, { fill: true, stroke: true, segments: true, tolerance: tol });
    return (res?.item?.data?.id as ShapeId | undefined) ?? null;
  };

  const cancel = () => {
    clearPreview();
    deps.drawGuides([]);
    deps.drawMarquee(null);
    deps.clearHints();
    span = null;
    arc = null;
    poly = null;
    move = null;
    transform = null;
    marquee = null;
    editDrag = null;
  };

  /** Commit the in-progress polyline (dedup a doubled last node). */
  const commitPoly = () => {
    if (!poly) return;
    const nodes = poly.nodes.slice();
    if (nodes.length >= 2) {
      const a = nodes[nodes.length - 1];
      const b = nodes[nodes.length - 2];
      if (Math.hypot(a.x - b.x, a.y - b.y) < MIN_DRAW_MM) nodes.pop();
    }
    if (nodes.length >= 2) {
      // A single straight segment (2 corner nodes, no bezier handles) is a Line —
      // commit it as such so it gets full constraint + dimension support. Anything
      // with more nodes or any curve handle stays a path.
      const straightSegment =
        nodes.length === 2 &&
        nodes.every((n) => n.hiX == null && n.hiY == null && n.hoX == null && n.hoY == null);
      const shape: Shape = straightSegment
        ? { id: newId(), type: 'line', x1: nodes[0].x, y1: nodes[0].y, x2: nodes[1].x, y2: nodes[1].y }
        : { id: newId(), type: 'path', nodes, closed: false };
      deps.commitShape(shape);
      autoDetect(shape.id);
      deps.setSelection([shape.id]);
    }
    poly = null;
    clearPreview();
    deps.clearHints();
  };

  return {
    cancel,

    down(pt: paper.Point): boolean {
      const tool = deps.getTool();

      if (tool === 'select') {
        const shift = deps.getShift();
        // 0. Point-edit mode: grab an anchor / bezier control of the path.
        const editP = editPathShape();
        if (editP) {
          const eh = hitEditHandle(editP, pt, deps.getZoom());
          if (eh) {
            editDrag = { pathId: editP.id, key: eh.key };
            deps.beginInteraction();
            return true;
          }
          if (hitTestId(pt) === editP.id) return true; // clicked path body → stay
          deps.setEditPath(null); // clicked away → exit edit mode, then select normally
        }
        // 1. Grab a handle / rotate-ring of the single selected shape.
        const sel = single();
        if (sel) {
          const handle =
            hitHandle(sel, pt, deps.getZoom()) ?? cornerRotateHit(sel, pt, deps.getZoom());
          if (handle) {
            transform = { id: sel.id, handle };
            deps.beginInteraction();
            return true;
          }
        }
        // 2. Hit a shape → select / shift-toggle / move the selection.
        const id = hitTestId(pt);
        const selIds = deps.getSelection();
        if (id) {
          const group = expandGroup(id); // grouped shapes select together
          if (shift) {
            const allIn = group.every((g) => selIds.includes(g));
            const next = allIn
              ? selIds.filter((x) => !group.includes(x))
              : Array.from(new Set([...selIds, ...group]));
            deps.setSelection(next);
            return true; // shift-toggle doesn't start a move
          }
          const ids = selIds.includes(id) ? selIds : group;
          if (!selIds.includes(id)) deps.setSelection(group);
          startMove(ids, pt);
        } else {
          // 3. Empty → marquee select (Shift keeps the current selection).
          if (!shift) deps.clearSelection();
          marquee = { start: pt, add: shift ? selIds.slice() : [], rect: { x: pt.x, y: pt.y, w: 0, h: 0 } };
        }
        return true;
      }

      if (SPAN_TOOLS.includes(tool)) {
        if (!span) {
          span = { tool, start: pt };
        } else {
          const shape = spanShape(span.tool, span.start, pt);
          clearPreview();
          span = null;
          if (shape) {
            deps.commitShape(shape);
            autoDetect(shape.id);
            deps.setSelection([shape.id]);
            deps.setTool('select');
          }
        }
        return true;
      }

      if (tool === 'line') {
        if (!poly) poly = { nodes: [{ x: pt.x, y: pt.y }], activeIdx: 0, dragging: true };
        else {
          const t = lineTarget(pt); // ortho relative to previous node
          poly.nodes.push({ x: t.x, y: t.y });
          poly.activeIdx = poly.nodes.length - 1;
          poly.dragging = true;
        }
        return true;
      }

      if (tool === 'arc') {
        if (!arc) arc = { points: [pt] };
        else if (arc.points.length === 1) arc.points.push(pt);
        else {
          const [from, to] = arc.points;
          clearPreview();
          const arcShape: Shape = {
            id: newId(),
            type: 'arc',
            from: { x: from.x, y: from.y },
            through: { x: pt.x, y: pt.y },
            to: { x: to.x, y: to.y },
          };
          deps.commitShape(arcShape);
          autoDetect(arcShape.id);
          deps.setSelection([arcShape.id]);
          arc = null;
          deps.setTool('select');
        }
        return true;
      }

      if (tool === 'text') {
        const shape: Shape = {
          id: newId(), type: 'text',
          x: pt.x, y: pt.y, text: '', fontSize: 16,
          align: 'left', color: '#1d1d1f',
        };
        deps.commitShape(shape);
        deps.setSelection([shape.id]);
        deps.setTool('select');
        deps.editText(shape.id);
        return true;
      }

      if (tool === 'image') {
        deps.placeImage({ x: pt.x, y: pt.y });
        deps.setTool('select');
        return true;
      }

      return false; // pen not yet implemented
    },

    moveTo(pt: paper.Point) {
      if (editDrag) {
        const path = deps.getShapes().find((s) => s.id === editDrag!.pathId);
        if (path && path.type === 'path') {
          deps.updateShape(editDrag.pathId, applyEdit(path, editDrag.key, pt));
          // Pin the dragged node, let solver adjust neighbors
          const nodeIdx = editDrag.key.startsWith('a') ? editDrag.key.slice(1) : null;
          if (nodeIdx != null) {
            const pinned = new Map<string, { x: number; y: number }>();
            pinned.set(`${editDrag.pathId}:n${nodeIdx}`, { x: pt.x, y: pt.y });
            runSolver(pinned);
          }
          const moved = deps.getShapes().find((s) => s.id === editDrag!.pathId);
          if (moved) liveHints([moved]);
        }
        return;
      }
      if (marquee) {
        const x = Math.min(marquee.start.x, pt.x);
        const y = Math.min(marquee.start.y, pt.y);
        const w = Math.abs(pt.x - marquee.start.x);
        const h = Math.abs(pt.y - marquee.start.y);
        marquee.rect = { x, y, w, h };
        deps.drawMarquee(marquee.rect);
        return;
      }
      if (transform) {
        const shape = deps.getShapes().find((s) => s.id === transform!.id);
        if (!shape) return;
        const patch =
          transform.handle.kind === 'rotate'
            ? applyRotate(shape, pt)
            : applyResize(shape, transform.handle.key, pt);
        deps.updateShape(transform.id, patch);
        runSolver();
        const moved = deps.getShapes().find((s) => s.id === transform!.id);
        if (moved) liveHints([moved]);
        return;
      }
      if (move) {
        // Snap the move to edge/center alignment with other shapes (Figma smart
        // guides), computed from the *true* delta so it isn't sticky.
        const trueDx = pt.x - move.startPointer.x;
        const trueDy = pt.y - move.startPointer.y;
        const others = deps
          .getShapes()
          .filter((s) => !move!.ids.includes(s.id))
          .map(boundsOf);
        const r = smartSnap(move.startBounds, trueDx, trueDy, others, deps.getZoom());
        const ddx = r.dx - move.appliedDx;
        const ddy = r.dy - move.appliedDy;
        if (ddx || ddy) deps.moveShapes(move.ids, ddx, ddy);
        move.appliedDx = r.dx;
        move.appliedDy = r.dy;
        deps.drawGuides(r.guides);
        runSolver();
        const movedShapes = deps.getShapes().filter((s) => move!.ids.includes(s.id));
        liveHints(movedShapes);
        return;
      }
      if (span) {
        const shape = spanShape(span.tool, span.start, pt);
        const m = shape ? measureLabel(shape) : null;
        drawPreview(shape, m ? { text: m.text, at: new paper.Point(m.at.x, m.at.y + 14 / deps.getZoom()) } : undefined);
        if (shape) liveHints([{ ...shape, id: 'preview' } as Shape]);
        else deps.clearHints();
        return;
      }
      if (poly) {
        const node = poly.activeIdx != null ? poly.nodes[poly.activeIdx] : null;
        if (poly.dragging && node) {
          // Pull symmetric bezier handles out of the active node.
          node.hoX = pt.x - node.x;
          node.hoY = pt.y - node.y;
          node.hiX = -node.hoX;
          node.hiY = -node.hoY;
          drawPreview({ id: 'preview', type: 'path', nodes: poly.nodes.slice(), closed: false });
        } else {
          // Rubber-band the next segment to the cursor (ortho-constrained with
          // Shift) + live length/angle chip.
          const last = poly.nodes[poly.nodes.length - 1];
          const t = lineTarget(pt);
          const nodes = [...poly.nodes, { x: t.x, y: t.y }];
          drawPreview(
            { id: 'preview', type: 'path', nodes, closed: false },
            { text: segmentLabel(last, { x: t.x, y: t.y }), at: new paper.Point((last.x + t.x) / 2, (last.y + t.y) / 2 - 10 / deps.getZoom()) }
          );
          // Live hints for the segment being drawn (treated as a line).
          liveHints([previewLine(last, { x: t.x, y: t.y })]);
        }
        return;
      }
      if (arc) {
        const z = deps.getZoom();
        if (arc.points.length === 1) {
          // Step 1 → guide line from the start to the cursor (length + angle).
          const a = arc.points[0];
          drawPreview(
            { id: 'preview', type: 'line', x1: a.x, y1: a.y, x2: pt.x, y2: pt.y },
            { text: segmentLabel(a, { x: pt.x, y: pt.y }), at: new paper.Point((a.x + pt.x) / 2, (a.y + pt.y) / 2 - 10 / z) }
          );
        } else {
          // Step 2 → arc bulges toward the cursor; show radius + arc length.
          const [from, to] = arc.points;
          const info = arcInfo(from, { x: pt.x, y: pt.y }, to);
          drawPreview(
            {
              id: 'preview',
              type: 'arc',
              from: { x: from.x, y: from.y },
              through: { x: pt.x, y: pt.y },
              to: { x: to.x, y: to.y },
            },
            { text: `R ${info.r.toFixed(0)} mm   ${info.len.toFixed(0)} mm`, at: new paper.Point(pt.x, pt.y - 12 / z) }
          );
        }
      }
    },

    up() {
      if (editDrag) {
        const id = editDrag.pathId;
        editDrag = null;
        deps.clearHints();
        autoDetect(id);
        deps.endInteraction();
        return;
      }
      if (marquee) {
        const { x, y, w, h } = marquee.rect;
        const hit =
          w < 0.5 && h < 0.5
            ? []
            : deps
                .getShapes()
                .filter((s) => {
                  const b = boundsOf(s);
                  return !(b.maxX < x || b.minX > x + w || b.maxY < y || b.minY > y + h);
                })
                .map((s) => s.id);
        deps.setSelection(Array.from(new Set([...marquee.add, ...hit])));
        deps.drawMarquee(null);
        marquee = null;
        return;
      }
      if (transform) {
        const id = transform.id;
        transform = null;
        deps.clearHints();
        autoDetect(id);
        deps.endInteraction();
        return;
      }
      if (move) {
        const ids = move.ids.slice();
        move = null;
        deps.drawGuides([]);
        deps.clearHints();
        for (const id of ids) autoDetect(id);
        deps.endInteraction();
        return;
      }
      if (poly && poly.dragging) {
        poly.dragging = false;
        poly.activeIdx = null;
      }
    },

    /** Double-click finishes a polyline, or enters point-edit mode on a path. */
    doubleClick(pt?: paper.Point) {
      if (poly) {
        commitPoly();
        deps.setTool('select');
        return;
      }
      // In edit mode, double-clicking an anchor toggles corner ↔ smooth.
      const editP = editPathShape();
      if (editP && pt) {
        const eh = hitEditHandle(editP, pt, deps.getZoom());
        if (eh && eh.kind === 'anchor') {
          deps.updateShape(editP.id, toggleNodeSmooth(editP, Number(eh.key.slice(1))));
          return;
        }
      }
      if (deps.getTool() === 'select' && pt) {
        const id = hitTestId(pt);
        const s = id ? deps.getShapes().find((x) => x.id === id) : null;
        if (s && s.type === 'path') {
          deps.setSelection([id!]); // note: resets editPath, so set it after
          deps.setEditPath(id!);
        } else if (s && s.type === 'text') {
          deps.setSelection([id!]);
          deps.editText(id!);
        }
      }
    },

    /** Escape: finish any in-progress polyline, else cancel. Caller switches tool. */
    finish() {
      if (poly) commitPoly();
      cancel();
    },

    /** Cursor + which handle to highlight, for the current pointer position. */
    pointerStyle(pt: paper.Point): PointerStyle {
      if (transform) return { cursor: transform.handle.cursor, hoverKey: transform.handle.key };
      if (move) return { cursor: 'move', hoverKey: null };
      if (marquee) return { cursor: 'crosshair', hoverKey: null };
      if (editDrag) return { cursor: 'move', hoverKey: editDrag.key };
      const tool = deps.getTool();
      if (tool === 'select') {
        const editP = editPathShape();
        if (editP) {
          const eh = hitEditHandle(editP, pt, deps.getZoom());
          if (eh) return { cursor: 'move', hoverKey: eh.key };
        }
        const sel = single();
        if (sel) {
          const h = hitHandle(sel, pt, deps.getZoom());
          if (h) return { cursor: h.cursor, hoverKey: h.key };
          if (cornerRotateHit(sel, pt, deps.getZoom())) return { cursor: 'grab', hoverKey: null };
        }
        return hitTestId(pt) ? { cursor: 'move', hoverKey: null } : { cursor: 'default', hoverKey: null };
      }
      return { cursor: 'crosshair', hoverKey: null };
    },
  };
}
