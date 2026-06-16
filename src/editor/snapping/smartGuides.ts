import { type Bounds } from '../../core/geometry/transform';

const ALIGN_PX = 6; // screen-pixel tolerance for edge/center alignment

export interface Guide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface SmartSnapResult {
  dx: number; // adjusted move delta
  dy: number;
  guides: Guide[];
}

function shift(b: Bounds, dx: number, dy: number): Bounds {
  return {
    minX: b.minX + dx,
    minY: b.minY + dy,
    maxX: b.maxX + dx,
    maxY: b.maxY + dy,
    cx: b.cx + dx,
    cy: b.cy + dy,
  };
}

/**
 * Figma-style alignment: given a shape's start bounds and a proposed move
 * (dx,dy), snap to the nearest left/center/right (X) and top/middle/bottom (Y)
 * alignment with any other shape, and return magenta guide lines to draw
 * (UI_UX_SPEC §8). Snapping is computed from the *true* delta each frame, so it
 * isn't sticky.
 */
export function smartSnap(
  start: Bounds,
  dx: number,
  dy: number,
  others: Bounds[],
  zoom: number
): SmartSnapResult {
  const tol = ALIGN_PX / zoom;
  const moved = shift(start, dx, dy);

  // --- X axis (vertical guide lines) ---
  let bestX: { delta: number; line: number; o: Bounds } | null = null;
  const movX = [moved.minX, moved.cx, moved.maxX];
  for (const o of others) {
    for (const ov of [o.minX, o.cx, o.maxX]) {
      for (const mv of movX) {
        const d = ov - mv;
        if (Math.abs(d) <= tol && (!bestX || Math.abs(d) < Math.abs(bestX.delta))) {
          bestX = { delta: d, line: ov, o };
        }
      }
    }
  }

  // --- Y axis (horizontal guide lines) ---
  let bestY: { delta: number; line: number; o: Bounds } | null = null;
  const movY = [moved.minY, moved.cy, moved.maxY];
  for (const o of others) {
    for (const ov of [o.minY, o.cy, o.maxY]) {
      for (const mv of movY) {
        const d = ov - mv;
        if (Math.abs(d) <= tol && (!bestY || Math.abs(d) < Math.abs(bestY.delta))) {
          bestY = { delta: d, line: ov, o };
        }
      }
    }
  }

  const adjDx = dx + (bestX?.delta ?? 0);
  const adjDy = dy + (bestY?.delta ?? 0);
  const fin = shift(start, adjDx, adjDy);
  const guides: Guide[] = [];

  if (bestX) {
    const y1 = Math.min(fin.minY, bestX.o.minY);
    const y2 = Math.max(fin.maxY, bestX.o.maxY);
    guides.push({ x1: bestX.line, y1, x2: bestX.line, y2 });
  }
  if (bestY) {
    const x1 = Math.min(fin.minX, bestY.o.minX);
    const x2 = Math.max(fin.maxX, bestY.o.maxX);
    guides.push({ x1, y1: bestY.line, x2, y2: bestY.line });
  }

  return { dx: adjDx, dy: adjDy, guides };
}
