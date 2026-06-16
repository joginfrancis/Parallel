import paper from 'paper';

/** Visual styling for the dot grid + origin axes. */
const GRID_COLOR = '#eaeaea';
const AXIS_COLOR = '#ff4da6';

/**
 * Pick a "nice" grid spacing (in mm) so that on-screen dot spacing stays in a
 * comfortable range regardless of zoom. Steps follow a 1-2-5 progression.
 */
function niceSpacingMm(zoomPpmm: number): number {
  const targetPx = 24; // desired on-screen gap between dots
  const rawMm = targetPx / zoomPpmm;
  const pow = Math.pow(10, Math.floor(Math.log10(rawMm)));
  const frac = rawMm / pow;
  const step = frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10;
  return step * pow;
}

/**
 * Rebuild the grid + axes to cover the current view bounds. Cheap enough to call
 * on every pan/zoom for Pass 1; later we can throttle or cache.
 */
export function drawGrid(layer: paper.Layer, zoomPpmm: number) {
  layer.removeChildren();
  layer.activate();

  const bounds = paper.view.bounds; // in project (mm) coords
  const spacing = niceSpacingMm(zoomPpmm);
  const dotRadius = 0.9 / zoomPpmm; // ~0.9px on screen

  const startX = Math.floor(bounds.left / spacing) * spacing;
  const startY = Math.floor(bounds.top / spacing) * spacing;

  const dots = new paper.CompoundPath({ children: [] });
  for (let x = startX; x <= bounds.right; x += spacing) {
    for (let y = startY; y <= bounds.bottom; y += spacing) {
      dots.addChild(
        new paper.Path.Circle(new paper.Point(x, y), dotRadius)
      );
    }
  }
  dots.fillColor = new paper.Color(GRID_COLOR);

  // Origin axes (magenta, faint) — UI_UX_SPEC §9.
  const axisWidth = 1 / zoomPpmm;
  const xAxis = new paper.Path.Line(
    new paper.Point(bounds.left, 0),
    new paper.Point(bounds.right, 0)
  );
  const yAxis = new paper.Path.Line(
    new paper.Point(0, bounds.top),
    new paper.Point(0, bounds.bottom)
  );
  for (const axis of [xAxis, yAxis]) {
    axis.strokeColor = new paper.Color(AXIS_COLOR);
    axis.strokeColor.alpha = 0.35;
    axis.strokeWidth = axisWidth;
  }
}
