import { create } from 'zustand';

/** The 8 permanent rail tools (UI_UX_SPEC §1.2). */
export type ToolId =
  | 'select'
  | 'line'
  | 'arc'
  | 'circle'
  | 'rectangle'
  | 'pen'
  | 'text'
  | 'image';

interface ToolState {
  active: ToolId;
  setTool: (t: ToolId) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  active: 'select',
  setTool: (active) => set({ active }),
}));
