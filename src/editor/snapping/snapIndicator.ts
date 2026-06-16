import paper from 'paper';
import { type Pt } from '../../core/geometry/shapes';
import { type Guide } from './smartGuides';

const GUIDE = '#ff4da6'; // magenta = system helping (UI_UX_SPEC §6.1, §9)

/** Draw a small magenta diamond at an active snap point (or clear when null). */
export function drawSnapMarker(layer: paper.Layer, pt: Pt | null, zoom: number) {
  layer.removeChildren();
  if (!pt) return;
  layer.activate();
  const r = 5 / zoom;
  const d = new paper.Path([
    new paper.Point(pt.x, pt.y - r),
    new paper.Point(pt.x + r, pt.y),
    new paper.Point(pt.x, pt.y + r),
    new paper.Point(pt.x - r, pt.y),
  ]);
  d.closed = true;
  d.strokeColor = new paper.Color(GUIDE);
  d.strokeWidth = 1.5;
  d.strokeScaling = false;
}

const SELECTION = '#3b82f6';

/** Draw the translucent blue marquee selection rectangle (or clear when null). */
export function drawMarquee(
  layer: paper.Layer,
  rect: { x: number; y: number; w: number; h: number } | null
) {
  layer.removeChildren();
  if (!rect || (rect.w === 0 && rect.h === 0)) return;
  layer.activate();
  const r = new paper.Path.Rectangle({
    point: [rect.x, rect.y],
    size: [rect.w, rect.h],
  });
  r.strokeColor = new paper.Color(SELECTION);
  r.strokeWidth = 1;
  r.strokeScaling = false;
  r.fillColor = new paper.Color(0x3b / 255, 0x82 / 255, 0xf6 / 255, 0.08);
}

/** Draw magenta alignment guide lines (or clear when empty). */
export function drawGuides(layer: paper.Layer, guides: Guide[], zoom: number) {
  layer.removeChildren();
  if (!guides.length) return;
  layer.activate();
  for (const g of guides) {
    const line = new paper.Path.Line(
      new paper.Point(g.x1, g.y1),
      new paper.Point(g.x2, g.y2)
    );
    line.strokeColor = new paper.Color(GUIDE);
    line.strokeWidth = 1;
    line.strokeScaling = false;
    const dash = 4 / zoom;
    line.dashArray = [dash, dash];
  }
}
