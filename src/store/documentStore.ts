import { create } from 'zustand';
import { temporal } from 'zundo';
import {
  type Shape,
  type ShapeId,
  newId,
  translateShape,
} from '../core/geometry/shapes';
import { breakShape } from '../core/geometry/decompose';
import { useConstraintStore } from './constraintStore';

/**
 * The document model — the single source of truth for all geometry. Paper.js
 * derives its scene graph from this via the reconciler; history is snapshots of
 * `shapes` (zundo), never Paper items (UI_UX_SPEC §2, history).
 */
interface DocumentState {
  shapes: Shape[];
  addShape: (s: Shape) => void;
  updateShape: (id: ShapeId, patch: Partial<Shape>) => void;
  /** Replace shapes by full objects (solver output). */
  replaceAll: (newShapes: Shape[]) => void;
  removeShapes: (ids: ShapeId[]) => void;
  moveShapes: (ids: ShapeId[], dx: number, dy: number) => void;
  /** Move shapes by individual per-id deltas (align/distribute), one history step. */
  translateEach: (deltas: Record<ShapeId, { dx: number; dy: number }>) => void;
  /** Duplicate the given shapes (offset), returning the new ids. */
  duplicateShapes: (ids: ShapeId[], offset?: number) => ShapeId[];
  /** Assign a fresh shared groupId to the given shapes. */
  groupShapes: (ids: ShapeId[]) => void;
  /** Clear group membership of the given shapes. */
  ungroupShapes: (ids: ShapeId[]) => void;
  /** Break each shape into primitives; returns the new shape ids. */
  breakShapes: (ids: ShapeId[]) => ShapeId[];
  /** Remove `removeIds` and add `add` (used by boolean ops); returns new ids. */
  replaceShapes: (removeIds: ShapeId[], add: Shape[]) => ShapeId[];
  /** Coalesce an interactive drag (move/resize/rotate) into one history entry. */
  beginInteraction: () => void;
  endInteraction: () => void;
}

export const useDocumentStore = create<DocumentState>()(
  temporal(
    (set, get) => {
      let snapshot: Shape[] | null = null;
      return {
        shapes: [],
        addShape: (s) => set((st) => ({ shapes: [...st.shapes, s] })),
        updateShape: (id, patch) =>
          set((st) => ({
            shapes: st.shapes.map((s) =>
              s.id === id ? ({ ...s, ...patch } as Shape) : s
            ),
          })),
        replaceAll: (newShapes) => set({ shapes: newShapes }),
        removeShapes: (ids) => {
          useConstraintStore.getState().removeForShapes(ids);
          set((st) => ({ shapes: st.shapes.filter((s) => !ids.includes(s.id)) }));
        },
        moveShapes: (ids, dx, dy) =>
          set((st) => ({
            shapes: st.shapes.map((s) =>
              ids.includes(s.id) ? translateShape(s, dx, dy) : s
            ),
          })),
        translateEach: (deltas) =>
          set((st) => ({
            shapes: st.shapes.map((s) =>
              deltas[s.id] ? translateShape(s, deltas[s.id].dx, deltas[s.id].dy) : s
            ),
          })),
        duplicateShapes: (ids, offset = 5) => {
          const newIds: ShapeId[] = [];
          set((st) => {
            const copies = st.shapes
              .filter((s) => ids.includes(s.id))
              .map((s) => {
                const id = newId();
                newIds.push(id);
                return { ...translateShape(s, offset, offset), id } as Shape;
              });
            return { shapes: [...st.shapes, ...copies] };
          });
          return newIds;
        },
        groupShapes: (ids) => {
          const gid = newId();
          set((st) => ({
            shapes: st.shapes.map((s) => (ids.includes(s.id) ? { ...s, groupId: gid } : s)),
          }));
        },
        ungroupShapes: (ids) =>
          set((st) => ({
            shapes: st.shapes.map((s) =>
              ids.includes(s.id) ? { ...s, groupId: undefined } : s
            ),
          })),
        breakShapes: (ids) => {
          const newIds: ShapeId[] = [];
          set((st) => {
            const shapes: Shape[] = [];
            for (const s of st.shapes) {
              if (ids.includes(s.id)) {
                const parts = breakShape(s);
                for (const p of parts) {
                  shapes.push(p);
                  if (p.id !== s.id) newIds.push(p.id);
                }
              } else shapes.push(s);
            }
            return { shapes };
          });
          return newIds;
        },
        replaceShapes: (removeIds, add) => {
          set((st) => ({
            shapes: [...st.shapes.filter((s) => !removeIds.includes(s.id)), ...add],
          }));
          return add.map((s) => s.id);
        },
        // Pause history at drag start; on end, restore the pre-drag snapshot
        // (untracked) then re-apply the final state once so the whole drag is a
        // single undo step.
        beginInteraction: () => {
          snapshot = get().shapes;
          useDocumentStore.temporal.getState().pause();
        },
        endInteraction: () => {
          if (!snapshot) return;
          const final = get().shapes;
          if (final === snapshot) {
            // Nothing actually changed (e.g. a click with no drag).
            useDocumentStore.temporal.getState().resume();
            snapshot = null;
            return;
          }
          set({ shapes: snapshot });
          useDocumentStore.temporal.getState().resume();
          set({ shapes: final });
          snapshot = null;
        },
      };
    },
    { limit: 200 }
  )
);

/** Temporal (undo/redo) handle for the document store. */
export const documentHistory = useDocumentStore.temporal;
