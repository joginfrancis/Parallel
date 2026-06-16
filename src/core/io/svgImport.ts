import { type Shape, type PathNode, newId } from '../geometry/shapes';

/**
 * Parse an SVG string into editable document shapes (mm). Supports the elements
 * the editor produces plus the common cases from other tools:
 *   rect, circle, ellipse, line, polyline, polygon, path.
 * Path data supports M/L/H/V/C/S/Q/T/A/Z (absolute + relative). A single
 * `M … A` subpath round-trips back to an ArcShape; other arcs are sampled.
 *
 * Limitations: element transforms other than rect `rotate(...)` are ignored;
 * styling is dropped (geometry only). Returns [] on parse failure.
 */
export function svgToShapes(svg: string): Shape[] {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  } catch {
    return [];
  }
  if (doc.querySelector('parsererror')) return [];
  const root = doc.querySelector('svg');
  if (!root) return [];

  const out: Shape[] = [];
  const els = root.querySelectorAll('rect, circle, ellipse, line, polyline, polygon, path, text, image');
  els.forEach((el) => {
    for (const s of elementToShapes(el)) out.push(s);
  });
  return out;
}

const num = (el: Element, name: string, def = 0) => {
  const v = el.getAttribute(name);
  if (v == null) return def;
  const n = parseFloat(v);
  return isFinite(n) ? n : def;
};

function rotateFromTransform(el: Element): number {
  const t = el.getAttribute('transform');
  if (!t) return 0;
  const m = /rotate\(\s*([-\d.]+)/.exec(t);
  return m ? parseFloat(m[1]) : 0;
}

function elementToShapes(el: Element): Shape[] {
  switch (el.tagName.toLowerCase()) {
    case 'rect':
      return [{
        id: newId(), type: 'rectangle',
        x: num(el, 'x'), y: num(el, 'y'),
        width: num(el, 'width'), height: num(el, 'height'),
        cornerRadius: num(el, 'rx', num(el, 'ry', 0)),
        rotation: rotateFromTransform(el),
      }];
    case 'circle':
      return [{ id: newId(), type: 'circle', cx: num(el, 'cx'), cy: num(el, 'cy'), r: num(el, 'r') }];
    case 'ellipse':
      // Approximate an ellipse as a circle of the average radius.
      return [{
        id: newId(), type: 'circle',
        cx: num(el, 'cx'), cy: num(el, 'cy'),
        r: (num(el, 'rx') + num(el, 'ry')) / 2,
      }];
    case 'line':
      return [{
        id: newId(), type: 'line',
        x1: num(el, 'x1'), y1: num(el, 'y1'), x2: num(el, 'x2'), y2: num(el, 'y2'),
      }];
    case 'polyline':
    case 'polygon': {
      const pts = parsePoints(el.getAttribute('points') || '');
      if (pts.length < 2) return [];
      return [{
        id: newId(), type: 'path',
        nodes: pts.map((p) => ({ x: p.x, y: p.y })),
        closed: el.tagName.toLowerCase() === 'polygon',
      }];
    }
    case 'image': {
      const href = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
      if (!href) return [];
      const op = el.getAttribute('opacity') || getStyle(el, 'opacity');
      return [{
        id: newId(), type: 'image',
        x: num(el, 'x'), y: num(el, 'y'),
        width: num(el, 'width'), height: num(el, 'height'),
        href,
        opacity: op ? parseFloat(op) : 1,
        rotation: rotateFromTransform(el),
      }];
    }
    case 'path':
      return parsePathData(el.getAttribute('d') || '');
    case 'text': {
      const content = (el.textContent ?? '').trim();
      if (!content) return [];
      const fontSize = num(el, 'font-size', parseFloat(getStyle(el, 'font-size')) || 16);
      const anchor = el.getAttribute('text-anchor') || getStyle(el, 'text-anchor') || 'start';
      const align = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left';
      const bold = /bold|[6-9]00/.test((el.getAttribute('font-weight') || getStyle(el, 'font-weight') || ''));
      const fill = el.getAttribute('fill') || getStyle(el, 'fill') || '#1d1d1f';
      const ax = num(el, 'x'), ay = num(el, 'y');
      // SVG text x,y is the anchor on the baseline; convert to our box top-left.
      const w = Math.max(fontSize * 0.6, content.length * fontSize * (bold ? 0.62 : 0.55));
      const x = align === 'center' ? ax - w / 2 : align === 'right' ? ax - w : ax;
      const y = ay - fontSize * 0.8;
      return [{
        id: newId(), type: 'text', x, y, text: content, fontSize,
        bold, align, color: fill === 'none' ? '#1d1d1f' : fill,
        rotation: rotateFromTransform(el),
      }];
    }
    default:
      return [];
  }
}

function getStyle(el: Element, prop: string): string {
  const style = el.getAttribute('style');
  if (!style) return '';
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(style);
  return m ? m[1].trim() : '';
}

function parsePoints(s: string): { x: number; y: number }[] {
  const nums = (s.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  return pts;
}

// --- Path data parsing -----------------------------------------------------

interface Cmd { code: string; args: number[]; }

function tokenizePath(d: string): Cmd[] {
  const cmds: Cmd[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi;
  let m: RegExpExecArray | null;
  let cur: Cmd | null = null;
  while ((m = re.exec(d))) {
    if (m[1]) {
      cur = { code: m[1], args: [] };
      cmds.push(cur);
    } else if (cur) {
      cur.args.push(parseFloat(m[2]));
    }
  }
  return cmds;
}

/** Each subpath (M…) becomes its own shape: an ArcShape for a lone arc, else a path. */
function parsePathData(d: string): Shape[] {
  const cmds = tokenizePath(d);
  const shapes: Shape[] = [];

  let nodes: PathNode[] = [];
  let closed = false;
  let cx = 0, cy = 0;            // current point
  let startX = 0, startY = 0;   // subpath start
  let prevCtrl: { x: number; y: number } | null = null; // for S/T reflection
  // Track if a subpath is exactly one arc so we can emit an ArcShape.
  let arcOnly: { from: { x: number; y: number }; to: { x: number; y: number }; through: { x: number; y: number } } | null = null;
  let segmentCount = 0;

  const flush = () => {
    if (arcOnly && segmentCount === 1) {
      shapes.push({ id: newId(), type: 'arc', from: arcOnly.from, through: arcOnly.through, to: arcOnly.to });
    } else if (nodes.length >= 2) {
      shapes.push({ id: newId(), type: 'path', nodes, closed });
    }
    nodes = []; closed = false; arcOnly = null; segmentCount = 0; prevCtrl = null;
  };

  for (const { code, args } of cmds) {
    const rel = code === code.toLowerCase();
    const C = code.toUpperCase();

    if (C === 'M') {
      flush();
      for (let i = 0; i + 1 < args.length; i += 2) {
        let x = args[i], y = args[i + 1];
        if (rel) { x += cx; y += cy; }
        if (i === 0) { cx = x; cy = y; startX = x; startY = y; nodes.push({ x, y }); }
        else { cx = x; cy = y; nodes.push({ x, y }); segmentCount++; } // extra coords = implicit L
      }
      prevCtrl = null;
    } else if (C === 'L') {
      for (let i = 0; i + 1 < args.length; i += 2) {
        let x = args[i], y = args[i + 1];
        if (rel) { x += cx; y += cy; }
        nodes.push({ x, y }); cx = x; cy = y; segmentCount++;
      }
      prevCtrl = null;
    } else if (C === 'H') {
      for (const a of args) { let x = rel ? cx + a : a; nodes.push({ x, y: cy }); cx = x; segmentCount++; }
      prevCtrl = null;
    } else if (C === 'V') {
      for (const a of args) { let y = rel ? cy + a : a; nodes.push({ x: cx, y }); cy = y; segmentCount++; }
      prevCtrl = null;
    } else if (C === 'C') {
      for (let i = 0; i + 5 < args.length; i += 6) {
        let c1x = args[i], c1y = args[i + 1], c2x = args[i + 2], c2y = args[i + 3], x = args[i + 4], y = args[i + 5];
        if (rel) { c1x += cx; c1y += cy; c2x += cx; c2y += cy; x += cx; y += cy; }
        cubic(nodes, cx, cy, c1x, c1y, c2x, c2y, x, y);
        prevCtrl = { x: c2x, y: c2y };
        cx = x; cy = y; segmentCount++;
      }
    } else if (C === 'S') {
      for (let i = 0; i + 3 < args.length; i += 4) {
        let c2x = args[i], c2y = args[i + 1], x = args[i + 2], y = args[i + 3];
        if (rel) { c2x += cx; c2y += cy; x += cx; y += cy; }
        const c1 = prevCtrl ? { x: 2 * cx - prevCtrl.x, y: 2 * cy - prevCtrl.y } : { x: cx, y: cy };
        cubic(nodes, cx, cy, c1.x, c1.y, c2x, c2y, x, y);
        prevCtrl = { x: c2x, y: c2y };
        cx = x; cy = y; segmentCount++;
      }
    } else if (C === 'Q') {
      for (let i = 0; i + 3 < args.length; i += 4) {
        let qx = args[i], qy = args[i + 1], x = args[i + 2], y = args[i + 3];
        if (rel) { qx += cx; qy += cy; x += cx; y += cy; }
        quadToCubic(nodes, cx, cy, qx, qy, x, y);
        prevCtrl = { x: qx, y: qy };
        cx = x; cy = y; segmentCount++;
      }
    } else if (C === 'T') {
      for (let i = 0; i + 1 < args.length; i += 2) {
        let x = args[i], y = args[i + 1];
        if (rel) { x += cx; y += cy; }
        const q: { x: number; y: number } = prevCtrl ? { x: 2 * cx - prevCtrl.x, y: 2 * cy - prevCtrl.y } : { x: cx, y: cy };
        quadToCubic(nodes, cx, cy, q.x, q.y, x, y);
        prevCtrl = q;
        cx = x; cy = y; segmentCount++;
      }
    } else if (C === 'A') {
      for (let i = 0; i + 6 < args.length; i += 7) {
        const rx = args[i], ry = args[i + 1], rot = args[i + 2], large = args[i + 3], sweep = args[i + 4];
        let x = args[i + 5], y = args[i + 6];
        if (rel) { x += cx; y += cy; }
        const arc = arcToCenter(cx, cy, x, y, rx, ry, rot, large, sweep);
        if (arc) {
          // Remember a lone arc so the subpath can become an ArcShape.
          if (segmentCount === 0 && nodes.length === 1) {
            arcOnly = { from: { x: cx, y: cy }, to: { x, y }, through: arc.mid };
          }
          sampleArc(nodes, arc);
        } else {
          nodes.push({ x, y });
        }
        cx = x; cy = y; segmentCount++;
      }
      prevCtrl = null;
    } else if (C === 'Z') {
      closed = true;
      cx = startX; cy = startY;
      prevCtrl = null;
    }
  }
  flush();
  return shapes;
}

/** Append a cubic segment: set out-handle on the last node, push the end node with its in-handle. */
function cubic(nodes: PathNode[], _ax: number, _ay: number, c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
  const a = nodes[nodes.length - 1];
  if (a) { a.hoX = c1x - a.x; a.hoY = c1y - a.y; }
  nodes.push({ x, y, hiX: c2x - x, hiY: c2y - y });
}

function quadToCubic(nodes: PathNode[], ax: number, ay: number, qx: number, qy: number, x: number, y: number) {
  // Elevate quadratic (ax,ay)-(qx,qy)-(x,y) to cubic control points.
  const c1x = ax + (2 / 3) * (qx - ax), c1y = ay + (2 / 3) * (qy - ay);
  const c2x = x + (2 / 3) * (qx - x), c2y = y + (2 / 3) * (qy - y);
  cubic(nodes, ax, ay, c1x, c1y, c2x, c2y, x, y);
}

interface ArcCenter { cx: number; cy: number; rx: number; ry: number; phi: number; theta1: number; delta: number; mid: { x: number; y: number }; }

/** SVG endpoint → center arc parameterization (spec F.6.5). */
function arcToCenter(x1: number, y1: number, x2: number, y2: number, rx: number, ry: number, rotDeg: number, large: number, sweep: number): ArcCenter | null {
  if (rx === 0 || ry === 0) return null;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (rotDeg * Math.PI) / 180;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;

  let rxs = rx * rx, rys = ry * ry;
  const x1ps = x1p * x1p, y1ps = y1p * y1p;
  const lambda = x1ps / rxs + y1ps / rys;
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s; rxs = rx * rx; rys = ry * ry; }

  let denom = rxs * y1ps + rys * x1ps;
  let factor = Math.sqrt(Math.max(0, (rxs * rys - denom) / denom));
  if (large === sweep) factor = -factor;
  const cxp = factor * (rx * y1p) / ry;
  const cyp = factor * -(ry * x1p) / rx;

  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;

  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1;
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (sweep === 0 && delta > 0) delta -= 2 * Math.PI;
  if (sweep === 1 && delta < 0) delta += 2 * Math.PI;

  const midA = theta1 + delta / 2;
  const mx = cx + rx * Math.cos(midA) * cosP - ry * Math.sin(midA) * sinP;
  const my = cy + rx * Math.cos(midA) * sinP + ry * Math.sin(midA) * cosP;

  return { cx, cy, rx, ry, phi, theta1, delta, mid: { x: mx, y: my } };
}

/** Sample an arc into corner nodes (good enough for editing; arcs that round-trip as ArcShape skip this). */
function sampleArc(nodes: PathNode[], a: ArcCenter) {
  const steps = Math.max(2, Math.ceil(Math.abs(a.delta) / (Math.PI / 8)));
  const cosP = Math.cos(a.phi), sinP = Math.sin(a.phi);
  for (let i = 1; i <= steps; i++) {
    const t = a.theta1 + (a.delta * i) / steps;
    const x = a.cx + a.rx * Math.cos(t) * cosP - a.ry * Math.sin(t) * sinP;
    const y = a.cy + a.rx * Math.cos(t) * sinP + a.ry * Math.sin(t) * cosP;
    nodes.push({ x, y });
  }
}
