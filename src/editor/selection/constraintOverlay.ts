import paper from 'paper';
import { type Shape, type ShapeId } from '../../core/geometry/shapes';
import {
  type Constraint,
  getPoint,
  constraintLabel,
} from '../../core/constraints/model';

const GUIDE_COLOR = '#FF4DA6';
const TAG_BG = '#F3E8FF'; // light purple
const TAG_TEXT = '#7C3AED';
const TAG_FONT = 10;

/**
 * Draw constraint glyphs and tags on the overlay layer. Each glyph group has
 * `data.constraintId` for click-to-remove hit-testing.
 *
 * Called on every sync — redraws all constraints from scratch (cheap for <100).
 */
export function drawConstraints(
  layer: paper.Layer,
  shapes: Shape[],
  constraints: Constraint[],
  zoom: number
) {
  // Remove previous constraint items
  const toRemove: paper.Item[] = [];
  for (const child of layer.children) {
    if (child.data?.isConstraint) toRemove.push(child);
  }
  for (const item of toRemove) item.remove();

  if (constraints.length === 0) return;

  const shapeMap = new Map<ShapeId, Shape>();
  for (const s of shapes) shapeMap.set(s.id, s);

  const px = 1 / zoom; // one screen pixel in project coords

  for (const c of constraints) {
    const group = drawConstraintGlyph(c, shapeMap, px);
    if (group) {
      group.data = { isConstraint: true, constraintId: c.id };
      layer.addChild(group);
    }
  }
}

/**
 * Draw transient constraint *hints* on a dedicated layer while the user is
 * drawing/moving/transforming — the live "this is about to apply" feedback
 * (UI_UX_SPEC §6.3). Same glyphs as committed constraints but slightly faded,
 * and fully cleared each frame (the layer holds nothing else).
 */
export function drawConstraintHints(
  layer: paper.Layer,
  shapes: Shape[],
  candidates: Constraint[],
  zoom: number
) {
  layer.removeChildren();
  if (candidates.length === 0) return;
  layer.activate();

  const shapeMap = new Map<ShapeId, Shape>();
  for (const s of shapes) shapeMap.set(s.id, s);
  const px = 1 / zoom;

  for (const c of candidates) {
    const group = drawConstraintGlyph(c, shapeMap, px);
    if (group) {
      group.opacity = 0.95;
      layer.addChild(group);
    }
  }
}

function drawConstraintGlyph(
  c: Constraint,
  shapes: Map<ShapeId, Shape>,
  px: number,
): paper.Group | null {
  switch (c.type) {
    case 'coincident': return drawCoincident(c, shapes, px);
    case 'horizontal': return drawHVTag(c, shapes, px, 'Horizontal');
    case 'vertical': return drawHVTag(c, shapes, px, 'Vertical');
    case 'parallel': return drawParallel(c, shapes, px);
    case 'perpendicular': return drawPerpendicular(c, shapes, px);
    case 'equal': return drawEqual(c, shapes, px);
    case 'fixed': return drawFixed(c, shapes, px);
    case 'midpoint': return drawMidpoint(c, shapes, px);
    case 'concentric': return drawConcentric(c, shapes, px);
    case 'tangent': return drawTangent(c, shapes, px);
    case 'collinear': return drawCollinear(c, shapes, px);
    case 'distance': return drawTag(c, shapes, px);
    case 'angle': return drawTag(c, shapes, px);
  }
}

function drawCoincident(
  c: Constraint & { type: 'coincident' },
  shapes: Map<ShapeId, Shape>,
  px: number,
): paper.Group | null {
  const s = shapes.get(c.a.shape);
  if (!s) return null;
  const p = getPoint(s, c.a.key);
  if (!p) return null;

  const dot = new paper.Path.Circle(new paper.Point(p.x, p.y), 4 * px);
  dot.fillColor = new paper.Color(GUIDE_COLOR);
  dot.strokeColor = null;

  return new paper.Group([dot]);
}

function drawHVTag(
  c: Constraint & { type: 'horizontal' | 'vertical' },
  shapes: Map<ShapeId, Shape>,
  px: number,
  label: string
): paper.Group | null {
  const s = shapes.get(c.line);
  if (!s || s.type !== 'line') return null;

  const mx = (s.x1 + s.x2) / 2;
  const my = (s.y1 + s.y2) / 2;

  // Small glyph: dash for horizontal, bar for vertical
  const len = 6 * px;
  const glyph = new paper.Path();
  if (c.type === 'horizontal') {
    glyph.add(new paper.Point(mx - len, my));
    glyph.add(new paper.Point(mx + len, my));
  } else {
    glyph.add(new paper.Point(mx, my - len));
    glyph.add(new paper.Point(mx, my + len));
  }
  glyph.strokeColor = new paper.Color(GUIDE_COLOR);
  glyph.strokeWidth = 2 * px;

  const tag = makeTag(label, mx, my - 10 * px, px);

  return new paper.Group([glyph, tag]);
}

function drawParallel(
  c: Constraint & { type: 'parallel' },
  shapes: Map<ShapeId, Shape>,
  px: number,
): paper.Group | null {
  const items: paper.Item[] = [];
  for (const lineId of [c.lineA, c.lineB]) {
    const s = shapes.get(lineId);
    if (!s || s.type !== 'line') continue;
    const mx = (s.x1 + s.x2) / 2;
    const my = (s.y1 + s.y2) / 2;
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy) || 1;
    // Perpendicular direction for the // marks
    const nx = -dy / len * 3 * px;
    const ny = dx / len * 3 * px;
    const gap = 2 * px;
    const along = { x: dx / len * gap, y: dy / len * gap };

    for (const sign of [-1, 1]) {
      const cx = mx + sign * along.x;
      const cy = my + sign * along.y;
      const mark = new paper.Path();
      mark.add(new paper.Point(cx - nx, cy - ny));
      mark.add(new paper.Point(cx + nx, cy + ny));
      mark.strokeColor = new paper.Color(GUIDE_COLOR);
      mark.strokeWidth = 1.5 * px;
      items.push(mark);
    }
  }
  if (items.length === 0) return null;

  const s = shapes.get(c.lineA);
  if (s && s.type === 'line') {
    const tag = makeTag('Parallel', (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2 - 12 * px, px);
    items.push(tag);
  }

  return new paper.Group(items);
}

function drawPerpendicular(
  c: Constraint & { type: 'perpendicular' },
  shapes: Map<ShapeId, Shape>,
  px: number,
): paper.Group | null {
  const sA = shapes.get(c.lineA);
  const sB = shapes.get(c.lineB);
  if (!sA || !sB || sA.type !== 'line' || sB.type !== 'line') return null;

  // Find the closest endpoints between the two lines as the right-angle mark location
  let bestD = Infinity;
  let corner = { x: 0, y: 0 };
  for (const pa of [{ x: sA.x1, y: sA.y1 }, { x: sA.x2, y: sA.y2 }]) {
    for (const pb of [{ x: sB.x1, y: sB.y1 }, { x: sB.x2, y: sB.y2 }]) {
      const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      if (d < bestD) { bestD = d; corner = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }; }
    }
  }

  const sz = 5 * px;
  const sq = new paper.Path();
  sq.add(new paper.Point(corner.x + sz, corner.y));
  sq.add(new paper.Point(corner.x + sz, corner.y + sz));
  sq.add(new paper.Point(corner.x, corner.y + sz));
  sq.strokeColor = new paper.Color(GUIDE_COLOR);
  sq.strokeWidth = 1.5 * px;
  sq.fillColor = null;

  const tag = makeTag('Right angle', corner.x, corner.y - 10 * px, px);

  return new paper.Group([sq, tag]);
}

function drawEqual(
  c: Constraint & { type: 'equal' },
  shapes: Map<ShapeId, Shape>,
  px: number,
): paper.Group | null {
  const items: paper.Item[] = [];
  for (const sid of [c.shapeA, c.shapeB]) {
    const s = shapes.get(sid);
    if (!s || s.type !== 'line') continue;
    const mx = (s.x1 + s.x2) / 2;
    const my = (s.y1 + s.y2) / 2;
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len * 3 * px;
    const ny = dx / len * 3 * px;

    for (const off of [-1.5 * px, 1.5 * px]) {
      const ox = dx / len * off;
      const oy = dy / len * off;
      const mark = new paper.Path();
      mark.add(new paper.Point(mx + ox - nx, my + oy - ny));
      mark.add(new paper.Point(mx + ox + nx, my + oy + ny));
      mark.strokeColor = new paper.Color(GUIDE_COLOR);
      mark.strokeWidth = 1.5 * px;
      items.push(mark);
    }
  }
  if (items.length === 0) return null;
  return new paper.Group(items);
}

function drawFixed(
  c: Constraint & { type: 'fixed' },
  shapes: Map<ShapeId, Shape>,
  px: number,
): paper.Group | null {
  const s = shapes.get(c.ref.shape);
  if (!s) return null;
  const p = getPoint(s, c.ref.key);
  if (!p) return null;

  // Lock icon: small square with a semicircle on top
  const sz = 4 * px;
  const rect = new paper.Path.Rectangle(
    new paper.Point(p.x - sz, p.y - sz / 2),
    new paper.Size(sz * 2, sz * 1.5)
  );
  rect.fillColor = new paper.Color(GUIDE_COLOR);
  rect.strokeColor = null;

  const arc = new paper.Path.Arc(
    new paper.Point(p.x - sz * 0.6, p.y - sz / 2),
    new paper.Point(p.x, p.y - sz * 1.5),
    new paper.Point(p.x + sz * 0.6, p.y - sz / 2)
  );
  arc.strokeColor = new paper.Color(GUIDE_COLOR);
  arc.strokeWidth = 2 * px;
  arc.fillColor = null;

  const tag = makeTag('Locked', p.x, p.y - 14 * px, px);

  return new paper.Group([rect, arc, tag]);
}

function drawMidpoint(
  c: Constraint & { type: 'midpoint' },
  shapes: Map<ShapeId, Shape>,
  px: number,
): paper.Group | null {
  const s = shapes.get(c.point.shape);
  if (!s) return null;
  const p = getPoint(s, c.point.key);
  if (!p) return null;

  const dot = new paper.Path.Circle(new paper.Point(p.x, p.y), 3 * px);
  dot.fillColor = new paper.Color(GUIDE_COLOR);
  const ring = new paper.Path.Circle(new paper.Point(p.x, p.y), 5 * px);
  ring.strokeColor = new paper.Color(GUIDE_COLOR);
  ring.strokeWidth = 1 * px;
  ring.fillColor = null;

  return new paper.Group([dot, ring]);
}

function drawConcentric(
  c: Constraint & { type: 'concentric' },
  shapes: Map<ShapeId, Shape>,
  px: number,
): paper.Group | null {
  const sA = shapes.get(c.circleA);
  if (!sA || sA.type !== 'circle') return null;

  const crossSize = 4 * px;
  const h = new paper.Path();
  h.add(new paper.Point(sA.cx - crossSize, sA.cy));
  h.add(new paper.Point(sA.cx + crossSize, sA.cy));
  const v = new paper.Path();
  v.add(new paper.Point(sA.cx, sA.cy - crossSize));
  v.add(new paper.Point(sA.cx, sA.cy + crossSize));
  h.strokeColor = v.strokeColor = new paper.Color(GUIDE_COLOR);
  h.strokeWidth = v.strokeWidth = 1.5 * px;

  const tag = makeTag('Same center', sA.cx, sA.cy - 10 * px, px);

  return new paper.Group([h, v, tag]);
}

function drawTangent(
  c: Constraint & { type: 'tangent' },
  shapes: Map<ShapeId, Shape>,
  px: number,
): paper.Group | null {
  const line = shapes.get(c.line);
  const circ = shapes.get(c.circle);
  if (!line || line.type !== 'line' || !circ || circ.type !== 'circle') return null;

  // Tangency point = foot of perpendicular from center to the line.
  const dx = line.x2 - line.x1, dy = line.y2 - line.y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = ((circ.cx - line.x1) * dx + (circ.cy - line.y1) * dy) / len2;
  const fx = line.x1 + t * dx;
  const fy = line.y1 + t * dy;

  const dot = new paper.Path.Circle(new paper.Point(fx, fy), 4 * px);
  dot.fillColor = new paper.Color(GUIDE_COLOR);

  const tag = makeTag('Touching', fx, fy - 10 * px, px);
  return new paper.Group([dot, tag]);
}

function drawCollinear(
  c: Constraint & { type: 'collinear' },
  shapes: Map<ShapeId, Shape>,
  px: number,
): paper.Group | null {
  const a = shapes.get(c.lineA);
  if (!a || a.type !== 'line') return null;

  // Dashed magenta line along lineA's direction through its midpoint.
  const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
  const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const ext = (len / 2 + 12 * px);
  const seg = new paper.Path();
  seg.add(new paper.Point(mx - ux * ext, my - uy * ext));
  seg.add(new paper.Point(mx + ux * ext, my + uy * ext));
  seg.strokeColor = new paper.Color(GUIDE_COLOR);
  seg.strokeWidth = 1 * px;
  seg.dashArray = [4 * px, 3 * px];

  const tag = makeTag('In line', mx, my - 10 * px, px);
  return new paper.Group([seg, tag]);
}

function drawTag(
  c: Constraint,
  shapes: Map<ShapeId, Shape>,
  px: number,
): paper.Group | null {
  // Generic tag at the first shape's first point
  let pos: { x: number; y: number } | null = null;
  if ('a' in c && 'shape' in (c as any).a) {
    const s = shapes.get((c as any).a.shape);
    if (s) pos = getPoint(s, (c as any).a.key);
  }
  if (!pos) {
    // Try lineA
    if ('lineA' in c) {
      const s = shapes.get((c as any).lineA);
      if (s && s.type === 'line') pos = { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 };
    }
  }
  if (!pos) return null;

  const label = constraintLabel(c);
  const tag = makeTag(label, pos.x, pos.y - 12 * px, px);
  return new paper.Group([tag]);
}

/** Render a small pill tag with text. */
function makeTag(text: string, x: number, y: number, px: number): paper.Group {
  const fontSize = TAG_FONT * px;
  const txt = new paper.PointText(new paper.Point(x, y));
  txt.content = text;
  txt.fontSize = fontSize;
  txt.fontFamily = 'Inter, system-ui, sans-serif';
  txt.fillColor = new paper.Color(TAG_TEXT);
  txt.justification = 'center';

  const pad = 4 * px;
  const bounds = txt.bounds;
  const bg = new paper.Path.Rectangle(
    new paper.Rectangle(
      bounds.x - pad,
      bounds.y - pad * 0.5,
      bounds.width + pad * 2,
      bounds.height + pad
    ),
    new paper.Size(3 * px, 3 * px)
  );
  bg.fillColor = new paper.Color(TAG_BG);
  bg.strokeColor = new paper.Color(GUIDE_COLOR);
  bg.strokeWidth = 0.5 * px;
  bg.opacity = 0.9;

  return new paper.Group([bg, txt]);
}
