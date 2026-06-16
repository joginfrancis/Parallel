import { type Shape, type Pt, type TextShape, estimateTextSize } from './shapes';

/**
 * Selection handles + resize/rotate math (UI_UX_SPEC §3.2, §4 scenarios 4–5).
 * All positions are in project (mm) coordinates. Handle hit-radius and the
 * rotate-handle offset are scaled by zoom so they stay constant on screen.
 */

export type HandleKind = 'resize' | 'rotate' | 'endpoint';
export interface Handle {
  key: string; // 'nw'|'n'|...|'rotate'|'p0'|'p1'
  kind: HandleKind;
  pos: Pt;
  cursor: string; // CSS cursor when hovering/dragging this handle
}

export const HANDLE_RADIUS_PX = 6; // 12px visual diameter
export const HANDLE_HIT_PX = 13; // ~24px hit target (radius)
const ROTATE_OFFSET_PX = 26;
const MIN_MM = 1;

const v = (x: number, y: number): Pt => ({ x, y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (a: Pt, s: number): Pt => ({ x: a.x * s, y: a.y * s });
const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y;

/** Local-frame unit axes for a rotation in degrees (screen y points down). */
function axes(rotDeg: number): { ux: Pt; uy: Pt } {
  const r = (rotDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { ux: v(c, s), uy: v(-s, c) };
}

const RECT_HANDLES: {
  key: string;
  fx: -1 | 0 | 1;
  fy: -1 | 0 | 1;
  cursor: string;
}[] = [
  { key: 'nw', fx: -1, fy: -1, cursor: 'nwse-resize' },
  { key: 'n', fx: 0, fy: -1, cursor: 'ns-resize' },
  { key: 'ne', fx: 1, fy: -1, cursor: 'nesw-resize' },
  { key: 'e', fx: 1, fy: 0, cursor: 'ew-resize' },
  { key: 'se', fx: 1, fy: 1, cursor: 'nwse-resize' },
  { key: 's', fx: 0, fy: 1, cursor: 'ns-resize' },
  { key: 'sw', fx: -1, fy: 1, cursor: 'nesw-resize' },
  { key: 'w', fx: -1, fy: 0, cursor: 'ew-resize' },
];

/** Anything with an axis-aligned (optionally rotated) box: rect + image. */
interface Box { x: number; y: number; width: number; height: number; rotation?: number }

function rectCenter(s: { x: number; y: number; width: number; height: number }): Pt {
  return v(s.x + s.width / 2, s.y + s.height / 2);
}

/** Selection handles for a box (8 resize + rotate). */
function boxHandles(s: Box, zoom: number): Handle[] {
  const c = rectCenter(s);
  const { ux, uy } = axes(s.rotation ?? 0);
  const hw = s.width / 2;
  const hh = s.height / 2;
  const handles: Handle[] = RECT_HANDLES.map((h) => ({
    key: h.key,
    kind: 'resize',
    pos: boxHandlePos(c, hw, hh, ux, uy, h.fx, h.fy),
    cursor: h.cursor,
  }));
  const nPos = boxHandlePos(c, hw, hh, ux, uy, 0, -1);
  handles.push({ key: 'rotate', kind: 'rotate', pos: add(nPos, scale(uy, -ROTATE_OFFSET_PX / zoom)), cursor: 'grab' });
  return handles;
}

/** Snap candidate points for a box: 4 corners + 4 edge-mids + center. */
function boxKeyPoints(s: Box): Pt[] {
  const c = rectCenter(s);
  const { ux, uy } = axes(s.rotation ?? 0);
  const hw = s.width / 2;
  const hh = s.height / 2;
  const f: [number, number][] = [
    [-1, -1], [1, -1], [1, 1], [-1, 1],
    [0, -1], [1, 0], [0, 1], [-1, 0], [0, 0],
  ];
  return f.map(([fx, fy]) => boxHandlePos(c, hw, hh, ux, uy, fx, fy));
}

/** Resize a box by dragging `key` to `p`; keeps the opposite handle anchored. */
function boxResize(s: Box, key: string, p: Pt): { x: number; y: number; width: number; height: number } {
  const { ux, uy } = axes(s.rotation ?? 0);
  const hf = RECT_HANDLES.find((h) => h.key === key)!;
  const c = rectCenter(s);
  const anchor = boxHandlePos(c, s.width / 2, s.height / 2, ux, uy, -hf.fx, -hf.fy);
  const d = sub(p, anchor);
  const du = dot(d, ux);
  const dv = dot(d, uy);
  let newW = s.width;
  let newH = s.height;
  let c2 = c;
  if (hf.fx !== 0 && hf.fy !== 0) {
    newW = Math.max(Math.abs(du), MIN_MM);
    newH = Math.max(Math.abs(dv), MIN_MM);
    const far = add(anchor, add(scale(ux, Math.sign(du) * newW), scale(uy, Math.sign(dv) * newH)));
    c2 = scale(add(anchor, far), 0.5);
  } else if (hf.fx !== 0) {
    newW = Math.max(Math.abs(du), MIN_MM);
    c2 = add(anchor, scale(ux, (Math.sign(du) * newW) / 2));
  } else {
    newH = Math.max(Math.abs(dv), MIN_MM);
    c2 = add(anchor, scale(uy, (Math.sign(dv) * newH) / 2));
  }
  return { x: c2.x - newW / 2, y: c2.y - newH / 2, width: newW, height: newH };
}

/** World position of a box handle given center, half-size, axes and factors. */
function boxHandlePos(c: Pt, hw: number, hh: number, ux: Pt, uy: Pt, fx: number, fy: number): Pt {
  return add(c, add(scale(ux, fx * hw), scale(uy, fy * hh)));
}

/** Center + half-extents of a text shape's box (mm). */
function textBox(s: TextShape): { c: Pt; hw: number; hh: number } {
  const { width, height } = estimateTextSize(s);
  return { c: v(s.x + width / 2, s.y + height / 2), hw: width / 2, hh: height / 2 };
}

/** Compute the on-screen handles for a single shape. `zoom` is px per mm. */
export function getHandles(s: Shape, zoom: number): Handle[] {
  switch (s.type) {
    case 'rectangle':
    case 'image':
      return boxHandles(s, zoom);
    case 'circle': {
      const c = v(s.cx, s.cy);
      const { ux, uy } = axes(0);
      return RECT_HANDLES.map((h) => ({
        key: h.key,
        kind: 'resize',
        pos: boxHandlePos(c, s.r, s.r, ux, uy, h.fx, h.fy),
        cursor: h.cursor,
      }));
    }
    case 'line':
      return [
        { key: 'p0', kind: 'endpoint', pos: v(s.x1, s.y1), cursor: 'move' },
        { key: 'p1', kind: 'endpoint', pos: v(s.x2, s.y2), cursor: 'move' },
      ];
    case 'arc':
      return [
        { key: 'p0', kind: 'endpoint', pos: { ...s.from }, cursor: 'move' },
        { key: 'p1', kind: 'endpoint', pos: { ...s.to }, cursor: 'move' },
      ];
    case 'path':
      return s.nodes.map((n, i) => ({
        key: `p${i}`,
        kind: 'endpoint' as const,
        pos: v(n.x, n.y),
        cursor: 'move',
      }));
    case 'text': {
      const { c, hw, hh } = textBox(s);
      const { ux, uy } = axes(s.rotation ?? 0);
      const handles: Handle[] = RECT_HANDLES.map((h) => ({
        key: h.key,
        kind: 'resize',
        pos: boxHandlePos(c, hw, hh, ux, uy, h.fx, h.fy),
        cursor: h.cursor,
      }));
      const nPos = boxHandlePos(c, hw, hh, ux, uy, 0, -1);
      handles.push({ key: 'rotate', kind: 'rotate', pos: add(nPos, scale(uy, -ROTATE_OFFSET_PX / zoom)), cursor: 'grab' });
      return handles;
    }
  }
}

/**
 * Detect a "rotate ring" hit just *outside* a rectangle's corner (Figma-style:
 * hover slightly beyond a corner → rotate). Returns a synthetic rotate handle.
 */
export function cornerRotateHit(s: Shape, p: Pt, zoom: number): Handle | null {
  if (s.type !== 'rectangle') return null;
  const c = rectCenter(s);
  const { ux, uy } = axes(s.rotation);
  const inner = HANDLE_HIT_PX / zoom;
  const outer = 26 / zoom;
  const dCenter = Math.hypot(p.x - c.x, p.y - c.y);
  for (const f of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as [number, number][]) {
    const corner = boxHandlePos(c, s.width / 2, s.height / 2, ux, uy, f[0], f[1]);
    const d = Math.hypot(p.x - corner.x, p.y - corner.y);
    const cornerFromCenter = Math.hypot(corner.x - c.x, corner.y - c.y);
    if (d > inner && d <= outer && dCenter > cornerFromCenter) {
      return { key: 'rotate', kind: 'rotate', pos: { ...p }, cursor: 'grab' };
    }
  }
  return null;
}

/** Find a handle under `p` within the hit radius (rotate/corners win ties). */
export function hitHandle(s: Shape, p: Pt, zoom: number): Handle | null {
  const tol = HANDLE_HIT_PX / zoom;
  let best: Handle | null = null;
  let bestD = tol;
  for (const h of getHandles(s, zoom)) {
    const d = Math.hypot(h.pos.x - p.x, h.pos.y - p.y);
    if (d <= bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}

/** Apply a resize drag of `handle` to point `p`. Returns a shape patch. */
export function applyResize(s: Shape, key: string, p: Pt): Partial<Shape> {
  if (s.type === 'rectangle' || s.type === 'image') {
    return boxResize(s, key, p);
  }

  if (s.type === 'circle') {
    const r = Math.max(Math.abs(p.x - s.cx), Math.abs(p.y - s.cy), MIN_MM / 2);
    return { r };
  }

  if (s.type === 'line') {
    return key === 'p0' ? { x1: p.x, y1: p.y } : { x2: p.x, y2: p.y };
  }

  if (s.type === 'arc') {
    return key === 'p0' ? { from: { ...p } } : { to: { ...p } };
  }

  if (s.type === 'path') {
    const i = Number(key.slice(1));
    const nodes = s.nodes.map((n, idx) =>
      idx === i ? { ...n, x: p.x, y: p.y } : n
    );
    return { nodes };
  }

  if (s.type === 'text') {
    // Corner/edge drag scales the font; box stays centered on its center.
    const { c, hh } = textBox(s);
    const ratio = Math.max(0.1, Math.abs(p.y - c.y) / hh);
    const fontSize = Math.max(2, s.fontSize * ratio);
    const next = estimateTextSize({ ...s, fontSize });
    return { fontSize, x: c.x - next.width / 2, y: c.y - next.height / 2 };
  }
  return {};
}

/** Rotate a rectangle/image/text box so its top points toward `p`. Degrees [0,360). */
export function applyRotate(s: Shape, p: Pt): Partial<Shape> {
  const c =
    s.type === 'rectangle' || s.type === 'image' ? rectCenter(s)
    : s.type === 'text' ? textBox(s).c
    : null;
  if (!c) return {};
  const phi = Math.atan2(p.y - c.y, p.x - c.x);
  let deg = (phi * 180) / Math.PI + 90;
  deg = ((deg % 360) + 360) % 360;
  return { rotation: deg };
}

/** Short human label for the selected shape's primary dimension(s). */
export function measureLabel(s: Shape): { text: string; at: Pt } | null {
  switch (s.type) {
    case 'rectangle':
      return {
        text: `${s.width.toFixed(0)} × ${s.height.toFixed(0)} mm`,
        at: v(s.x + s.width / 2, s.y + s.height),
      };
    case 'circle':
      return { text: `Ø ${(s.r * 2).toFixed(0)} mm`, at: v(s.cx, s.cy + s.r) };
    case 'line': {
      const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      let deg = (Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180) / Math.PI;
      deg = ((deg % 360) + 360) % 360;
      return {
        text: `${len.toFixed(0)} mm   ${deg.toFixed(0)}°`,
        at: v((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2),
      };
    }
    case 'arc': {
      const { r, len } = arcInfo(s.from, s.through, s.to);
      return { text: `R ${r.toFixed(0)} mm   ${len.toFixed(0)} mm`, at: { ...s.through } };
    }
    case 'path': {
      if (s.nodes.length < 2) return null;
      let len = 0;
      let cx = 0;
      let cy = 0;
      for (let i = 0; i < s.nodes.length; i++) {
        cx += s.nodes[i].x;
        cy += s.nodes[i].y;
        if (i > 0) {
          len += Math.hypot(
            s.nodes[i].x - s.nodes[i - 1].x,
            s.nodes[i].y - s.nodes[i - 1].y
          );
        }
      }
      return {
        text: `${len.toFixed(0)} mm`,
        at: v(cx / s.nodes.length, cy / s.nodes.length),
      };
    }
    default:
      return null;
  }
}

/** Length + angle of a segment from a→b, formatted for the live draw label. */
export function segmentLabel(a: Pt, b: Pt): string {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  let deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return `${len.toFixed(0)} mm   ${deg.toFixed(0)}°`;
}

/** Radius + arc length of the circular arc through from→through→to. */
export function arcInfo(from: Pt, through: Pt, to: Pt): { r: number; len: number } {
  const d =
    2 * (from.x * (through.y - to.y) + through.x * (to.y - from.y) + to.x * (from.y - through.y));
  if (Math.abs(d) < 1e-9) {
    return { r: 0, len: Math.hypot(to.x - from.x, to.y - from.y) };
  }
  const f2 = from.x * from.x + from.y * from.y;
  const t2 = through.x * through.x + through.y * through.y;
  const o2 = to.x * to.x + to.y * to.y;
  const ux = (f2 * (through.y - to.y) + t2 * (to.y - from.y) + o2 * (from.y - through.y)) / d;
  const uy = (f2 * (to.x - through.x) + t2 * (from.x - to.x) + o2 * (through.x - from.x)) / d;
  const r = Math.hypot(from.x - ux, from.y - uy);
  const a0 = Math.atan2(from.y - uy, from.x - ux);
  const a1 = Math.atan2(through.y - uy, through.x - ux);
  const a2 = Math.atan2(to.y - uy, to.x - ux);
  const TAU = Math.PI * 2;
  const norm = (x: number) => ((x % TAU) + TAU) % TAU;
  const d1 = norm(a1 - a0);
  const d2 = norm(a2 - a0);
  const sweep = d1 <= d2 ? d2 : d2 - TAU;
  return { r, len: Math.abs(sweep) * r };
}

/** Constrain b to the nearest 45° ray from a (Shift ortho mode), keeping length. */
export function constrainOrtho(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { ...b };
  const step = Math.PI / 4;
  const ang = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
}

/** Axis-aligned bounds of a shape (from its key points). */
export function boundsOf(s: Shape): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of keyPoints(s)) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/** Candidate snap points for a shape: corners/centers/mids/endpoints/nodes. */
export function keyPoints(s: Shape): Pt[] {
  switch (s.type) {
    case 'rectangle':
    case 'image':
      return boxKeyPoints(s);
    case 'circle':
      return [
        v(s.cx, s.cy),
        v(s.cx + s.r, s.cy),
        v(s.cx - s.r, s.cy),
        v(s.cx, s.cy + s.r),
        v(s.cx, s.cy - s.r),
      ];
    case 'line':
      return [v(s.x1, s.y1), v(s.x2, s.y2), v((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2)];
    case 'arc':
      return [{ ...s.from }, { ...s.to }, { ...s.through }];
    case 'path':
      return s.nodes.map((n) => v(n.x, n.y));
    case 'text': {
      const { c, hw, hh } = textBox(s);
      const { ux, uy } = axes(s.rotation ?? 0);
      const f: [number, number][] = [
        [-1, -1], [1, -1], [1, 1], [-1, 1],
        [0, -1], [1, 0], [0, 1], [-1, 0], [0, 0],
      ];
      return f.map(([fx, fy]) => boxHandlePos(c, hw, hh, ux, uy, fx, fy));
    }
  }
}
