import { create } from 'zustand';

/**
 * Viewport state — zoom and pan over an mm-based coordinate space.
 * The canvas treats project coordinates as millimetres; `zoom` is the
 * pixels-per-mm factor applied by Paper.js. 100% == BASE_PPMM px per mm.
 *
 * The imperative controls (zoomBy/zoomTo/fit) are populated by PaperCanvas via
 * `bindControls` on mount; floating UI calls them through the store, which is a
 * single shared instance.
 */
export const BASE_PPMM = 3; // 100 mm == 300 px at 100% zoom

interface ViewControls {
  zoomBy: (factor: number) => void;
  zoomTo: (ppmm: number) => void;
  fit: () => void;
}

interface ViewState extends ViewControls {
  /** pixels per mm */
  zoom: number;
  /** zoom expressed as a percentage of BASE_PPMM */
  zoomPercent: number;
  setZoom: (zoom: number) => void;
  bindControls: (controls: ViewControls) => void;
}

const noop = () => {};

export const useViewStore = create<ViewState>((set) => ({
  zoom: BASE_PPMM,
  zoomPercent: 100,
  setZoom: (zoom) =>
    set({ zoom, zoomPercent: Math.round((zoom / BASE_PPMM) * 100) }),
  zoomBy: noop,
  zoomTo: noop,
  fit: noop,
  bindControls: (controls) =>
    set({ zoomBy: controls.zoomBy, zoomTo: controls.zoomTo, fit: controls.fit }),
}));
