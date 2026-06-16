import { type Shape, type ShapeId, type Pt } from '../../core/geometry/shapes';
import { keyPoints } from '../../core/geometry/transform';

const SNAP_PX = 9; // screen-pixel radius for point snapping
const GRID_MM = 1;

export interface SnapResult {
  point: Pt;
  /** True when we snapped to a real geometry point (worth showing an indicator). */
  pointSnap: boolean;
}

/**
 * Snap a raw project (mm) point to the nearest geometry key-point of other
 * shapes (endpoints, centers, midpoints, corners, nodes). Falls back to the 1mm
 * grid when nothing is close (UI_UX_SPEC §8). `exclude` skips shapes (e.g. the
 * ones currently being moved) so geometry never snaps to itself.
 */
export function snapPoint(
  target: Pt,
  shapes: Shape[],
  exclude: ShapeId[],
  zoom: number
): SnapResult {
  const tol = SNAP_PX / zoom;
  let best: Pt | null = null;
  let bestD = tol;
  const skip = new Set(exclude);
  for (const s of shapes) {
    if (skip.has(s.id)) continue;
    for (const p of keyPoints(s)) {
      const d = Math.hypot(p.x - target.x, p.y - target.y);
      if (d <= bestD) {
        bestD = d;
        best = p;
      }
    }
  }
  if (best) return { point: { ...best }, pointSnap: true };
  return {
    point: {
      x: Math.round(target.x / GRID_MM) * GRID_MM,
      y: Math.round(target.y / GRID_MM) * GRID_MM,
    },
    pointSnap: false,
  };
}
