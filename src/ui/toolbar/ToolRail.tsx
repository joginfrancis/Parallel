import type { ReactNode } from 'react';
import { useToolStore, type ToolId } from '../../store/toolStore';

/** Icon set for the 8 permanent tools (UI_UX_SPEC §1.2), drawn as inline SVG. */
const TOOLS: { id: ToolId; label: string; path: ReactNode }[] = [
  { id: 'select', label: 'Select', path: <path d="M5 3l13 7-5.5 1.8L9 18 5 3z" /> },
  { id: 'line', label: 'Line', path: <line x1="4" y1="18" x2="18" y2="4" /> },
  { id: 'arc', label: 'Arc', path: <path d="M4 17a13 13 0 0114-13" /> },
  { id: 'circle', label: 'Circle', path: <circle cx="11" cy="11" r="7.5" /> },
  { id: 'rectangle', label: 'Rectangle', path: <rect x="3.5" y="5" width="15" height="12" rx="1.5" /> },
  { id: 'pen', label: 'Pen', path: <path d="M4 18c5-1 4-9 8-9s3 5 6 4" /> },
  { id: 'text', label: 'Text', path: <path d="M4 5h14M11 5v13" /> },
  { id: 'image', label: 'Image', path: <g><rect x="3.5" y="4.5" width="15" height="13" rx="2" /><circle cx="8" cy="9" r="1.6" /><path d="M5 16l4-4 3 3 3-3 3 3" /></g> },
];

export function ToolRail() {
  const active = useToolStore((s) => s.active);
  const setTool = useToolStore((s) => s.setTool);

  return (
    <div className="tool-rail">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`tool-btn${active === t.id ? ' active' : ''}`}
          title={t.label}
          aria-label={t.label}
          aria-pressed={active === t.id}
          onClick={() => setTool(t.id)}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
            stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round">
            {t.path}
          </svg>
        </button>
      ))}
    </div>
  );
}
