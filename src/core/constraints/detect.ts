import { type Shape, type ShapeId } from '../geometry/shapes';
import {
  type Constraint,
  shapePointRefs,
  lineDir,
  newConstraintId,
} from './model';

const POINT_TOL = 0.15;   // mm — coincident detection
const ANGLE_TOL = 2;      // degrees — horizontal/vertical/parallel/perpendicular
const LENGTH_TOL = 0.02;  // 2% — equal length
const CENTER_TOL = 0.5;   // mm — concentric
const TANGENT_TOL = 0.5;  // mm — |dist(center,line) - r|
const COLLINEAR_TOL = 0.5; // mm — endpoint offset from the other line

interface Candidate {
  constraint: Constraint;
  confidence: number; // 0–1, higher = more likely the user intended this
}

/**
 * Detect constraints that should auto-apply for a newly placed or edited shape.
 * Returns candidates sorted by confidence (highest first).
 */
export function detectConstraints(
  targetId: ShapeId,
  shapes: Shape[],
  existing: Constraint[]
): Candidate[] {
  const target = shapes.find((s) => s.id === targetId);
  if (!target) return [];

  const candidates: Candidate[] = [];
  const existingKeys = new Set(existing.map(constraintKey));

  // Coincident: target points near other shapes' points
  detectCoincident(target, shapes, existingKeys, candidates);

  // Horizontal / Vertical for lines
  if (target.type === 'line') {
    detectHV(target, existingKeys, candidates);
  }

  // Parallel / Perpendicular / Equal / Collinear for lines
  if (target.type === 'line') {
    for (const other of shapes) {
      if (other.id === targetId || other.type !== 'line') continue;
      detectLineRelations(target, other, existingKeys, candidates);
    }
  }

  // Concentric for circles
  if (target.type === 'circle') {
    for (const other of shapes) {
      if (other.id === targetId || other.type !== 'circle') continue;
      detectConcentric(target, other, existingKeys, candidates);
    }
  }

  // Tangent: line ↔ circle (either could be the target)
  if (target.type === 'line') {
    for (const other of shapes) {
      if (other.type !== 'circle') continue;
      detectTangent(target, other, existingKeys, candidates);
    }
  } else if (target.type === 'circle') {
    for (const other of shapes) {
      if (other.type !== 'line') continue;
      detectTangent(other, target, existingKeys, candidates);
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates;
}

function detectCoincident(
  target: Shape,
  shapes: Shape[],
  existing: Set<string>,
  out: Candidate[]
) {
  const targetPts = shapePointRefs(target);
  for (const other of shapes) {
    if (other.id === target.id) continue;
    for (const op of shapePointRefs(other)) {
      for (const tp of targetPts) {
        const d = Math.hypot(tp.pos.x - op.pos.x, tp.pos.y - op.pos.y);
        if (d < POINT_TOL) {
          const c: Constraint = {
            id: newConstraintId(),
            type: 'coincident',
            a: tp.ref,
            b: op.ref,
          };
          if (!existing.has(constraintKey(c))) {
            out.push({ constraint: c, confidence: 1.0 - d / POINT_TOL });
          }
        }
      }
    }
  }
}

function detectHV(
  line: Shape & { type: 'line' },
  existing: Set<string>,
  out: Candidate[]
) {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const ang = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);

  // Horizontal: angle near 0° or 180°
  const hDiff = Math.min(ang, Math.abs(ang - 180));
  if (hDiff < ANGLE_TOL) {
    const c: Constraint = { id: newConstraintId(), type: 'horizontal', line: line.id };
    if (!existing.has(constraintKey(c))) {
      out.push({ constraint: c, confidence: 1.0 - hDiff / ANGLE_TOL });
    }
  }

  // Vertical: angle near 90° or 270°
  const vDiff = Math.min(Math.abs(ang - 90), Math.abs(ang - 270));
  if (vDiff < ANGLE_TOL) {
    const c: Constraint = { id: newConstraintId(), type: 'vertical', line: line.id };
    if (!existing.has(constraintKey(c))) {
      out.push({ constraint: c, confidence: 1.0 - vDiff / ANGLE_TOL });
    }
  }
}

function detectLineRelations(
  a: Shape & { type: 'line' },
  b: Shape & { type: 'line' },
  existing: Set<string>,
  out: Candidate[]
) {
  const dA = lineDir(a)!;
  const dB = lineDir(b)!;
  const lA = Math.hypot(dA.x, dA.y);
  const lB = Math.hypot(dB.x, dB.y);
  if (lA < 0.01 || lB < 0.01) return;

  // Angle between lines
  const dot = (dA.x * dB.x + dA.y * dB.y) / (lA * lB);
  const cross = (dA.x * dB.y - dA.y * dB.x) / (lA * lB);
  const angleDeg = Math.abs((Math.asin(Math.min(1, Math.max(-1, cross))) * 180) / Math.PI);

  // Parallel: cross ≈ 0. If the lines are also on the same infinite line,
  // prefer collinear (the stronger relationship).
  if (angleDeg < ANGLE_TOL) {
    const len = Math.hypot(dA.x, dA.y) || 1;
    const off = Math.abs(((b.x1 - a.x1) * dA.y - (b.y1 - a.y1) * dA.x) / len);
    if (off < COLLINEAR_TOL) {
      const c: Constraint = { id: newConstraintId(), type: 'collinear', lineA: a.id, lineB: b.id };
      if (!existing.has(constraintKey(c))) {
        out.push({ constraint: c, confidence: 1.0 - off / COLLINEAR_TOL });
      }
    } else {
      const c: Constraint = { id: newConstraintId(), type: 'parallel', lineA: a.id, lineB: b.id };
      if (!existing.has(constraintKey(c))) {
        out.push({ constraint: c, confidence: 1.0 - angleDeg / ANGLE_TOL });
      }
    }
  }

  // Perpendicular: dot ≈ 0 (angle ≈ 90°)
  const perpDiff = Math.abs(angleDeg - 90);
  if (perpDiff < ANGLE_TOL || Math.abs(90 - angleDeg) < ANGLE_TOL) {
    const absDot = Math.abs(dot);
    if (absDot < Math.sin((ANGLE_TOL * Math.PI) / 180)) {
      const c: Constraint = { id: newConstraintId(), type: 'perpendicular', lineA: a.id, lineB: b.id };
      if (!existing.has(constraintKey(c))) {
        out.push({ constraint: c, confidence: 1.0 - absDot });
      }
    }
  }

  // Equal length
  const lenDiff = Math.abs(lA - lB) / Math.max(lA, lB);
  if (lenDiff < LENGTH_TOL) {
    const c: Constraint = { id: newConstraintId(), type: 'equal', shapeA: a.id, shapeB: b.id };
    if (!existing.has(constraintKey(c))) {
      out.push({ constraint: c, confidence: 1.0 - lenDiff / LENGTH_TOL });
    }
  }

  // Relative angle: snap to a "nice" angle (excludes 0/90/180 — those are
  // parallel/perpendicular, handled above). Full 0–180° angle between directions.
  const fullAngle = (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
  for (const common of [30, 45, 60, 120, 135, 150]) {
    const diff = Math.abs(fullAngle - common);
    if (diff < ANGLE_TOL) {
      const c: Constraint = { id: newConstraintId(), type: 'angle', lineA: a.id, lineB: b.id, value: common };
      if (!existing.has(constraintKey(c))) {
        out.push({ constraint: c, confidence: 1.0 - diff / ANGLE_TOL });
      }
      break;
    }
  }
}

function detectTangent(
  line: Shape & { type: 'line' },
  circle: Shape & { type: 'circle' },
  existing: Set<string>,
  out: Candidate[]
) {
  const dx = line.x2 - line.x1, dy = line.y2 - line.y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return;
  const dist = Math.abs(((circle.cx - line.x1) * dy - (circle.cy - line.y1) * dx) / len);
  const diff = Math.abs(dist - circle.r);
  if (diff < TANGENT_TOL) {
    const c: Constraint = { id: newConstraintId(), type: 'tangent', line: line.id, circle: circle.id };
    if (!existing.has(constraintKey(c))) {
      out.push({ constraint: c, confidence: 1.0 - diff / TANGENT_TOL });
    }
  }
}

function detectConcentric(
  a: Shape & { type: 'circle' },
  b: Shape & { type: 'circle' },
  existing: Set<string>,
  out: Candidate[]
) {
  const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
  if (d < CENTER_TOL) {
    const c: Constraint = { id: newConstraintId(), type: 'concentric', circleA: a.id, circleB: b.id };
    if (!existing.has(constraintKey(c))) {
      out.push({ constraint: c, confidence: 1.0 - d / CENTER_TOL });
    }
  }
}

/** Stable key for deduplication (order-independent for symmetric constraints). */
function constraintKey(c: Constraint): string {
  switch (c.type) {
    case 'coincident': {
      const [a, b] = [`${c.a.shape}:${c.a.key}`, `${c.b.shape}:${c.b.key}`].sort();
      return `coincident:${a}:${b}`;
    }
    case 'horizontal': return `horizontal:${c.line}`;
    case 'vertical': return `vertical:${c.line}`;
    case 'parallel': {
      const [a, b] = [c.lineA, c.lineB].sort();
      return `parallel:${a}:${b}`;
    }
    case 'perpendicular': {
      const [a, b] = [c.lineA, c.lineB].sort();
      return `perpendicular:${a}:${b}`;
    }
    case 'equal': {
      const [a, b] = [c.shapeA, c.shapeB].sort();
      return `equal:${a}:${b}`;
    }
    case 'midpoint': return `midpoint:${c.point.shape}:${c.point.key}:${c.line}`;
    case 'concentric': {
      const [a, b] = [c.circleA, c.circleB].sort();
      return `concentric:${a}:${b}`;
    }
    case 'tangent': return `tangent:${c.line}:${c.circle}`;
    case 'collinear': {
      const [a, b] = [c.lineA, c.lineB].sort();
      return `collinear:${a}:${b}`;
    }
    case 'distance': {
      const [a, b] = [`${c.a.shape}:${c.a.key}`, `${c.b.shape}:${c.b.key}`].sort();
      return `distance:${a}:${b}`;
    }
    case 'angle': {
      const [a, b] = [c.lineA, c.lineB].sort();
      return `angle:${a}:${b}`;
    }
    case 'fixed': return `fixed:${c.ref.shape}:${c.ref.key}`;
  }
}
