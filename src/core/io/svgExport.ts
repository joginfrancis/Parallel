import { type Shape } from '../geometry/shapes';
import { boundsOf } from '../geometry/transform';

/**
 * Serialize the document to a standalone SVG string. Coordinates are in mm
 * (the document unit); the SVG `viewBox` is unitless mm and width/height carry
 * the `mm` unit so the file prints / cuts at true size.
 *
 * Output is plain black outline (stroke, no fill) — the conventional form for
 * laser-cutting and printing, and the cleanest thing to re-import.
 */
export interface ExportOpts {
  /** Padding (mm) around the geometry. Default 5. */
  padding?: number;
  /** Stroke width in mm. Default 0.5. */
  strokeWidth?: number;
  /** Stroke color. Default '#1d1d1f'. */
  stroke?: string;
}

const fmt = (n: number) => {
  // Trim to 3 decimals, drop trailing zeros.
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

export function shapesToSvg(shapes: Shape[], opts: ExportOpts = {}): string {
  const pad = opts.padding ?? 5;
  const sw = opts.strokeWidth ?? 0.5;
  const stroke = opts.stroke ?? '#1d1d1f';

  // Overall bounds (fall back to a unit box for an empty document).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) {
    const b = boundsOf(s);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 100; maxY = 100; }

  const vbX = minX - pad, vbY = minY - pad;
  const vbW = (maxX - minX) + pad * 2, vbH = (maxY - minY) + pad * 2;

  const body = shapes.map((s) => shapeToSvgEl(s)).filter(Boolean).join('\n  ');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${fmt(vbW)}mm" height="${fmt(vbH)}mm" ` +
    `viewBox="${fmt(vbX)} ${fmt(vbY)} ${fmt(vbW)} ${fmt(vbH)}">\n` +
    `  <g fill="none" stroke="${stroke}" stroke-width="${fmt(sw)}" ` +
    `stroke-linecap="round" stroke-linejoin="round">\n  ${body}\n  </g>\n</svg>\n`
  );
}

function shapeToSvgEl(s: Shape): string {
  switch (s.type) {
    case 'rectangle': {
      const rx = s.cornerRadius ? ` rx="${fmt(s.cornerRadius)}"` : '';
      const tr = s.rotation
        ? ` transform="rotate(${fmt(s.rotation)} ${fmt(s.x + s.width / 2)} ${fmt(s.y + s.height / 2)})"`
        : '';
      return `<rect x="${fmt(s.x)}" y="${fmt(s.y)}" width="${fmt(s.width)}" height="${fmt(s.height)}"${rx}${tr} />`;
    }
    case 'circle':
      return `<circle cx="${fmt(s.cx)}" cy="${fmt(s.cy)}" r="${fmt(s.r)}" />`;
    case 'line':
      return `<line x1="${fmt(s.x1)}" y1="${fmt(s.y1)}" x2="${fmt(s.x2)}" y2="${fmt(s.y2)}" />`;
    case 'arc':
      return `<path d="${arcToD(s)}" />`;
    case 'path':
      return `<path d="${pathToD(s)}" />`;
    case 'image': {
      const tr = s.rotation
        ? ` transform="rotate(${fmt(s.rotation)} ${fmt(s.x + s.width / 2)} ${fmt(s.y + s.height / 2)})"`
        : '';
      const op = s.opacity != null && s.opacity < 1 ? ` opacity="${fmt(s.opacity)}"` : '';
      return (
        `<image x="${fmt(s.x)}" y="${fmt(s.y)}" width="${fmt(s.width)}" height="${fmt(s.height)}"` +
        `${op}${tr} href="${s.href}" />`
      );
    }
    case 'text': {
      const align = s.align ?? 'left';
      const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
      // SVG text x is the anchor point; baseline at y + ~0.8em (matches renderer).
      const w = Math.max(s.fontSize * 0.6, (s.text.length || 1) * s.fontSize * (s.bold ? 0.62 : 0.55));
      const tx = align === 'center' ? s.x + w / 2 : align === 'right' ? s.x + w : s.x;
      const ty = s.y + s.fontSize * 0.8;
      const tr = s.rotation
        ? ` transform="rotate(${fmt(s.rotation)} ${fmt(s.x + w / 2)} ${fmt(s.y + s.fontSize * 0.6)})"`
        : '';
      const weight = s.bold ? ' font-weight="bold"' : '';
      const fill = s.color ?? '#1d1d1f';
      return (
        `<text x="${fmt(tx)}" y="${fmt(ty)}" font-size="${fmt(s.fontSize)}" ` +
        `text-anchor="${anchor}"${weight} fill="${fill}" stroke="none"${tr}>` +
        `${escapeXml(s.text)}</text>`
      );
    }
  }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (ch) =>
    ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch === '"' ? '&quot;' : '&apos;'
  );
}

/** Three-point arc → SVG `A` command (computes the circumcircle). */
function arcToD(s: Extract<Shape, { type: 'arc' }>): string {
  const { from, through, to } = s;
  const d =
    2 * (from.x * (through.y - to.y) + through.x * (to.y - from.y) + to.x * (from.y - through.y));
  if (Math.abs(d) < 1e-9) {
    // Collinear — just a line.
    return `M${fmt(from.x)},${fmt(from.y)} L${fmt(to.x)},${fmt(to.y)}`;
  }
  const f2 = from.x * from.x + from.y * from.y;
  const t2 = through.x * through.x + through.y * through.y;
  const o2 = to.x * to.x + to.y * to.y;
  const ux = (f2 * (through.y - to.y) + t2 * (to.y - from.y) + o2 * (from.y - through.y)) / d;
  const uy = (f2 * (to.x - through.x) + t2 * (from.x - to.x) + o2 * (through.x - from.x)) / d;
  const r = Math.hypot(from.x - ux, from.y - uy);

  // Determine sweep + large-arc from the angles so the arc passes through
  // `through` (SVG-spec angle convention — matches the importer's F.6.5 math).
  const TAU = 2 * Math.PI;
  const norm = (v: number) => ((v % TAU) + TAU) % TAU;
  const a0 = Math.atan2(from.y - uy, from.x - ux);
  const aT = Math.atan2(through.y - uy, through.x - ux);
  const a2 = Math.atan2(to.y - uy, to.x - ux);
  const dT = norm(aT - a0);
  const d2 = norm(a2 - a0);
  let sweep: number, large: number;
  if (dT < d2) {
    // Positive (increasing-angle) direction passes through `through`.
    sweep = 1;
    large = d2 > Math.PI ? 1 : 0;
  } else {
    sweep = 0;
    large = TAU - d2 > Math.PI ? 1 : 0;
  }

  return `M${fmt(from.x)},${fmt(from.y)} A${fmt(r)} ${fmt(r)} 0 ${large} ${sweep} ${fmt(to.x)},${fmt(to.y)}`;
}

/** Path nodes (with optional bezier handles) → SVG path `d`. */
function pathToD(s: Extract<Shape, { type: 'path' }>): string {
  const n = s.nodes;
  if (n.length === 0) return '';
  let d = `M${fmt(n[0].x)},${fmt(n[0].y)}`;
  const seg = (i: number, j: number) => {
    const a = n[i], b = n[j];
    const aHasOut = a.hoX != null;
    const bHasIn = b.hiX != null;
    if (!aHasOut && !bHasIn) {
      return ` L${fmt(b.x)},${fmt(b.y)}`;
    }
    const c1x = a.x + (a.hoX ?? 0), c1y = a.y + (a.hoY ?? 0);
    const c2x = b.x + (b.hiX ?? 0), c2y = b.y + (b.hiY ?? 0);
    return ` C${fmt(c1x)},${fmt(c1y)} ${fmt(c2x)},${fmt(c2y)} ${fmt(b.x)},${fmt(b.y)}`;
  };
  for (let i = 1; i < n.length; i++) d += seg(i - 1, i);
  if (s.closed) {
    if (n.length > 1) d += seg(n.length - 1, 0);
    d += ' Z';
  }
  return d;
}

/** Trigger a browser download of the given SVG text. */
export function downloadSvg(svg: string, filename = 'sketch.svg') {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
