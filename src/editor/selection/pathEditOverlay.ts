import paper from 'paper';
import { type PathShape } from '../../core/geometry/shapes';
import { getEditHandles } from '../../core/geometry/pathEdit';
import { HANDLE_RADIUS_PX as _R } from '../../core/geometry/transform';

const BLUE = '#3b82f6';
const WHITE = '#ffffff';

/**
 * Draw point-edit chrome for a path: control-handle lines + round control dots,
 * and square anchors. `hoverKey` highlights one handle. (UI_UX_SPEC §7)
 */
export function drawPathEdit(
  layer: paper.Layer,
  path: PathShape,
  zoom: number,
  hoverKey?: string | null
) {
  layer.removeChildren();
  layer.activate();
  const blue = new paper.Color(BLUE);
  const handles = getEditHandles(path);
  const rPx = _R / zoom;

  // Control lines first (under the dots).
  for (const h of handles) {
    if (h.kind === 'control' && h.anchor) {
      const line = new paper.Path.Line(
        new paper.Point(h.anchor.x, h.anchor.y),
        new paper.Point(h.pos.x, h.pos.y)
      );
      line.strokeColor = blue;
      line.strokeWidth = 1;
      line.strokeScaling = false;
    }
  }

  for (const h of handles) {
    const hot = hoverKey != null && h.key === hoverKey;
    let item: paper.Path;
    if (h.kind === 'control') {
      item = new paper.Path.Circle(new paper.Point(h.pos.x, h.pos.y), rPx * 0.85);
      item.fillColor = new paper.Color(hot ? BLUE : WHITE);
    } else {
      const s = rPx * (hot ? 1.3 : 1.1);
      item = new paper.Path.Rectangle({ point: [h.pos.x - s, h.pos.y - s], size: [s * 2, s * 2] });
      item.fillColor = new paper.Color(hot ? BLUE : WHITE);
    }
    item.strokeColor = blue;
    item.strokeWidth = 1.5;
    item.strokeScaling = false;
  }
}
