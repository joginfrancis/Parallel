import { type PathShape, type Pt } from './shapes';
import { HANDLE_HIT_PX } from './transform';

/**
 * Point-editing handles for a path (UI_UX_SPEC §7): one anchor per node, plus
 * bezier control points for any node with handles. Keys: `a{i}` anchor,
 * `i{i}` handle-in, `o{i}` handle-out.
 */
export type EditKind = 'anchor' | 'control';
export interface EditHandle {
  key: string;
  kind: EditKind;
  pos: Pt;
  /** For controls: the owning anchor position (to draw the control line). */
  anchor?: Pt;
}

export function getEditHandles(path: PathShape): EditHandle[] {
  const controls: EditHandle[] = [];
  const anchors: EditHandle[] = [];
  path.nodes.forEach((n, i) => {
    const a = { x: n.x, y: n.y };
    anchors.push({ key: `a${i}`, kind: 'anchor', pos: a });
    if (n.hiX != null) {
      controls.push({ key: `i${i}`, kind: 'control', pos: { x: n.x + n.hiX, y: n.y + n.hiY! }, anchor: a });
    }
    if (n.hoX != null) {
      controls.push({ key: `o${i}`, kind: 'control', pos: { x: n.x + n.hoX, y: n.y + n.hoY! }, anchor: a });
    }
  });
  return [...controls, ...anchors]; // controls take hit priority
}

/** Nearest edit handle within the hit radius, or null. */
export function hitEditHandle(path: PathShape, p: Pt, zoom: number): EditHandle | null {
  const tol = HANDLE_HIT_PX / zoom;
  let best: EditHandle | null = null;
  let bestD = tol;
  for (const h of getEditHandles(path)) {
    const d = Math.hypot(h.pos.x - p.x, h.pos.y - p.y);
    if (d <= bestD) { bestD = d; best = h; }
  }
  return best;
}

/** Apply a drag of an anchor or control point. Returns a path patch. */
export function applyEdit(path: PathShape, key: string, p: Pt): Partial<PathShape> {
  const kind = key[0];
  const i = Number(key.slice(1));
  const nodes = path.nodes.map((n, idx) => {
    if (idx !== i) return n;
    if (kind === 'a') return { ...n, x: p.x, y: p.y }; // move anchor (handles ride along)
    if (kind === 'i') return { ...n, hiX: p.x - n.x, hiY: p.y - n.y };
    if (kind === 'o') return { ...n, hoX: p.x - n.x, hoY: p.y - n.y };
    return n;
  });
  return { nodes };
}

/** Toggle a node between corner (no handles) and smooth (symmetric handles). */
export function toggleNodeSmooth(path: PathShape, i: number): Partial<PathShape> {
  const nodes = path.nodes.map((n, idx) => {
    if (idx !== i) return n;
    const smooth = n.hiX != null || n.hoX != null;
    if (smooth) {
      const { hiX, hiY, hoX, hoY, ...rest } = n;
      void hiX; void hiY; void hoX; void hoY;
      return rest;
    }
    // make smooth: tangent along neighbours
    const prev = path.nodes[(i - 1 + path.nodes.length) % path.nodes.length];
    const next = path.nodes[(i + 1) % path.nodes.length];
    const tx = (next.x - prev.x) / 4;
    const ty = (next.y - prev.y) / 4;
    return { ...n, hiX: -tx, hiY: -ty, hoX: tx, hoY: ty };
  });
  return { nodes };
}
