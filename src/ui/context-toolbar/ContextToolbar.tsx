import type { ReactNode } from 'react';
import { useSelectionStore } from '../../store/selectionStore';
import { useDocumentStore } from '../../store/documentStore';
import {
  alignDeltas,
  distributeDeltas,
  type AlignMode,
  type DistributeAxis,
} from '../../core/geometry/align';
import { booleanOp, type BoolOp } from '../../core/geometry/boolean';
import { isBreakable } from '../../core/geometry/decompose';
import { type Shape } from '../../core/geometry/shapes';
import { ConstraintChips } from './ConstraintChips';
import './ContextToolbar.css';

const hasArea = (s: Shape) =>
  s.type === 'rectangle' || s.type === 'circle' || (s.type === 'path' && s.closed);

/**
 * The dynamic context toolbar (UI_UX_SPEC §4) — floating bottom-center, its
 * contents driven by the current selection. Nothing selected → hidden;
 * one shape → Duplicate / Delete; many → Align · Distribute · Duplicate · Delete.
 */
export function ContextToolbar() {
  const selected = useSelectionStore((s) => s.selected);
  const shapes = useDocumentStore((s) => s.shapes);

  if (selected.length === 0) return null;
  const selShapes = shapes.filter((s) => selected.includes(s.id));
  const multi = selShapes.length > 1;
  const gid = selShapes[0]?.groupId;
  const isGroup = multi && !!gid && selShapes.every((s) => s.groupId === gid);
  const canBool = selShapes.filter(hasArea).length >= 2;
  const canBreak = selShapes.length === 1 && isBreakable(selShapes[0]);
  const soleText = selShapes.length === 1 && selShapes[0].type === 'text' ? selShapes[0] : null;
  const soleImage = selShapes.length === 1 && selShapes[0].type === 'image' ? selShapes[0] : null;

  const patchText = (patch: Partial<Shape>) =>
    soleText && useDocumentStore.getState().updateShape(soleText.id, patch);

  const doAlign = (mode: AlignMode) =>
    useDocumentStore.getState().translateEach(alignDeltas(selShapes, mode));
  const doDistribute = (axis: DistributeAxis) =>
    useDocumentStore.getState().translateEach(distributeDeltas(selShapes, axis));
  const duplicate = () => {
    const ids = useDocumentStore.getState().duplicateShapes(selected);
    useSelectionStore.getState().set(ids);
  };
  const remove = () => {
    useDocumentStore.getState().removeShapes(selected);
    useSelectionStore.getState().clear();
  };
  const group = () => useDocumentStore.getState().groupShapes(selected);
  const ungroup = () => useDocumentStore.getState().ungroupShapes(selected);
  const doBreak = () => {
    const ids = useDocumentStore.getState().breakShapes(selected);
    useSelectionStore.getState().set(ids);
  };
  const doBool = (op: BoolOp) => {
    const res = booleanOp(selShapes, op);
    if (!res.length) return;
    const ids = useDocumentStore.getState().replaceShapes(selected, res);
    useSelectionStore.getState().set(ids);
  };

  return (
    <div className="ctx-toolbar">
      {soleText && (
        <>
          <div className="ctx-group">
            <button className="ctx-btn" title="Smaller" onClick={() => patchText({ fontSize: Math.max(2, soleText.fontSize - 2) })}>
              <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"><path d="M5 10h10"/></svg>
            </button>
            <span className="ctx-num">{soleText.fontSize.toFixed(0)}</span>
            <button className="ctx-btn" title="Bigger" onClick={() => patchText({ fontSize: soleText.fontSize + 2 })}>
              <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"><path d="M10 5v10M5 10h10"/></svg>
            </button>
          </div>
          <span className="ctx-sep" />
          <div className="ctx-group">
            <button className={`ctx-btn${soleText.bold ? ' active' : ''}`} title="Bold" onClick={() => patchText({ bold: !soleText.bold })}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><text x="10" y="15" fontSize="14" fontWeight="800" textAnchor="middle">B</text></svg>
            </button>
            {(['left', 'center', 'right'] as const).map((a) => (
              <button key={a} className={`ctx-btn${(soleText.align ?? 'left') === a ? ' active' : ''}`} title={`Align ${a}`} onClick={() => patchText({ align: a })}>
                <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round">
                  <path d="M4 6h12" />
                  <path d={a === 'left' ? 'M4 10h8' : a === 'right' ? 'M8 10h8' : 'M6 10h8'} />
                  <path d="M4 14h12" />
                </svg>
              </button>
            ))}
            <label className="ctx-swatch" title="Color">
              <input type="color" value={soleText.color ?? '#1d1d1f'} onChange={(e) => patchText({ color: e.target.value })} />
              <span style={{ background: soleText.color ?? '#1d1d1f' }} />
            </label>
          </div>
          <span className="ctx-sep" />
        </>
      )}
      {soleImage && (
        <>
          <div className="ctx-group ctx-opacity">
            <span className="ctx-opacity-label" title="Fade for tracing">Fade</span>
            <input
              type="range" min={0.1} max={1} step={0.05}
              value={soleImage.opacity ?? 1}
              onChange={(e) => useDocumentStore.getState().updateShape(soleImage.id, { opacity: parseFloat(e.target.value) })}
            />
            <span className="ctx-num">{Math.round((soleImage.opacity ?? 1) * 100)}%</span>
          </div>
          <span className="ctx-sep" />
        </>
      )}
      {multi && (
        <>
          <div className="ctx-group">
            {ALIGN_BTNS.map((a) => (
              <button key={a.mode} className="ctx-btn" title={a.title} onClick={() => doAlign(a.mode)}>
                {a.icon}
              </button>
            ))}
          </div>
          <span className="ctx-sep" />
          <div className="ctx-group">
            <button className="ctx-btn" title="Distribute horizontally" onClick={() => doDistribute('h')}>
              <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none"><rect x="2.5" y="6" width="3" height="8" rx="1"/><rect x="8.5" y="6" width="3" height="8" rx="1"/><rect x="14.5" y="6" width="3" height="8" rx="1"/></svg>
            </button>
            <button className="ctx-btn" title="Distribute vertically" onClick={() => doDistribute('v')}>
              <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none"><rect x="6" y="2.5" width="8" height="3" rx="1"/><rect x="6" y="8.5" width="8" height="3" rx="1"/><rect x="6" y="14.5" width="8" height="3" rx="1"/></svg>
            </button>
          </div>
          <span className="ctx-sep" />
        </>
      )}
      {canBool && (
        <>
          <div className="ctx-group">
            {BOOL_BTNS.map((b) => (
              <button key={b.op} className="ctx-btn" title={b.title} onClick={() => doBool(b.op)}>
                {b.icon}
              </button>
            ))}
          </div>
          <span className="ctx-sep" />
        </>
      )}
      <div className="ctx-group">
        {multi && !isGroup && (
          <button className="ctx-btn" title="Group (⌘G)" onClick={group}>
            <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/></svg>
          </button>
        )}
        {isGroup && (
          <button className="ctx-btn" title="Ungroup (⌘⇧G)" onClick={ungroup}>
            <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none" strokeDasharray="2 1.5"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/></svg>
          </button>
        )}
        {canBreak && (
          <button className="ctx-btn" title="Break apart" onClick={doBreak}>
            <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"><path d="M5 5h4M5 5v4M15 15h-4M15 15v-4M11 5h4v4M5 11v4h4"/></svg>
          </button>
        )}
      </div>
      {(multi || canBreak) && <span className="ctx-sep" />}
      <ConstraintChips />
      <span className="ctx-sep" />
      <div className="ctx-group">
        <button className="ctx-btn" title="Duplicate (⌘D)" onClick={duplicate}>
          <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none"><rect x="6.5" y="6.5" width="9" height="9" rx="1.5"/><path d="M4.5 12.5h-.5a1.5 1.5 0 01-1.5-1.5V5a1.5 1.5 0 011.5-1.5h6A1.5 1.5 0 0111 5v.5"/></svg>
        </button>
        <button className="ctx-btn ctx-danger" title="Delete (Del)" onClick={remove}>
          <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/></svg>
        </button>
      </div>
    </div>
  );
}

const BOOL_BTNS: { op: BoolOp; title: string; icon: ReactNode }[] = [
  { op: 'unite', title: 'Union', icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M4 7a3 3 0 013-3h2v5h5v2a3 3 0 01-3 3H7a3 3 0 01-3-3V7z" opacity="0.85"/></svg> },
  { op: 'subtract', title: 'Subtract', icon: <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" fill="none"><path d="M4 7a3 3 0 013-3h4a3 3 0 013 3v1H9a1 1 0 00-1 1v5H7a3 3 0 01-3-3V7z" fill="currentColor" opacity="0.85" stroke="none"/><rect x="8" y="8" width="8" height="8" rx="2"/></svg> },
  { op: 'intersect', title: 'Intersect', icon: <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" fill="none"><rect x="3" y="3" width="9" height="9" rx="2"/><rect x="8" y="8" width="9" height="9" rx="2"/><path d="M8 12h4V8H8z" fill="currentColor" stroke="none"/></svg> },
  { op: 'exclude', title: 'Exclude', icon: <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" fill="none"><rect x="3" y="3" width="9" height="9" rx="2" fill="currentColor" opacity="0.8" stroke="none"/><rect x="8" y="8" width="9" height="9" rx="2" fill="currentColor" opacity="0.8" stroke="none"/><rect x="8" y="8" width="4" height="4" fill="var(--surface)" stroke="none"/></svg> },
];

const ALIGN_BTNS: { mode: AlignMode; title: string; icon: ReactNode }[] = [
  { mode: 'left', title: 'Align left', icon: <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none"><path d="M3 3v14"/><rect x="5" y="5" width="10" height="3" rx="1"/><rect x="5" y="12" width="6" height="3" rx="1"/></svg> },
  { mode: 'hcenter', title: 'Align horizontal centers', icon: <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none"><path d="M10 3v14"/><rect x="5" y="5" width="10" height="3" rx="1"/><rect x="7" y="12" width="6" height="3" rx="1"/></svg> },
  { mode: 'right', title: 'Align right', icon: <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none"><path d="M17 3v14"/><rect x="5" y="5" width="10" height="3" rx="1"/><rect x="9" y="12" width="6" height="3" rx="1"/></svg> },
  { mode: 'top', title: 'Align top', icon: <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none"><path d="M3 3h14"/><rect x="5" y="5" width="3" height="10" rx="1"/><rect x="12" y="5" width="3" height="6" rx="1"/></svg> },
  { mode: 'vcenter', title: 'Align vertical centers', icon: <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none"><path d="M3 10h14"/><rect x="5" y="5" width="3" height="10" rx="1"/><rect x="12" y="7" width="3" height="6" rx="1"/></svg> },
  { mode: 'bottom', title: 'Align bottom', icon: <svg width="20" height="20" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" fill="none"><path d="M3 17h14"/><rect x="5" y="5" width="3" height="10" rx="1"/><rect x="12" y="9" width="3" height="6" rx="1"/></svg> },
];
