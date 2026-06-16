import { useEffect, useRef, useState } from 'react';
import { useTextEditStore } from '../store/textEditStore';
import { useDocumentStore } from '../store/documentStore';
import { useSelectionStore } from '../store/selectionStore';
import './TextEditor.css';

/**
 * Inline text editor. Renders a transparent textarea over the canvas at the
 * text shape's position, typed in the true font size so it sits exactly on top
 * of the rendered glyphs. Updates the shape live; Enter (without Shift) or blur
 * commits; Escape cancels. An empty text removes the shape.
 */
export function TextEditor() {
  const editing = useTextEditStore((s) => s.editing);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!editing) return;
    const shape = useDocumentStore.getState().shapes.find((s) => s.id === editing.shapeId);
    setText(shape && shape.type === 'text' ? shape.text : '');
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
  }, [editing]);

  if (!editing) return null;

  const apply = (value: string) => {
    setText(value);
    useDocumentStore.getState().updateShape(editing.shapeId, { text: value });
  };

  const finish = () => {
    const shape = useDocumentStore.getState().shapes.find((s) => s.id === editing.shapeId);
    if (shape && shape.type === 'text' && shape.text.trim() === '') {
      // Empty → discard the placeholder shape.
      useDocumentStore.getState().removeShapes([editing.shapeId]);
      useSelectionStore.getState().clear();
    }
    useTextEditStore.getState().close();
  };

  return (
    <textarea
      ref={ref}
      className="text-editor"
      value={text}
      style={{
        left: editing.x,
        top: editing.y,
        fontSize: `${editing.fontPx}px`,
        lineHeight: 1.2,
      }}
      rows={1}
      spellCheck={false}
      onChange={(e) => apply(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(); }
        else if (e.key === 'Escape') finish();
        e.stopPropagation();
      }}
      onBlur={finish}
    />
  );
}
