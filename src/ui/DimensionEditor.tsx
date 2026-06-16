import { useEffect, useRef, useState } from 'react';
import { useEditingStore } from '../store/editingStore';
import { useDocumentStore } from '../store/documentStore';
import { setDimension } from '../core/geometry/dimensions';
import './DimensionEditor.css';

/**
 * Inline dimension editor (UI_UX_SPEC §5.1). Renders an HTML input + ✓/✕ at the
 * clicked dimension chip's screen position. Enter/✓ commits to geometry,
 * Esc/✕ cancels. Positioned absolutely over the canvas.
 */
export function DimensionEditor() {
  const editing = useEditingStore((s) => s.editing);
  const close = useEditingStore((s) => s.close);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    if (editing) {
      setText(String(Number(editing.value.toFixed(2))));
      // focus + select on the next tick so the value is highlighted
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing]);

  if (!editing) return null;

  const commit = () => {
    const v = parseFloat(text);
    if (!Number.isNaN(v)) {
      const shape = useDocumentStore.getState().shapes.find((s) => s.id === editing.shapeId);
      if (shape) {
        useDocumentStore.getState().updateShape(editing.shapeId, setDimension(shape, editing.field, v));
      }
    }
    close();
  };

  return (
    <div
      className="dim-editor"
      style={{ left: editing.x, top: editing.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        value={text}
        inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') close();
          e.stopPropagation();
        }}
        onBlur={commit}
      />
      <span className="dim-unit">{editing.field === 'angle' ? '°' : 'mm'}</span>
      <button className="dim-ok" onMouseDown={(e) => e.preventDefault()} onClick={commit} aria-label="Apply">
        <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7.5L6 10.5L11 4" /></svg>
      </button>
      <button className="dim-cancel" onMouseDown={(e) => e.preventDefault()} onClick={close} aria-label="Cancel">
        <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
      </button>
    </div>
  );
}
