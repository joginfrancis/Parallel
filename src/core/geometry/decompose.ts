import { type Shape, type LineShape, newId } from './shapes';
import { getHandles } from './transform';

/**
 * Break / Explode a shape into its primitive segments (UI_UX_SPEC §13.3).
 * Rectangle → 4 lines; path → one path per segment (handles preserved);
 * other shapes are returned unchanged (already primitive).
 */
export function breakShape(shape: Shape): Shape[] {
  if (shape.type === 'rectangle') {
    const h = getHandles(shape, 1);
    const order = ['nw', 'ne', 'se', 'sw'];
    const corners = order.map((k) => h.find((x) => x.key === k)!.pos);
    const lines: LineShape[] = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      lines.push({ id: newId(), type: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    return lines;
  }

  if (shape.type === 'path') {
    const segs: Shape[] = [];
    const n = shape.nodes.length;
    const count = shape.closed ? n : n - 1;
    for (let i = 0; i < count; i++) {
      const a = shape.nodes[i];
      const b = shape.nodes[(i + 1) % n];
      segs.push({
        id: newId(),
        type: 'path',
        closed: false,
        nodes: [
          { x: a.x, y: a.y, hoX: a.hoX, hoY: a.hoY },
          { x: b.x, y: b.y, hiX: b.hiX, hiY: b.hiY },
        ],
      });
    }
    return segs.length ? segs : [shape];
  }

  return [shape]; // circle / arc / line already primitive
}

/** True if a shape can be broken into smaller primitives. */
export function isBreakable(shape: Shape): boolean {
  return shape.type === 'rectangle' || (shape.type === 'path' && shape.nodes.length > 2);
}
