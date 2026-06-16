import { useUiStore } from '../../store/uiStore';
import { useDocumentStore } from '../../store/documentStore';
import { useSelectionStore } from '../../store/selectionStore';
import { LIBRARY, type LibraryItem } from '../../core/geometry/library';
import { boundsOf } from '../../core/geometry/transform';
import './ObjectLibrary.css';

/** Object Library panel (UI_UX_SPEC §7.1). Click a shape to add it at the
 *  origin, fully editable, and selected. */
export function ObjectLibrary() {
  const open = useUiStore((s) => s.libraryOpen);
  const close = () => useUiStore.getState().setLibrary(false);

  if (!open) return null;

  const add = (item: LibraryItem) => {
    const shape = item.make(0, 0, 50);
    useDocumentStore.getState().addShape(shape);
    useSelectionStore.getState().set([shape.id]);
  };

  return (
    <div className="lib-panel">
      <div className="lib-head">
        <span className="lib-title">Shapes</span>
        <button className="lib-close" onClick={close} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
        </button>
      </div>
      <div className="lib-grid">
        {LIBRARY.map((item) => (
          <button key={item.name} className="lib-item" title={item.name} onClick={() => add(item)}>
            <LibraryThumb item={item} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Small SVG preview of a library shape, normalized to the thumb box. */
function LibraryThumb({ item }: { item: LibraryItem }) {
  const shape = item.make(0, 0, 40);
  if (shape.type !== 'path') return null;
  const b = boundsOf(shape);
  const pad = 4;
  const w = b.maxX - b.minX || 1;
  const h = b.maxY - b.minY || 1;
  const d =
    shape.nodes
      .map((n, i) => `${i === 0 ? 'M' : 'L'}${(n.x - b.minX).toFixed(1)},${(n.y - b.minY).toFixed(1)}`)
      .join(' ') + ' Z';
  return (
    <svg viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} width="40" height="40">
      <path d={d} fill="rgba(59,130,246,0.12)" stroke="#3b82f6" strokeWidth="1.5" />
    </svg>
  );
}
