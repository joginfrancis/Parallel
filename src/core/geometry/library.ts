import { type PathShape, type PathNode, newId } from './shapes';

/** Object Library shape factories (UI_UX_SPEC §7.1). Each returns a closed
 *  PathShape centred at (cx,cy) sized to roughly `size` mm. */

const node = (x: number, y: number): PathNode => ({ x, y });

function make(nodes: PathNode[]): PathShape {
  return { id: newId(), type: 'path', nodes, closed: true };
}

function polygon(cx: number, cy: number, size: number, sides: number, rot = -Math.PI / 2): PathShape {
  const r = size / 2;
  const nodes: PathNode[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * 2 * Math.PI) / sides;
    nodes.push(node(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return make(nodes);
}

function star(cx: number, cy: number, size: number, points = 5): PathShape {
  const outer = size / 2;
  const inner = size / 4.6;
  const nodes: PathNode[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    nodes.push(node(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return make(nodes);
}

function heart(cx: number, cy: number, size: number): PathShape {
  const s = size / 32;
  const nodes: PathNode[] = [];
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    nodes.push(node(cx + x * s, cy + y * s));
  }
  return make(nodes);
}

function arrow(cx: number, cy: number, size: number): PathShape {
  const s = size;
  const pts: [number, number][] = [
    [-0.5, -0.16], [0.1, -0.16], [0.1, -0.36], [0.5, 0], [0.1, 0.36], [0.1, 0.16], [-0.5, 0.16],
  ];
  return make(pts.map(([x, y]) => node(cx + x * s, cy + y * s)));
}

function house(cx: number, cy: number, size: number): PathShape {
  const s = size;
  const pts: [number, number][] = [
    [-0.4, 0.5], [-0.4, -0.12], [-0.5, -0.12], [0, -0.5], [0.5, -0.12], [0.4, -0.12], [0.4, 0.5],
  ];
  return make(pts.map(([x, y]) => node(cx + x * s, cy + y * s)));
}

export interface LibraryItem {
  name: string;
  make: (cx: number, cy: number, size: number) => PathShape;
}

export const LIBRARY: LibraryItem[] = [
  { name: 'Star', make: (x, y, s) => star(x, y, s) },
  { name: 'Heart', make: heart },
  { name: 'Triangle', make: (x, y, s) => polygon(x, y, s, 3) },
  { name: 'Diamond', make: (x, y, s) => polygon(x, y, s, 4) },
  { name: 'Pentagon', make: (x, y, s) => polygon(x, y, s, 5) },
  { name: 'Hexagon', make: (x, y, s) => polygon(x, y, s, 6, 0) },
  { name: 'Arrow', make: arrow },
  { name: 'House', make: house },
];
