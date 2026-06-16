import { type Shape, type ShapeId } from './shapes';
import { boundsOf, type Bounds } from './transform';

/** Per-shape move deltas (mm). */
export type Deltas = Record<ShapeId, { dx: number; dy: number }>;

export type AlignMode =
  | 'left'
  | 'hcenter'
  | 'right'
  | 'top'
  | 'vcenter'
  | 'bottom';

export type DistributeAxis = 'h' | 'v';

function union(list: Bounds[]): Bounds {
  const u: Bounds = {
    minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, cx: 0, cy: 0,
  };
  for (const b of list) {
    u.minX = Math.min(u.minX, b.minX);
    u.minY = Math.min(u.minY, b.minY);
    u.maxX = Math.max(u.maxX, b.maxX);
    u.maxY = Math.max(u.maxY, b.maxY);
  }
  u.cx = (u.minX + u.maxX) / 2;
  u.cy = (u.minY + u.maxY) / 2;
  return u;
}

/** Move deltas to align all shapes to a shared edge/center (UI_UX_SPEC §4.2). */
export function alignDeltas(shapes: Shape[], mode: AlignMode): Deltas {
  const items = shapes.map((s) => ({ id: s.id, b: boundsOf(s) }));
  const u = union(items.map((i) => i.b));
  const deltas: Deltas = {};
  for (const { id, b } of items) {
    let dx = 0;
    let dy = 0;
    switch (mode) {
      case 'left': dx = u.minX - b.minX; break;
      case 'hcenter': dx = u.cx - b.cx; break;
      case 'right': dx = u.maxX - b.maxX; break;
      case 'top': dy = u.minY - b.minY; break;
      case 'vcenter': dy = u.cy - b.cy; break;
      case 'bottom': dy = u.maxY - b.maxY; break;
    }
    deltas[id] = { dx, dy };
  }
  return deltas;
}

/** Move deltas to distribute shape centers evenly between the extremes. */
export function distributeDeltas(shapes: Shape[], axis: DistributeAxis): Deltas {
  const items = shapes
    .map((s) => ({ id: s.id, b: boundsOf(s) }))
    .sort((a, b) => (axis === 'h' ? a.b.cx - b.b.cx : a.b.cy - b.b.cy));
  const deltas: Deltas = {};
  const n = items.length;
  if (n < 3) {
    for (const { id } of items) deltas[id] = { dx: 0, dy: 0 };
    return deltas;
  }
  const first = axis === 'h' ? items[0].b.cx : items[0].b.cy;
  const last = axis === 'h' ? items[n - 1].b.cx : items[n - 1].b.cy;
  const step = (last - first) / (n - 1);
  items.forEach((it, i) => {
    const target = first + i * step;
    const cur = axis === 'h' ? it.b.cx : it.b.cy;
    deltas[it.id] = axis === 'h' ? { dx: target - cur, dy: 0 } : { dx: 0, dy: target - cur };
  });
  return deltas;
}
