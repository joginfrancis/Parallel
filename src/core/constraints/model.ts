import { type Shape, type ShapeId, type Pt, newId } from '../geometry/shapes';

/**
 * Constraint model (UI_UX_SPEC §6). Constraints live on the document so they
 * are part of history and are satisfied by the Gauss-Newton solver.
 */
export interface PointRef {
  shape: ShapeId;
  key: string;
  // line: 'p0'|'p1'
  // arc:  'from'|'to'
  // path: 'n0','n1',...
  // rect: 'tl'|'tr'|'bl'|'br'|'center'
  // circle: 'center'
}

export type Constraint =
  | { id: string; type: 'coincident'; a: PointRef; b: PointRef }
  | { id: string; type: 'horizontal'; line: ShapeId }
  | { id: string; type: 'vertical'; line: ShapeId }
  | { id: string; type: 'parallel'; lineA: ShapeId; lineB: ShapeId }
  | { id: string; type: 'perpendicular'; lineA: ShapeId; lineB: ShapeId }
  | { id: string; type: 'equal'; shapeA: ShapeId; shapeB: ShapeId }
  | { id: string; type: 'midpoint'; point: PointRef; line: ShapeId }
  | { id: string; type: 'concentric'; circleA: ShapeId; circleB: ShapeId }
  | { id: string; type: 'tangent'; line: ShapeId; circle: ShapeId }
  | { id: string; type: 'collinear'; lineA: ShapeId; lineB: ShapeId }
  | { id: string; type: 'distance'; a: PointRef; b: PointRef; value: number }
  | { id: string; type: 'angle'; lineA: ShapeId; lineB: ShapeId; value: number }
  | { id: string; type: 'fixed'; ref: PointRef; pos: Pt };

export const refKey = (r: PointRef) => `${r.shape}:${r.key}`;
export const newConstraintId = () => `c_${newId()}`;

/** All shape IDs referenced by a constraint. */
export function constraintShapeIds(c: Constraint): ShapeId[] {
  switch (c.type) {
    case 'coincident': return [c.a.shape, c.b.shape];
    case 'horizontal': return [c.line];
    case 'vertical': return [c.line];
    case 'parallel': return [c.lineA, c.lineB];
    case 'perpendicular': return [c.lineA, c.lineB];
    case 'equal': return [c.shapeA, c.shapeB];
    case 'midpoint': return [c.point.shape, c.line];
    case 'concentric': return [c.circleA, c.circleB];
    case 'tangent': return [c.line, c.circle];
    case 'collinear': return [c.lineA, c.lineB];
    case 'distance': return [c.a.shape, c.b.shape];
    case 'angle': return [c.lineA, c.lineB];
    case 'fixed': return [c.ref.shape];
  }
}

/** The constrainable points a shape exposes. */
export function shapePointRefs(shape: Shape): { ref: PointRef; pos: Pt }[] {
  const id = shape.id;
  switch (shape.type) {
    case 'line':
      return [
        { ref: { shape: id, key: 'p0' }, pos: { x: shape.x1, y: shape.y1 } },
        { ref: { shape: id, key: 'p1' }, pos: { x: shape.x2, y: shape.y2 } },
      ];
    case 'arc':
      return [
        { ref: { shape: id, key: 'from' }, pos: { ...shape.from } },
        { ref: { shape: id, key: 'to' }, pos: { ...shape.to } },
      ];
    case 'circle':
      return [
        { ref: { shape: id, key: 'center' }, pos: { x: shape.cx, y: shape.cy } },
      ];
    case 'rectangle':
      return [
        { ref: { shape: id, key: 'center' }, pos: { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 } },
      ];
    case 'path':
      return shape.nodes.map((n, i) => ({
        ref: { shape: id, key: `n${i}` },
        pos: { x: n.x, y: n.y },
      }));
    case 'text':
      return [{ ref: { shape: id, key: 'pos' }, pos: { x: shape.x, y: shape.y } }];
    case 'image':
      return [{ ref: { shape: id, key: 'center' }, pos: { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 } }];
  }
}

/** Read a referenced point's current position. */
export function getPoint(shape: Shape, key: string): Pt | null {
  switch (shape.type) {
    case 'line':
      if (key === 'p0') return { x: shape.x1, y: shape.y1 };
      if (key === 'p1') return { x: shape.x2, y: shape.y2 };
      break;
    case 'arc':
      if (key === 'from') return { ...shape.from };
      if (key === 'to') return { ...shape.to };
      break;
    case 'circle':
      if (key === 'center') return { x: shape.cx, y: shape.cy };
      break;
    case 'rectangle':
      if (key === 'center') return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
      break;
    case 'path': {
      const i = Number(key.slice(1));
      const n = shape.nodes[i];
      return n ? { x: n.x, y: n.y } : null;
    }
    case 'text':
      if (key === 'pos') return { x: shape.x, y: shape.y };
      break;
    case 'image':
      if (key === 'center') return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
      break;
  }
  return null;
}

/** Return a new shape with the referenced point moved to `p`. */
export function setPointInShape(shape: Shape, key: string, p: Pt): Shape {
  switch (shape.type) {
    case 'line':
      if (key === 'p0') return { ...shape, x1: p.x, y1: p.y };
      if (key === 'p1') return { ...shape, x2: p.x, y2: p.y };
      break;
    case 'arc':
      if (key === 'from') return { ...shape, from: { x: p.x, y: p.y } };
      if (key === 'to') return { ...shape, to: { x: p.x, y: p.y } };
      break;
    case 'circle':
      if (key === 'center') return { ...shape, cx: p.x, cy: p.y };
      break;
    case 'rectangle':
      if (key === 'center') {
        const dx = p.x - (shape.x + shape.width / 2);
        const dy = p.y - (shape.y + shape.height / 2);
        return { ...shape, x: shape.x + dx, y: shape.y + dy };
      }
      break;
    case 'path': {
      const i = Number(key.slice(1));
      return {
        ...shape,
        nodes: shape.nodes.map((n, idx) => (idx === i ? { ...n, x: p.x, y: p.y } : n)),
      };
    }
    case 'text':
      if (key === 'pos') return { ...shape, x: p.x, y: p.y };
      break;
    case 'image':
      if (key === 'center') {
        const dx = p.x - (shape.x + shape.width / 2);
        const dy = p.y - (shape.y + shape.height / 2);
        return { ...shape, x: shape.x + dx, y: shape.y + dy };
      }
      break;
  }
  return shape;
}

/** Line direction vector (unnormalized). Null for non-line shapes. */
export function lineDir(shape: Shape): Pt | null {
  if (shape.type === 'line') return { x: shape.x2 - shape.x1, y: shape.y2 - shape.y1 };
  return null;
}

/** Line length. */
export function lineLength(shape: Shape): number | null {
  if (shape.type === 'line') return Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1);
  return null;
}

/** Friendly display name for a constraint type (no CAD jargon). */
export function constraintLabel(c: Constraint): string {
  switch (c.type) {
    case 'coincident': return 'Connected';
    case 'horizontal': return 'Horizontal';
    case 'vertical': return 'Vertical';
    case 'parallel': return 'Parallel';
    case 'perpendicular': return 'Right angle';
    case 'equal': return 'Equal';
    case 'midpoint': return 'Midpoint';
    case 'concentric': return 'Same center';
    case 'tangent': return 'Touching';
    case 'collinear': return 'In line';
    case 'distance': return `${c.value.toFixed(0)} mm`;
    case 'angle': return `${c.value.toFixed(0)}°`;
    case 'fixed': return 'Locked';
  }
}
