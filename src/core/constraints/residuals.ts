import { type Constraint, type PointRef, getPoint, lineDir, lineLength } from './model';
import { type Shape, type ShapeId } from '../geometry/shapes';

/**
 * Each constraint maps to one or more scalar residual equations.
 * When all residuals are zero, the constraint is perfectly satisfied.
 *
 * The VarMap tracks which (shapeId, pointKey, axis) maps to which index in the
 * variable vector so the Jacobian can record partial derivatives.
 */

export interface VarEntry {
  ref: PointRef;
  axis: 'x' | 'y';
  idx: number;
}

export type VarMap = VarEntry[];

function findVar(vm: VarMap, ref: PointRef, axis: 'x' | 'y'): number {
  for (const e of vm) {
    if (e.ref.shape === ref.shape && e.ref.key === ref.key && e.axis === axis) return e.idx;
  }
  return -1;
}

function pt(shapes: Map<ShapeId, Shape>, ref: PointRef) {
  const s = shapes.get(ref.shape);
  return s ? getPoint(s, ref.key) : null;
}

export interface ResidualResult {
  residuals: number[];
  jacobianRows: number[][]; // one row per residual, length = varMap.length
}

/**
 * Build residuals + a finite-difference Jacobian from an evaluator. Used for
 * constraints whose analytical derivatives are fiddly (tangent, collinear,
 * angle). `evalAt` returns the residual vector for a given shape state.
 */
function numericResult(
  shapes: Map<ShapeId, Shape>,
  vm: VarMap,
  evalAt: (s: Map<ShapeId, Shape>) => number[]
): ResidualResult {
  const base = evalAt(shapes);
  const m = base.length;
  const rows: number[][] = base.map(() => new Array(vm.length).fill(0));
  const eps = 1e-6;
  for (const entry of vm) {
    const s = shapes.get(entry.ref.shape);
    if (!s) continue;
    const orig = getPoint(s, entry.ref.key);
    if (!orig) continue;
    const moved = { x: orig.x, y: orig.y };
    moved[entry.axis] += eps;
    const perturbed = new Map(shapes);
    perturbed.set(entry.ref.shape, setPointInShapeLocal(s, entry.ref.key, moved));
    const r = evalAt(perturbed);
    for (let i = 0; i < m; i++) rows[i][entry.idx] = (r[i] - base[i]) / eps;
  }
  return { residuals: base, jacobianRows: rows };
}

export function computeResiduals(
  c: Constraint,
  shapes: Map<ShapeId, Shape>,
  vm: VarMap
): ResidualResult {
  const nVars = vm.length;
  const zeroRow = () => new Array(nVars).fill(0);

  switch (c.type) {
    case 'coincident': {
      const a = pt(shapes, c.a);
      const b = pt(shapes, c.b);
      if (!a || !b) return { residuals: [], jacobianRows: [] };
      const r = [a.x - b.x, a.y - b.y];
      const j0 = zeroRow();
      const j1 = zeroRow();
      const ax = findVar(vm, c.a, 'x'), ay = findVar(vm, c.a, 'y');
      const bx = findVar(vm, c.b, 'x'), by = findVar(vm, c.b, 'y');
      if (ax >= 0) j0[ax] = 1;
      if (bx >= 0) j0[bx] = -1;
      if (ay >= 0) j1[ay] = 1;
      if (by >= 0) j1[by] = -1;
      return { residuals: r, jacobianRows: [j0, j1] };
    }

    case 'horizontal': {
      const s = shapes.get(c.line);
      if (!s || s.type !== 'line') return { residuals: [], jacobianRows: [] };
      const r = [s.y2 - s.y1];
      const j = zeroRow();
      const p0y = findVar(vm, { shape: c.line, key: 'p0' }, 'y');
      const p1y = findVar(vm, { shape: c.line, key: 'p1' }, 'y');
      if (p0y >= 0) j[p0y] = -1;
      if (p1y >= 0) j[p1y] = 1;
      return { residuals: r, jacobianRows: [j] };
    }

    case 'vertical': {
      const s = shapes.get(c.line);
      if (!s || s.type !== 'line') return { residuals: [], jacobianRows: [] };
      const r = [s.x2 - s.x1];
      const j = zeroRow();
      const p0x = findVar(vm, { shape: c.line, key: 'p0' }, 'x');
      const p1x = findVar(vm, { shape: c.line, key: 'p1' }, 'x');
      if (p0x >= 0) j[p0x] = -1;
      if (p1x >= 0) j[p1x] = 1;
      return { residuals: r, jacobianRows: [j] };
    }

    case 'parallel': {
      const sA = shapes.get(c.lineA);
      const sB = shapes.get(c.lineB);
      if (!sA || !sB) return { residuals: [], jacobianRows: [] };
      const dA = lineDir(sA);
      const dB = lineDir(sB);
      if (!dA || !dB) return { residuals: [], jacobianRows: [] };
      // cross product dA × dB = 0
      const r = [dA.x * dB.y - dA.y * dB.x];
      const j = zeroRow();
      // d(cross)/d(p0Ax) = -dB.y, d(cross)/d(p1Ax) = dB.y
      const a0x = findVar(vm, { shape: c.lineA, key: 'p0' }, 'x');
      const a0y = findVar(vm, { shape: c.lineA, key: 'p0' }, 'y');
      const a1x = findVar(vm, { shape: c.lineA, key: 'p1' }, 'x');
      const a1y = findVar(vm, { shape: c.lineA, key: 'p1' }, 'y');
      const b0x = findVar(vm, { shape: c.lineB, key: 'p0' }, 'x');
      const b0y = findVar(vm, { shape: c.lineB, key: 'p0' }, 'y');
      const b1x = findVar(vm, { shape: c.lineB, key: 'p1' }, 'x');
      const b1y = findVar(vm, { shape: c.lineB, key: 'p1' }, 'y');
      if (a0x >= 0) j[a0x] = -dB.y;
      if (a1x >= 0) j[a1x] = dB.y;
      if (a0y >= 0) j[a0y] = dB.x;
      if (a1y >= 0) j[a1y] = -dB.x;
      if (b0x >= 0) j[b0x] = dA.y;
      if (b1x >= 0) j[b1x] = -dA.y;
      if (b0y >= 0) j[b0y] = -dA.x;
      if (b1y >= 0) j[b1y] = dA.x;
      return { residuals: r, jacobianRows: [j] };
    }

    case 'perpendicular': {
      const sA = shapes.get(c.lineA);
      const sB = shapes.get(c.lineB);
      if (!sA || !sB) return { residuals: [], jacobianRows: [] };
      const dA = lineDir(sA);
      const dB = lineDir(sB);
      if (!dA || !dB) return { residuals: [], jacobianRows: [] };
      // dot product dA · dB = 0
      const r = [dA.x * dB.x + dA.y * dB.y];
      const j = zeroRow();
      const a0x = findVar(vm, { shape: c.lineA, key: 'p0' }, 'x');
      const a0y = findVar(vm, { shape: c.lineA, key: 'p0' }, 'y');
      const a1x = findVar(vm, { shape: c.lineA, key: 'p1' }, 'x');
      const a1y = findVar(vm, { shape: c.lineA, key: 'p1' }, 'y');
      const b0x = findVar(vm, { shape: c.lineB, key: 'p0' }, 'x');
      const b0y = findVar(vm, { shape: c.lineB, key: 'p0' }, 'y');
      const b1x = findVar(vm, { shape: c.lineB, key: 'p1' }, 'x');
      const b1y = findVar(vm, { shape: c.lineB, key: 'p1' }, 'y');
      if (a0x >= 0) j[a0x] = -dB.x;
      if (a1x >= 0) j[a1x] = dB.x;
      if (a0y >= 0) j[a0y] = -dB.y;
      if (a1y >= 0) j[a1y] = dB.y;
      if (b0x >= 0) j[b0x] = -dA.x;
      if (b1x >= 0) j[b1x] = dA.x;
      if (b0y >= 0) j[b0y] = -dA.y;
      if (b1y >= 0) j[b1y] = dA.y;
      return { residuals: r, jacobianRows: [j] };
    }

    case 'equal': {
      const sA = shapes.get(c.shapeA);
      const sB = shapes.get(c.shapeB);
      if (!sA || !sB) return { residuals: [], jacobianRows: [] };
      const lA = lineLength(sA);
      const lB = lineLength(sB);
      if (lA == null || lB == null) return { residuals: [], jacobianRows: [] };
      // lA² - lB² = 0 (avoids sqrt in Jacobian)
      const r = [lA * lA - lB * lB];
      const j = zeroRow();
      if (sA.type === 'line') {
        const dx = sA.x2 - sA.x1, dy = sA.y2 - sA.y1;
        const a0x = findVar(vm, { shape: c.shapeA, key: 'p0' }, 'x');
        const a0y = findVar(vm, { shape: c.shapeA, key: 'p0' }, 'y');
        const a1x = findVar(vm, { shape: c.shapeA, key: 'p1' }, 'x');
        const a1y = findVar(vm, { shape: c.shapeA, key: 'p1' }, 'y');
        if (a0x >= 0) j[a0x] = -2 * dx;
        if (a1x >= 0) j[a1x] = 2 * dx;
        if (a0y >= 0) j[a0y] = -2 * dy;
        if (a1y >= 0) j[a1y] = 2 * dy;
      }
      if (sB.type === 'line') {
        const dx = sB.x2 - sB.x1, dy = sB.y2 - sB.y1;
        const b0x = findVar(vm, { shape: c.shapeB, key: 'p0' }, 'x');
        const b0y = findVar(vm, { shape: c.shapeB, key: 'p0' }, 'y');
        const b1x = findVar(vm, { shape: c.shapeB, key: 'p1' }, 'x');
        const b1y = findVar(vm, { shape: c.shapeB, key: 'p1' }, 'y');
        if (b0x >= 0) j[b0x] = 2 * dx;
        if (b1x >= 0) j[b1x] = -2 * dx;
        if (b0y >= 0) j[b0y] = 2 * dy;
        if (b1y >= 0) j[b1y] = -2 * dy;
      }
      return { residuals: r, jacobianRows: [j] };
    }

    case 'midpoint': {
      const p0 = pt(shapes, c.point);
      const s = shapes.get(c.line);
      if (!p0 || !s || s.type !== 'line') return { residuals: [], jacobianRows: [] };
      const mx = (s.x1 + s.x2) / 2;
      const my = (s.y1 + s.y2) / 2;
      const r = [p0.x - mx, p0.y - my];
      const j0 = zeroRow();
      const j1 = zeroRow();
      const px = findVar(vm, c.point, 'x');
      const py = findVar(vm, c.point, 'y');
      const l0x = findVar(vm, { shape: c.line, key: 'p0' }, 'x');
      const l0y = findVar(vm, { shape: c.line, key: 'p0' }, 'y');
      const l1x = findVar(vm, { shape: c.line, key: 'p1' }, 'x');
      const l1y = findVar(vm, { shape: c.line, key: 'p1' }, 'y');
      if (px >= 0) j0[px] = 1;
      if (l0x >= 0) j0[l0x] = -0.5;
      if (l1x >= 0) j0[l1x] = -0.5;
      if (py >= 0) j1[py] = 1;
      if (l0y >= 0) j1[l0y] = -0.5;
      if (l1y >= 0) j1[l1y] = -0.5;
      return { residuals: r, jacobianRows: [j0, j1] };
    }

    case 'concentric': {
      const sA = shapes.get(c.circleA);
      const sB = shapes.get(c.circleB);
      if (!sA || !sB || sA.type !== 'circle' || sB.type !== 'circle')
        return { residuals: [], jacobianRows: [] };
      const r = [sA.cx - sB.cx, sA.cy - sB.cy];
      const j0 = zeroRow();
      const j1 = zeroRow();
      const ax = findVar(vm, { shape: c.circleA, key: 'center' }, 'x');
      const ay = findVar(vm, { shape: c.circleA, key: 'center' }, 'y');
      const bx = findVar(vm, { shape: c.circleB, key: 'center' }, 'x');
      const by = findVar(vm, { shape: c.circleB, key: 'center' }, 'y');
      if (ax >= 0) j0[ax] = 1;
      if (bx >= 0) j0[bx] = -1;
      if (ay >= 0) j1[ay] = 1;
      if (by >= 0) j1[by] = -1;
      return { residuals: r, jacobianRows: [j0, j1] };
    }

    case 'distance': {
      const a = pt(shapes, c.a);
      const b = pt(shapes, c.b);
      if (!a || !b) return { residuals: [], jacobianRows: [] };
      const dx = a.x - b.x, dy = a.y - b.y;
      // dist² - value² = 0
      const r = [dx * dx + dy * dy - c.value * c.value];
      const j = zeroRow();
      const ax = findVar(vm, c.a, 'x'), ay = findVar(vm, c.a, 'y');
      const bx = findVar(vm, c.b, 'x'), by = findVar(vm, c.b, 'y');
      if (ax >= 0) j[ax] = 2 * dx;
      if (bx >= 0) j[bx] = -2 * dx;
      if (ay >= 0) j[ay] = 2 * dy;
      if (by >= 0) j[by] = -2 * dy;
      return { residuals: r, jacobianRows: [j] };
    }

    case 'angle': {
      const sA = shapes.get(c.lineA);
      const sB = shapes.get(c.lineB);
      if (!sA || !sB) return { residuals: [], jacobianRows: [] };
      const dA = lineDir(sA);
      const dB = lineDir(sB);
      if (!dA || !dB) return { residuals: [], jacobianRows: [] };
      const rad = (c.value * Math.PI) / 180;
      const cosT = Math.cos(rad), sinT = Math.sin(rad);
      // Rotated dot: dA · R(θ)dB = 0 where R rotates by target angle
      // This constrains the angle between the lines to θ
      const rDot = dA.x * (dB.x * cosT - dB.y * sinT) + dA.y * (dB.x * sinT + dB.y * cosT);
      // Use cross-product form for stability: dA × R(θ)dB = 0
      const rCross = dA.x * (dB.x * sinT + dB.y * cosT) - dA.y * (dB.x * cosT - dB.y * sinT);
      // Use whichever has larger absolute value for better conditioning
      const r = [Math.abs(rCross) > Math.abs(rDot) ? rCross : rDot];
      // Jacobian is complex; use numerical approximation for angle constraints
      const j = zeroRow();
      // Numerical Jacobian (finite difference)
      const eps = 1e-7;
      for (const entry of vm) {
        const s = shapes.get(entry.ref.shape);
        if (!s) continue;
        const orig = getPoint(s, entry.ref.key);
        if (!orig) continue;
        const perturbed = { x: orig.x, y: orig.y };
        perturbed[entry.axis] += eps;
        const sP = new Map(shapes);
        sP.set(entry.ref.shape, setPointInShapeLocal(s, entry.ref.key, perturbed));
        const dAp = lineDir(sP.get(c.lineA)!);
        const dBp = lineDir(sP.get(c.lineB)!);
        if (!dAp || !dBp) continue;
        const rP = Math.abs(rCross) > Math.abs(rDot)
          ? dAp.x * (dBp.x * sinT + dBp.y * cosT) - dAp.y * (dBp.x * cosT - dBp.y * sinT)
          : dAp.x * (dBp.x * cosT - dBp.y * sinT) + dAp.y * (dBp.x * sinT + dBp.y * cosT);
        j[entry.idx] = (rP - r[0]) / eps;
      }
      return { residuals: r, jacobianRows: [j] };
    }

    case 'tangent': {
      // Perpendicular distance from circle center to the (infinite) line == r.
      return numericResult(shapes, vm, (sm) => {
        const line = sm.get(c.line);
        const circ = sm.get(c.circle);
        if (!line || line.type !== 'line' || !circ || circ.type !== 'circle') return [0];
        const dx = line.x2 - line.x1, dy = line.y2 - line.y1;
        const len = Math.hypot(dx, dy) || 1;
        // signed distance = ((C - p0) × d) / |d|
        const dist = ((circ.cx - line.x1) * dy - (circ.cy - line.y1) * dx) / len;
        return [Math.abs(dist) - circ.r];
      });
    }

    case 'collinear': {
      // Both endpoints of lineB lie on lineA's infinite line.
      return numericResult(shapes, vm, (sm) => {
        const a = sm.get(c.lineA);
        const b = sm.get(c.lineB);
        if (!a || a.type !== 'line' || !b || b.type !== 'line') return [0, 0];
        const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
        const len = Math.hypot(dx, dy) || 1;
        const off = (px: number, py: number) =>
          ((px - a.x1) * dy - (py - a.y1) * dx) / len;
        return [off(b.x1, b.y1), off(b.x2, b.y2)];
      });
    }

    case 'fixed': {
      // Fixed constraints are handled by removing the point from the variable set.
      // No residuals needed.
      return { residuals: [], jacobianRows: [] };
    }
  }
}

// Local import to avoid circular dependency issues
import { setPointInShape as setPointInShapeLocal } from './model';
