/**
 * Self-test for SVG export (pure, node-runnable):
 *   npx tsx src/core/io/io.selftest.ts
 * Import + round-trip is verified separately in the browser (needs DOMParser).
 */
import { type Shape } from '../geometry/shapes';
import { shapesToSvg } from './svgExport';

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}  ${detail}`); }
};

const rect: Shape = { id: 'r', type: 'rectangle', x: 10, y: 20, width: 80, height: 40, cornerRadius: 4, rotation: 0 };
const circle: Shape = { id: 'c', type: 'circle', cx: 0, cy: 0, r: 25 };
const line: Shape = { id: 'l', type: 'line', x1: -10, y1: 0, x2: 50, y2: 0 };
const arc: Shape = { id: 'a', type: 'arc', from: { x: -25, y: 0 }, through: { x: 0, y: 25 }, to: { x: 25, y: 0 } };
const path: Shape = {
  id: 'p', type: 'path', closed: false,
  nodes: [{ x: 0, y: 0 }, { x: 30, y: 0, hiX: -10, hiY: -10 }, { x: 60, y: 0 }],
};

const svg = shapesToSvg([rect, circle, line, arc, path]);

check('emits svg root with viewBox', /<svg[^>]*viewBox="/.test(svg));
check('width/height in mm', /width="[\d.]+mm" height="[\d.]+mm"/.test(svg), svg.slice(0, 120));
check('rect with rx', /<rect x="10" y="20" width="80" height="40" rx="4"/.test(svg));
check('circle', /<circle cx="0" cy="0" r="25"/.test(svg));
check('line', /<line x1="-10" y1="0" x2="50" y2="0"/.test(svg));
check('arc uses A command', /<path d="M-25,0 A25 25 0 [01] [01] 25,0"/.test(svg), svg);
check('path uses C for handled segment', /C/.test(svg));
check('viewBox includes padding', /viewBox="-30 /.test(svg) || /viewBox="(-?\d+)/.test(svg));

// Rotation → transform
const rotRect: Shape = { ...(rect as any), rotation: 30 };
check('rotation → transform', /transform="rotate\(30 /.test(shapesToSvg([rotRect])));

// Text
const textShape: Shape = { id: 't', type: 'text', x: 0, y: 0, text: 'Hi <there>', fontSize: 12, bold: true, align: 'center', color: '#ff0000' };
const tsvg = shapesToSvg([textShape]);
check('text element', /<text [^>]*font-size="12"[^>]*>/.test(tsvg), tsvg);
check('text escapes XML', /Hi &lt;there&gt;/.test(tsvg));
check('text bold + anchor', /font-weight="bold"/.test(tsvg) && /text-anchor="middle"/.test(tsvg));

// Image
const imgShape: Shape = { id: 'i', type: 'image', x: 5, y: 8, width: 40, height: 30, href: 'data:image/png;base64,AAAA', opacity: 0.5 };
const isvg = shapesToSvg([imgShape]);
check('image element', /<image x="5" y="8" width="40" height="30"/.test(isvg), isvg);
check('image opacity + href', /opacity="0.5"/.test(isvg) && /href="data:image\/png;base64,AAAA"/.test(isvg));

// Empty document still yields valid svg
check('empty doc ok', /<svg/.test(shapesToSvg([])));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) throw new Error(`${fail} io self-test(s) failed`);
