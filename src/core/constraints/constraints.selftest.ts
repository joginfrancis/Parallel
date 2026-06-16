/**
 * Standalone self-test for the constraint engine. Run with:
 *   npx tsx src/core/constraints/constraints.selftest.ts
 *
 * Validates detection, the Gauss-Newton solver, and locking with known inputs —
 * no canvas or React required. Pure functions in / asserts out.
 */
import { type Shape } from '../geometry/shapes';
import { detectConstraints } from './detect';
import { solve } from './solver';
import { type Constraint, newConstraintId } from './model';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}  ${detail}`); }
}

// --- 1. Detection: a near-horizontal line should yield a horizontal constraint
{
  const line: Shape = { id: 'L1', type: 'line', x1: 0, y1: 0, x2: 100, y2: 0.5 };
  const cands = detectConstraints('L1', [line], []);
  check('detects horizontal', cands.some((c) => c.constraint.type === 'horizontal'),
    JSON.stringify(cands.map((c) => c.constraint.type)));
}

// --- 2. Detection: coincident endpoints
{
  const a: Shape = { id: 'A', type: 'line', x1: 0, y1: 0, x2: 50, y2: 50 };
  const b: Shape = { id: 'B', type: 'line', x1: 50.05, y1: 50.05, x2: 100, y2: 0 };
  const cands = detectConstraints('B', [a, b], []);
  check('detects coincident', cands.some((c) => c.constraint.type === 'coincident'));
}

// --- 3. Detection: parallel lines
{
  const a: Shape = { id: 'A', type: 'line', x1: 0, y1: 0, x2: 100, y2: 20 };
  const b: Shape = { id: 'B', type: 'line', x1: 0, y1: 50, x2: 100, y2: 70.2 };
  const cands = detectConstraints('B', [a, b], []);
  check('detects parallel', cands.some((c) => c.constraint.type === 'parallel'));
}

// --- 4. Solver: horizontal constraint flattens a tilted line
{
  const line: Shape = { id: 'L1', type: 'line', x1: 0, y1: 0, x2: 100, y2: 8 };
  const c: Constraint = { id: 'c1', type: 'horizontal', line: 'L1' };
  const { shapes } = solve([line], [c]);
  const out = shapes[0] as Extract<Shape, { type: 'line' }>;
  check('solver makes line horizontal', Math.abs(out.y2 - out.y1) < 1e-3,
    `y1=${out.y1} y2=${out.y2}`);
}

// --- 5. Solver: coincident pulls two endpoints together
{
  const a: Shape = { id: 'A', type: 'line', x1: 0, y1: 0, x2: 50, y2: 50 };
  const b: Shape = { id: 'B', type: 'line', x1: 60, y1: 40, x2: 100, y2: 0 };
  const c: Constraint = {
    id: 'c1', type: 'coincident',
    a: { shape: 'A', key: 'p1' }, b: { shape: 'B', key: 'p0' },
  };
  const { shapes } = solve([a, b], [c]);
  const oa = shapes[0] as Extract<Shape, { type: 'line' }>;
  const ob = shapes[1] as Extract<Shape, { type: 'line' }>;
  const d = Math.hypot(oa.x2 - ob.x1, oa.y2 - ob.y1);
  check('solver joins coincident points', d < 1e-3, `gap=${d}`);
}

// --- 6. Connectivity: dragging A's endpoint drags B's coincident endpoint
{
  const a: Shape = { id: 'A', type: 'line', x1: 0, y1: 0, x2: 50, y2: 50 };
  const b: Shape = { id: 'B', type: 'line', x1: 50, y1: 50, x2: 100, y2: 0 };
  const c: Constraint = {
    id: 'c1', type: 'coincident',
    a: { shape: 'A', key: 'p1' }, b: { shape: 'B', key: 'p0' },
  };
  // Pin A's p1 to a new cursor position
  const pinned = new Map([['A:p1', { x: 70, y: 70 }]]);
  const { shapes } = solve([a, b], [c], pinned);
  const ob = shapes[1] as Extract<Shape, { type: 'line' }>;
  const d = Math.hypot(ob.x1 - 70, ob.y1 - 70);
  check('coincident neighbor follows drag', d < 1e-3, `B.p0=(${ob.x1},${ob.y1})`);
}

// --- 7. Lock: a fully-locked line snaps back after a move
{
  const line: Shape = { id: 'L1', type: 'line', x1: 10, y1: 10, x2: 60, y2: 10 };
  const locks: Constraint[] = [
    { id: newConstraintId(), type: 'fixed', ref: { shape: 'L1', key: 'p0' }, pos: { x: 10, y: 10 } },
    { id: newConstraintId(), type: 'fixed', ref: { shape: 'L1', key: 'p1' }, pos: { x: 60, y: 10 } },
  ];
  // Simulate a drag that moved the line by (25, 25)
  const moved: Shape = { ...line, x1: 35, y1: 35, x2: 85, y2: 35 };
  const { shapes } = solve([moved], locks);
  const out = shapes[0] as Extract<Shape, { type: 'line' }>;
  const back = Math.abs(out.x1 - 10) + Math.abs(out.y1 - 10) + Math.abs(out.x2 - 60) + Math.abs(out.y2 - 10);
  check('locked line snaps back after move', back < 1e-3,
    `(${out.x1},${out.y1})-(${out.x2},${out.y2})`);
}

// --- 8. Detection: tangent line ↔ circle
{
  const circle: Shape = { id: 'C', type: 'circle', cx: 0, cy: 0, r: 25 };
  // Horizontal line at y = 25.2 (just touching, within tolerance)
  const line: Shape = { id: 'L', type: 'line', x1: -40, y1: 25.2, x2: 40, y2: 25.2 };
  const cands = detectConstraints('L', [circle, line], []);
  check('detects tangent', cands.some((c) => c.constraint.type === 'tangent'),
    JSON.stringify(cands.map((c) => c.constraint.type)));
}

// --- 9. Solver: tangent pulls line to touch the circle exactly (circle pinned)
{
  const circle: Shape = { id: 'C', type: 'circle', cx: 0, cy: 0, r: 25 };
  const line: Shape = { id: 'L', type: 'line', x1: -40, y1: 22, x2: 40, y2: 22 };
  const cs: Constraint[] = [
    { id: 'c1', type: 'tangent', line: 'L', circle: 'C' },
    { id: 'c2', type: 'fixed', ref: { shape: 'C', key: 'center' }, pos: { x: 0, y: 0 } },
  ];
  const { shapes } = solve([circle, line], cs);
  const out = shapes[1] as Extract<Shape, { type: 'line' }>;
  const dx = out.x2 - out.x1, dy = out.y2 - out.y1;
  const len = Math.hypot(dx, dy);
  const dist = Math.abs((0 - out.x1) * dy - (0 - out.y1) * dx) / len;
  check('solver makes line tangent', Math.abs(dist - 25) < 1e-2, `dist=${dist.toFixed(3)}`);
}

// --- 10. Detection: collinear (parallel + zero offset prefers collinear)
{
  const a: Shape = { id: 'A', type: 'line', x1: 0, y1: 0, x2: 50, y2: 0 };
  const b: Shape = { id: 'B', type: 'line', x1: 60, y1: 0.2, x2: 100, y2: 0.2 };
  const cands = detectConstraints('B', [a, b], []);
  check('detects collinear (not parallel)',
    cands.some((c) => c.constraint.type === 'collinear') &&
    !cands.some((c) => c.constraint.type === 'parallel'),
    JSON.stringify(cands.map((c) => c.constraint.type)));
}

// --- 11. Solver: collinear aligns lineB onto lineA's infinite line (A pinned)
{
  const a: Shape = { id: 'A', type: 'line', x1: 0, y1: 0, x2: 50, y2: 0 };
  const b: Shape = { id: 'B', type: 'line', x1: 60, y1: 6, x2: 100, y2: 4 };
  const cs: Constraint[] = [
    { id: 'c1', type: 'collinear', lineA: 'A', lineB: 'B' },
    { id: 'c2', type: 'fixed', ref: { shape: 'A', key: 'p0' }, pos: { x: 0, y: 0 } },
    { id: 'c3', type: 'fixed', ref: { shape: 'A', key: 'p1' }, pos: { x: 50, y: 0 } },
  ];
  const { shapes } = solve([a, b], cs);
  const ob = shapes[1] as Extract<Shape, { type: 'line' }>;
  check('solver makes lines collinear', Math.abs(ob.y1) < 1e-2 && Math.abs(ob.y2) < 1e-2,
    `B y=(${ob.y1.toFixed(3)}, ${ob.y2.toFixed(3)})`);
}

// --- 12. Detection: relative angle (45°) between two lines
{
  const a: Shape = { id: 'A', type: 'line', x1: 0, y1: 0, x2: 50, y2: 0 };
  // 45.3° line — within tolerance of 45
  const b: Shape = { id: 'B', type: 'line', x1: 0, y1: 0, x2: 50, y2: 50.5 };
  const cands = detectConstraints('B', [a, b], []);
  const angC = cands.find((c) => c.constraint.type === 'angle');
  check('detects 45° angle', !!angC && (angC.constraint as any).value === 45,
    JSON.stringify(cands.map((c) => c.constraint.type)));
}

// --- 13. Over-constrained: contradictory constraints don't converge
{
  // A line forced both horizontal AND vertical → impossible (unless zero-length).
  const line: Shape = { id: 'L', type: 'line', x1: 0, y1: 0, x2: 100, y2: 5 };
  const cs: Constraint[] = [
    { id: 'c1', type: 'horizontal', line: 'L' },
    { id: 'c2', type: 'vertical', line: 'L' },
    // pin p0 so the line can't collapse to a point to satisfy both
    { id: 'c3', type: 'fixed', ref: { shape: 'L', key: 'p0' }, pos: { x: 0, y: 0 } },
    { id: 'c4', type: 'distance', a: { shape: 'L', key: 'p0' }, b: { shape: 'L', key: 'p1' }, value: 100 },
  ];
  const { converged } = solve([line], cs);
  check('over-constrained reported as not converged', converged === false,
    `converged=${converged}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) throw new Error(`${fail} constraint self-test(s) failed`);
