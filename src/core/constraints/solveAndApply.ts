import { type Shape } from '../geometry/shapes';
import { type Constraint } from './model';
import { solve } from './solver';

export interface ApplyResult {
  shapes: Shape[];
  /** False when the solver could not satisfy every constraint (over-constrained). */
  converged: boolean;
  maxResidual: number;
}

/**
 * Run the constraint solver after a user mutation. Pins the actively-dragged
 * point so the solver adjusts neighbors rather than fighting the cursor.
 *
 * @param shapes      Current shapes array
 * @param constraints Active constraints
 * @param pinnedKeys  Points pinned to cursor, as "shapeId:pointKey" → position
 */
export function solveAndApply(
  shapes: Shape[],
  constraints: Constraint[],
  pinnedKeys?: Map<string, { x: number; y: number }>
): ApplyResult {
  if (constraints.length === 0) {
    return { shapes, converged: true, maxResidual: 0 };
  }
  const { shapes: solved, converged, maxResidual } = solve(shapes, constraints, pinnedKeys);
  return { shapes: solved, converged, maxResidual };
}
