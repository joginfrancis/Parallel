import { create } from 'zustand';
import { type ShapeId } from '../core/geometry/shapes';

/** Which shapes are currently selected (UI_UX_SPEC §3.1). Pass 3 builds the
 *  handle/transform UI on top of this; Pass 2 only needs select + move. */
interface SelectionState {
  selected: ShapeId[];
  /** When set, that path is in edit-points mode (UI_UX_SPEC §7). */
  editPathId: ShapeId | null;
  set: (ids: ShapeId[]) => void;
  clear: () => void;
  setEditPath: (id: ShapeId | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selected: [],
  editPathId: null,
  set: (selected) => set({ selected, editPathId: null }),
  clear: () => set({ selected: [], editPathId: null }),
  setEditPath: (editPathId) => set({ editPathId }),
}));
