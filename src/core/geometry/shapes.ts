/** Document-model shape types (UI_UX_SPEC §2). All coordinates are in mm. */

export type ShapeId = string;

export interface RectangleShape {
  id: ShapeId;
  groupId?: ShapeId;
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
  rotation: number; // degrees, about the rect center
}

export interface CircleShape {
  id: ShapeId;
  groupId?: ShapeId;
  type: 'circle';
  cx: number;
  cy: number;
  r: number;
}

export interface LineShape {
  id: ShapeId;
  groupId?: ShapeId;
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Pt {
  x: number;
  y: number;
}

export interface ArcShape {
  id: ShapeId;
  groupId?: ShapeId;
  type: 'arc';
  from: Pt;
  through: Pt;
  to: Pt;
}

/** A node in a polyline/bezier path. `hi`/`ho` are handle offsets (mm) relative
 *  to the node; absent = a sharp corner. */
export interface PathNode {
  x: number;
  y: number;
  hiX?: number;
  hiY?: number;
  hoX?: number;
  hoY?: number;
}

export interface PathShape {
  id: ShapeId;
  groupId?: ShapeId;
  type: 'path';
  nodes: PathNode[];
  closed: boolean;
}

/** Text label. `x`,`y` is the top-left of the text box; `align` justifies the
 *  text within / about that anchor. Font size is in mm. */
export interface TextShape {
  id: ShapeId;
  groupId?: ShapeId;
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number; // mm
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
  rotation?: number; // degrees, about the box center
}

/** A placed raster image (reference layer / tracing). `href` is a data URL.
 *  `x`,`y` is the top-left; `opacity` 0–1 dims it for tracing over. */
export interface ImageShape {
  id: ShapeId;
  groupId?: ShapeId;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  href: string;
  opacity?: number; // 0–1, default 1
  rotation?: number; // degrees, about the box center
}

export type Shape =
  | RectangleShape
  | CircleShape
  | LineShape
  | ArcShape
  | PathShape
  | TextShape
  | ImageShape;

/** Rough text metrics (mm) without a DOM. Good enough for selection bounds;
 *  the renderer uses true Paper.js metrics for the visible glyphs. */
export function estimateTextSize(t: TextShape): { width: number; height: number } {
  const charW = t.fontSize * (t.bold ? 0.62 : 0.55);
  const width = Math.max(t.fontSize * 0.6, (t.text.length || 1) * charW);
  const height = t.fontSize * 1.2;
  return { width, height };
}

let counter = 0;
export function newId(): ShapeId {
  counter += 1;
  return `s${Date.now().toString(36)}_${counter}`;
}

/** Translate a shape by (dx, dy) mm, returning a new shape. */
export function translateShape(s: Shape, dx: number, dy: number): Shape {
  switch (s.type) {
    case 'rectangle':
      return { ...s, x: s.x + dx, y: s.y + dy };
    case 'circle':
      return { ...s, cx: s.cx + dx, cy: s.cy + dy };
    case 'line':
      return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
    case 'arc':
      return {
        ...s,
        from: { x: s.from.x + dx, y: s.from.y + dy },
        through: { x: s.through.x + dx, y: s.through.y + dy },
        to: { x: s.to.x + dx, y: s.to.y + dy },
      };
    case 'path':
      return {
        ...s,
        nodes: s.nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy })),
      };
    case 'text':
      return { ...s, x: s.x + dx, y: s.y + dy };
    case 'image':
      return { ...s, x: s.x + dx, y: s.y + dy };
  }
}
