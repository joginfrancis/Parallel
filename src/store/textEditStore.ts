import { create } from 'zustand';
import { type ShapeId } from '../core/geometry/shapes';

/**
 * Inline text-edit state. When set, the HTML TextEditor renders a textarea over
 * the canvas at (x,y) screen px, sized to the font, editing the shape's content
 * live. Closing an empty text removes the shape.
 */
export interface TextEditing {
  shapeId: ShapeId;
  x: number; // screen px (top-left of the text box)
  y: number;
  fontPx: number; // font size in screen px (fontSize * zoom)
}

interface TextEditState {
  editing: TextEditing | null;
  open: (e: TextEditing) => void;
  close: () => void;
}

export const useTextEditStore = create<TextEditState>((set) => ({
  editing: null,
  open: (editing) => set({ editing }),
  close: () => set({ editing: null }),
}));
