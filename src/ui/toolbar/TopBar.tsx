import { useRef } from 'react';
import { useStore } from 'zustand';
import { useDocumentStore } from '../../store/documentStore';
import { useSelectionStore } from '../../store/selectionStore';
import { useUiStore } from '../../store/uiStore';
import { importSvgFile } from '../../core/io/importToDocument';

/** Top bar (UI_UX_SPEC §1.1). Undo/Redo/Delete, the app menu (Import), and
 *  Export are wired. */
export function TopBar() {
  const canUndo = useStore(useDocumentStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useDocumentStore.temporal, (s) => s.futureStates.length > 0);
  const selCount = useSelectionStore((s) => s.selected.length);
  const libraryOpen = useUiStore((s) => s.libraryOpen);
  const menuOpen = useUiStore((s) => s.menuOpen);
  const fileRef = useRef<HTMLInputElement>(null);

  const undo = () => useDocumentStore.temporal.getState().undo();
  const redo = () => useDocumentStore.temporal.getState().redo();
  const del = () => {
    const sel = useSelectionStore.getState().selected;
    if (sel.length) {
      useDocumentStore.getState().removeShapes(sel);
      useSelectionStore.getState().clear();
    }
  };
  const pickImport = () => {
    useUiStore.getState().setMenu(false);
    fileRef.current?.click();
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) importSvgFile(f);
    e.target.value = '';
  };

  return (
    <div className="top-bar">
      <input
        ref={fileRef}
        type="file"
        accept=".svg,image/svg+xml"
        style={{ display: 'none' }}
        onChange={onFile}
      />
      <div className="tb-group">
        <div className="tb-menu-wrap">
          <button className="tb-icon" aria-label="Menu" onClick={() => useUiStore.getState().toggleMenu()}>
            <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
          </button>
          {menuOpen && (
            <>
              <div className="tb-menu-scrim" onClick={() => useUiStore.getState().setMenu(false)} />
              <div className="tb-menu">
                <button className="tb-menu-item" onClick={pickImport}>Import SVG…</button>
                <button className="tb-menu-item" onClick={() => useUiStore.getState().setExport(true)}>Export SVG…</button>
              </div>
            </>
          )}
        </div>
        <button className="tb-doc">Untitled
          <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5" fill="none"><path d="M3.5 5.5L7 9l3.5-3.5" /></svg>
        </button>
        <span className="tb-sep" />
        <button className="tb-icon" aria-label="Undo" onClick={undo} disabled={!canUndo}>
          <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7L3 10l4 3M3 10h8a5 5 0 015 5" /></svg>
        </button>
        <button className="tb-icon" aria-label="Redo" onClick={redo} disabled={!canRedo}>
          <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M13 7l4 3-4 3M17 10H9a5 5 0 00-5 5" /></svg>
        </button>
        <button className="tb-icon" aria-label="Delete" onClick={del} disabled={selCount === 0}>
          <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" /></svg>
        </button>
      </div>

      <button
        className={`tb-shapes${libraryOpen ? ' active' : ''}`}
        onClick={() => useUiStore.getState().toggleLibrary()}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" fill="none"><rect x="2" y="2" width="5" height="5" rx="1"/><circle cx="11.5" cy="4.5" r="2.5"/><path d="M4.5 9.5l2.5 4.5h-5z"/></svg>
        Shapes
      </button>

      <div className="tb-group">
        <button className="tb-export" onClick={() => useUiStore.getState().setExport(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M8 11V3M5 6l3-3 3 3M3 11v2h10v-2" /></svg>
          Export
        </button>
      </div>
    </div>
  );
}
