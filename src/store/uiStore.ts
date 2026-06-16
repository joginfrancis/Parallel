import { create } from 'zustand';

/** Transient UI panel state (Object Library, Import/Export panels, app menu). */
interface UiState {
  libraryOpen: boolean;
  toggleLibrary: () => void;
  setLibrary: (open: boolean) => void;
  exportOpen: boolean;
  setExport: (open: boolean) => void;
  menuOpen: boolean;
  toggleMenu: () => void;
  setMenu: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  libraryOpen: false,
  toggleLibrary: () => set((s) => ({ libraryOpen: !s.libraryOpen })),
  setLibrary: (libraryOpen) => set({ libraryOpen }),
  exportOpen: false,
  setExport: (exportOpen) => set({ exportOpen, menuOpen: false }),
  menuOpen: false,
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  setMenu: (menuOpen) => set({ menuOpen }),
}));
