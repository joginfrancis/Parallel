import { type Shape, type ShapeId } from '../geometry/shapes';
import {
  type Constraint,
  shapePointRefs,
  getPoint,
  setPointInShape,
} from './model';
import { type VarEntry, computeResiduals } from './residuals';

const MAX_ITER = 25;
const EPSILON = 1e-6;
const DAMPING = 1e-6; // Levenberg-Marquardt regularization

export interface SolveResult {
  shapes: Shape[];
  converged: boolean;
  maxResidual: number;
}

/**
 * Gauss-Newton solver. Finds point positions that satisfy all constraints,
 * starting from the current geometry. Fixed points and pinned points (the ones
 * the user is actively dragging) are excluded from the variable set.
 *
 * @param shapes     All document shapes
 * @param constraints Active constraints
 * @param pinned     Points pinned to specific positions (e.g. cursor during drag)
 */
export function solve(
  shapes: Shape[],
  constraints: Constraint[],
  pinned: Map<string, { x: number; y: number }> = new Map()
): SolveResult {
  if (constraints.length === 0) {
    return { shapes, converged: true, maxResidual: 0 };
  }

  // Fixed constraints pin their point to the stored locked position. Fold them
  // into the effective pin map (cursor pins win over locks if both target the
  // same point, since a live drag takes precedence).
  const pins = new Map<string, { x: number; y: number }>();
  for (const c of constraints) {
    if (c.type === 'fixed') pins.set(`${c.ref.shape}:${c.ref.key}`, { ...c.pos });
  }
  for (const [k, v] of pinned) pins.set(k, v);

  // Build the set of fixed point keys (locked + pinned) — excluded from vars.
  const fixedKeys = new Set<string>(pins.keys());

  // Collect all constrainable points that participate in at least one constraint
  const involvedShapes = new Set<ShapeId>();
  for (const c of constraints) {
    collectInvolved(c, involvedShapes);
  }

  // Build variable map: every free (non-fixed) point → (x_idx, y_idx)
  const varMap: VarEntry[] = [];
  const shapeMap = new Map<ShapeId, Shape>();
  for (const s of shapes) shapeMap.set(s.id, s);

  for (const s of shapes) {
    if (!involvedShapes.has(s.id)) continue;
    for (const { ref } of shapePointRefs(s)) {
      const key = `${ref.shape}:${ref.key}`;
      if (fixedKeys.has(key)) continue;
      varMap.push({ ref, axis: 'x', idx: varMap.length });
      varMap.push({ ref, axis: 'y', idx: varMap.length });
    }
  }

  // Apply pinned/locked positions up front (needed even with no free vars, so a
  // fully-locked shape snaps back to its locked position after a drag).
  let current = new Map(shapeMap);
  const applyPins = (m: Map<ShapeId, Shape>) => {
    for (const [key, pos] of pins) {
      const [shapeId, pointKey] = key.split(':');
      const s = m.get(shapeId);
      if (s) m.set(shapeId, setPointInShape(s, pointKey, pos));
    }
  };
  applyPins(current);

  if (varMap.length === 0) {
    const result = shapes.map((s) => current.get(s.id) ?? s);
    return { shapes: result, converged: true, maxResidual: 0 };
  }

  // Iterative solve
  let converged = false;
  let maxR = 0;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Collect residuals and Jacobian
    const allR: number[] = [];
    const allJ: number[][] = [];

    for (const c of constraints) {
      const { residuals, jacobianRows } = computeResiduals(c, current, varMap);
      for (let i = 0; i < residuals.length; i++) {
        allR.push(residuals[i]);
        allJ.push(jacobianRows[i]);
      }
    }

    if (allR.length === 0) {
      converged = true;
      break;
    }

    maxR = Math.max(...allR.map(Math.abs));
    if (maxR < EPSILON) {
      converged = true;
      break;
    }

    // Solve J^T J dx = -J^T r (normal equations with LM damping)
    const n = varMap.length;
    const JtJ = Array.from({ length: n }, () => new Float64Array(n));
    const Jtr = new Float64Array(n);

    for (let row = 0; row < allR.length; row++) {
      const jr = allJ[row];
      for (let i = 0; i < n; i++) {
        if (jr[i] === 0) continue;
        Jtr[i] += jr[i] * allR[row];
        for (let j = i; j < n; j++) {
          if (jr[j] === 0) continue;
          const v = jr[i] * jr[j];
          JtJ[i][j] += v;
          if (i !== j) JtJ[j][i] += v;
        }
      }
    }

    // Add damping to diagonal
    for (let i = 0; i < n; i++) {
      JtJ[i][i] += DAMPING;
    }

    // Solve via Cholesky or fallback to simple Gaussian elimination
    const dx = solveLinear(JtJ, Jtr, n);
    if (!dx) break; // singular

    // Update variables
    for (const entry of varMap) {
      const s = current.get(entry.ref.shape);
      if (!s) continue;
      const p = getPoint(s, entry.ref.key);
      if (!p) continue;
      const newP = { x: p.x, y: p.y };
      newP[entry.axis] -= dx[entry.idx];
      current.set(entry.ref.shape, setPointInShape(s, entry.ref.key, newP));
    }

    // Re-apply pinned/locked positions (they must not drift)
    applyPins(current);
  }

  // Build result shapes array preserving order
  const result = shapes.map((s) => current.get(s.id) ?? s);
  return { shapes: result, converged, maxResidual: maxR };
}

/** Gaussian elimination with partial pivoting. */
function solveLinear(A: Float64Array[], b: Float64Array, n: number): Float64Array | null {
  // Augmented matrix
  const M = Array.from({ length: n }, (_, i) => {
    const row = new Float64Array(n + 1);
    row.set(A[i]);
    row[n] = b[i];
    return row;
  });

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxVal = Math.abs(M[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(M[row][col]);
      if (v > maxVal) { maxVal = v; maxRow = row; }
    }
    if (maxVal < 1e-12) return null; // singular
    if (maxRow !== col) { const tmp = M[col]; M[col] = M[maxRow]; M[maxRow] = tmp; }

    // Eliminate below
    const pivot = M[col][col];
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / pivot;
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
    }
  }

  // Back-substitute
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    x[i] = sum / M[i][i];
  }
  return x;
}

function collectInvolved(c: Constraint, out: Set<ShapeId>) {
  switch (c.type) {
    case 'coincident': out.add(c.a.shape); out.add(c.b.shape); break;
    case 'horizontal': case 'vertical': out.add(c.line); break;
    case 'parallel': case 'perpendicular': out.add(c.lineA); out.add(c.lineB); break;
    case 'equal': out.add(c.shapeA); out.add(c.shapeB); break;
    case 'midpoint': out.add(c.point.shape); out.add(c.line); break;
    case 'concentric': out.add(c.circleA); out.add(c.circleB); break;
    case 'tangent': out.add(c.line); out.add(c.circle); break;
    case 'collinear': out.add(c.lineA); out.add(c.lineB); break;
    case 'distance': out.add(c.a.shape); out.add(c.b.shape); break;
    case 'angle': out.add(c.lineA); out.add(c.lineB); break;
    case 'fixed': out.add(c.ref.shape); break;
  }
}
