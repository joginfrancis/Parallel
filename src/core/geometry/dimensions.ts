import { type Shape, type Pt } from './shapes';
import { getHandles, arcInfo } from './transform';

/**
 * Editable dimensions (UI_UX_SPEC §5). Each shape exposes a set of named,
 * editable values; setting one drives the geometry. Positions are in project
 * (mm) coords; `dir` is a unit vector pointing "outward" so the overlay can
 * offset the chip clear of the shape.
 */
export type DimField =
  | 'width'
  | 'height'
  | 'diameter'
  | 'length'
  | 'angle'
  | 'radius';

export interface DimChip {
  field: DimField;
  value: number;
  /** Display text (with unit). */
  text: string;
  at: Pt;
  dir: Pt;
}

const unit = (a: Pt, b: Pt): Pt => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const m = Math.hypot(dx, dy) || 1;
  return { x: dx / m, y: dy / m };
};

function rectCenter(s: { x: number; y: number; width: number; height: number }): Pt {
  return { x: s.x + s.width / 2, y: s.y + s.height / 2 };
}

/** The editable dimension chips for a shape (empty if none yet supported). */
export function dimensionChips(shape: Shape): DimChip[] {
  switch (shape.type) {
    case 'rectangle': {
      const handles = getHandles(shape, 1);
      const n = handles.find((h) => h.key === 'n')!.pos;
      const e = handles.find((h) => h.key === 'e')!.pos;
      const c = rectCenter(shape);
      return [
        {
          field: 'width',
          value: shape.width,
          text: `${shape.width.toFixed(0)} mm`,
          at: n,
          dir: unit(c, n),
        },
        {
          field: 'height',
          value: shape.height,
          text: `${shape.height.toFixed(0)} mm`,
          at: e,
          dir: unit(c, e),
        },
      ];
    }
    case 'circle':
      return [
        {
          field: 'diameter',
          value: shape.r * 2,
          text: `Ø ${(shape.r * 2).toFixed(0)} mm`,
          at: { x: shape.cx, y: shape.cy + shape.r },
          dir: { x: 0, y: 1 },
        },
      ];
    case 'line': {
      const len = Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1);
      let deg = (Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1) * 180) / Math.PI;
      deg = ((deg % 360) + 360) % 360;
      const mid = { x: (shape.x1 + shape.x2) / 2, y: (shape.y1 + shape.y2) / 2 };
      return [
        { field: 'length', value: len, text: `${len.toFixed(0)} mm`, at: mid, dir: { x: 0, y: -1 } },
        {
          field: 'angle',
          value: deg,
          text: `${deg.toFixed(0)}°`,
          at: { x: shape.x1, y: shape.y1 },
          dir: { x: 0, y: 1 },
        },
      ];
    }
    case 'arc': {
      const { r } = arcInfo(shape.from, shape.through, shape.to);
      const mid = {
        x: (shape.from.x + shape.to.x) / 2,
        y: (shape.from.y + shape.to.y) / 2,
      };
      return [
        {
          field: 'radius',
          value: r,
          text: `R ${r.toFixed(0)} mm`,
          at: { ...shape.through },
          dir: unit(mid, shape.through),
        },
      ];
    }
    default:
      return []; // path editing comes later
  }
}

/** Apply a new value for a dimension field, returning a shape patch. */
export function setDimension(shape: Shape, field: DimField, value: number): Partial<Shape> {
  const v = Math.max(value, 0.1);
  if (shape.type === 'rectangle') {
    const c = rectCenter(shape);
    if (field === 'width') return { x: c.x - v / 2, width: v };
    if (field === 'height') return { y: c.y - v / 2, height: v };
  }
  if (shape.type === 'circle') {
    if (field === 'diameter') return { r: v / 2 };
    if (field === 'radius') return { r: v };
  }
  if (shape.type === 'line') {
    const ang = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
    if (field === 'length') {
      return { x2: shape.x1 + Math.cos(ang) * v, y2: shape.y1 + Math.sin(ang) * v };
    }
    if (field === 'angle') {
      const len = Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1);
      const rad = (value * Math.PI) / 180;
      return { x2: shape.x1 + Math.cos(rad) * len, y2: shape.y1 + Math.sin(rad) * len };
    }
  }
  if (shape.type === 'arc' && field === 'radius') {
    const { from, to, through } = shape;
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const c = Math.hypot(to.x - from.x, to.y - from.y) / 2; // half-chord
    const r = Math.max(v, c); // a chord can't exceed the diameter
    const chord = unit(from, to);
    const perp = { x: -chord.y, y: chord.x };
    const side = Math.sign((through.x - mid.x) * perp.x + (through.y - mid.y) * perp.y) || 1;
    const sagitta = r - Math.sqrt(Math.max(r * r - c * c, 0)); // minor-arc apex height
    return {
      through: { x: mid.x + side * perp.x * sagitta, y: mid.y + side * perp.y * sagitta },
    };
  }
  return {};
}
