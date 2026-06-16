import { create } from 'zustand';
import { type ShapeId } from '../core/geometry/shapes';
import { type DimField } from '../core/geometry/dimensions';

/**
 * Inline dimension-edit state (UI_UX_SPEC §5.1). When set, the HTML
 * DimensionEditor renders an input at (x,y) screen coords with ✓/✕.
 */
export interface EditingDim {
  shapeId: ShapeId;
  field: DimField;
  value: number;
  x: number; // screen px
  y: number;
}

interface EditingState {
  editing: EditingDim | null;
  open: (e: EditingDim) => void;
  close: () => void;
}

export const useEditingStore = create<EditingState>((set) => ({
  editing: null,
  open: (editing) => set({ editing }),
  close: () => set({ editing: null }),
}));
