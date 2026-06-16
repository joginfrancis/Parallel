import { useState } from 'react';
import { useUiStore } from '../../store/uiStore';
import { useDocumentStore } from '../../store/documentStore';
import { shapesToSvg, downloadSvg } from '../../core/io/svgExport';
import './ExportPanel.css';

/** Export panel (UI_UX_SPEC §7.3) — a deliberate modal surface. Download or
 *  copy the document as a standalone SVG. */
export function ExportPanel() {
  const open = useUiStore((s) => s.exportOpen);
  const shapeCount = useDocumentStore((s) => s.shapes.length);
  const [copied, setCopied] = useState(false);

  if (!open) return null;
  const close = () => useUiStore.getState().setExport(false);

  const buildSvg = () => shapesToSvg(useDocumentStore.getState().shapes);

  const onDownload = () => {
    downloadSvg(buildSvg(), 'sketch.svg');
    close();
  };
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildSvg());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="export-scrim" onClick={close}>
      <div className="export-panel" onClick={(e) => e.stopPropagation()}>
        <div className="export-head">
          <span className="export-title">Export your sketch</span>
          <button className="export-close" onClick={close} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
          </button>
        </div>

        <p className="export-sub">
          Saves an <strong>SVG</strong> — a sharp vector file you can print, cut, or
          open in other tools. {shapeCount} shape{shapeCount === 1 ? '' : 's'}, true size in mm.
        </p>

        <div className="export-actions">
          <button className="export-primary" onClick={onDownload} disabled={shapeCount === 0}>
            <svg width="16" height="16" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M8 11V3M5 6l3 3 3-3M3 12v1h10v-1" /></svg>
            Download SVG
          </button>
          <button className="export-secondary" onClick={onCopy} disabled={shapeCount === 0}>
            {copied ? 'Copied!' : 'Copy SVG'}
          </button>
        </div>
      </div>
    </div>
  );
}
