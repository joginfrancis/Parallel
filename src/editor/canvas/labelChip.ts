import paper from 'paper';
import { type Pt } from '../../core/geometry/shapes';

/**
 * A small white rounded label ("chip") used for live dimensions and the
 * selection measure label. Sizes are divided by `zoom` so the chip stays a
 * constant size on screen. Returns a Group (bg + text).
 */
export function makeLabelChip(text: string, at: Pt, zoom: number): paper.Group {
  const fontSize = 11 / zoom;
  const pad = 5 / zoom;
  const t = new paper.PointText({
    point: [at.x, at.y],
    content: text,
    fillColor: '#1f2937',
    fontFamily: 'Inter, sans-serif',
    fontSize,
    justification: 'center',
  });
  const b = t.bounds;
  const bg = new paper.Path.Rectangle({
    point: [b.x - pad, b.y - pad / 2],
    size: [b.width + pad * 2, b.height + pad],
    radius: 4 / zoom,
  });
  bg.fillColor = new paper.Color('#ffffff');
  bg.strokeColor = new paper.Color('#ececec');
  bg.strokeWidth = 1;
  bg.strokeScaling = false;
  return new paper.Group([bg, t]);
}
