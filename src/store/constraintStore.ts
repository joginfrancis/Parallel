import { create } from 'zustand';
import {
  type Constraint,
  constraintShapeIds,
} from '../core/constraints/model';
import { type ShapeId } from '../core/geometry/shapes';

interface ConstraintState {
  constraints: Constraint[];
  add: (c: Constraint) => void;
  addMany: (cs: Constraint[]) => void;
  remove: (id: string) => void;
  removeForShapes: (shapeIds: ShapeId[]) => void;
  clear: () => void;
}

export const useConstraintStore = create<ConstraintState>()((set) => ({
  constraints: [],

  add: (c) =>
    set((st) => ({ constraints: [...st.constraints, c] })),

  addMany: (cs) =>
    set((st) => ({ constraints: [...st.constraints, ...cs] })),

  remove: (id) =>
    set((st) => ({ constraints: st.constraints.filter((c) => c.id !== id) })),

  removeForShapes: (shapeIds) => {
    const ids = new Set(shapeIds);
    set((st) => ({
      constraints: st.constraints.filter(
        (c) => !constraintShapeIds(c).some((sid) => ids.has(sid))
      ),
    }));
  },

  clear: () => set({ constraints: [] }),
}));
