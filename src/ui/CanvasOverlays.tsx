import { useViewStore } from '../store/viewStore';

/** Bottom-left zoom cluster + bottom-right snap grid (UI_UX_SPEC §1.3, §1.5). */
export function CanvasOverlays() {
  const zoomPercent = useViewStore((s) => s.zoomPercent);
  const zoomBy = useViewStore((s) => s.zoomBy);
  const fit = useViewStore((s) => s.fit);

  return (
    <>
      <div className="zoom-cluster">
        <button onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out">−</button>
        <span className="zoom-val">{zoomPercent}%</span>
        <button onClick={() => zoomBy(1.2)} aria-label="Zoom in">+</button>
        <button onClick={() => fit()} aria-label="Zoom to fit" className="zoom-fit">
          <svg width="16" height="16" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" /></svg>
        </button>
      </div>

      <div className="snap-grid">
        Snap Grid
        <span className="snap-val">1.0 mm
          <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.5" fill="none"><path d="M3 4.5L6 7.5L9 4.5" /></svg>
        </span>
      </div>
    </>
  );
}
