import paper from 'paper';
import { type Shape, type PathShape, type PathNode, newId } from './shapes';

export type BoolOp = 'unite' | 'subtract' | 'intersect' | 'exclude';

/** Build a closed Paper path for a shape, or null if it has no fillable area. */
function toClosedPath(s: Shape): paper.PathItem | null {
  switch (s.type) {
    case 'rectangle': {
      const p = new paper.Path.Rectangle({
        point: [s.x, s.y],
        size: [s.width, s.height],
        radius: s.cornerRadius || 0,
      });
      if (s.rotation) p.rotate(s.rotation, new paper.Point(s.x + s.width / 2, s.y + s.height / 2));
      return p;
    }
    case 'circle':
      return new paper.Path.Circle({ center: [s.cx, s.cy], radius: s.r });
    case 'path': {
      if (!s.closed || s.nodes.length < 3) return null;
      const p = new paper.Path();
      for (const n of s.nodes) {
        p.add(
          new paper.Segment(
            new paper.Point(n.x, n.y),
            n.hiX != null ? new paper.Point(n.hiX, n.hiY!) : undefined,
            n.hoX != null ? new paper.Point(n.hoX, n.hoY!) : undefined
          )
        );
      }
      p.closed = true;
      return p;
    }
    default:
      return null; // lines / arcs / open paths have no area
  }
}

function pathToShape(p: paper.Path): PathShape {
  const nodes: PathNode[] = p.segments.map((seg) => {
    const n: PathNode = { x: seg.point.x, y: seg.point.y };
    if (seg.handleIn.length > 1e-6) { n.hiX = seg.handleIn.x; n.hiY = seg.handleIn.y; }
    if (seg.handleOut.length > 1e-6) { n.hoX = seg.handleOut.x; n.hoY = seg.handleOut.y; }
    return n;
  });
  return { id: newId(), type: 'path', nodes, closed: true };
}

function resultToShapes(result: paper.PathItem): Shape[] {
  const out: Shape[] = [];
  const collect = (item: paper.Item) => {
    if (item instanceof paper.Path) {
      if (item.segments.length >= 2) out.push(pathToShape(item));
    } else if (item.children) {
      item.children.forEach(collect);
    }
  };
  collect(result);
  return out;
}

/**
 * Apply a boolean op across the given shapes (folded pairwise), returning the
 * resulting shape(s). Shapes with no area (lines/arcs) are ignored. Uses
 * Paper.js's built-in path booleans (UI_UX_SPEC §4.3).
 */
export function booleanOp(shapes: Shape[], op: BoolOp): Shape[] {
  const temps: paper.PathItem[] = [];
  const paths = shapes.map(toClosedPath).filter((p): p is paper.PathItem => !!p);
  temps.push(...paths);
  if (paths.length < 2) {
    temps.forEach((t) => t.remove());
    return [];
  }
  let acc: paper.PathItem = paths[0];
  for (let i = 1; i < paths.length; i++) {
    const next = acc[op](paths[i]) as paper.PathItem;
    temps.push(next);
    acc = next;
  }
  const result = resultToShapes(acc);
  temps.forEach((t) => t.remove());
  return result;
}
