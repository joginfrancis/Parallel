import paper from 'paper';
import { type Shape, type TextShape, type ImageShape, estimateTextSize } from '../../core/geometry/shapes';

const STROKE = '#3b82f6'; // selection blue (UI_UX_SPEC §9)
const FILL = new paper.Color(0x3b / 255, 0x82 / 255, 0xf6 / 255, 0.09);
const STROKE_PX = 1.6;

/**
 * Build a Paper item for a shape. Stroke is kept constant in screen pixels
 * (`strokeScaling = false`) so geometry looks crisp at any zoom.
 */
export function renderShape(s: Shape): paper.Item {
  if (s.type === 'text') return renderText(s);
  if (s.type === 'image') return renderImage(s);
  let item: paper.Path;
  switch (s.type) {
    case 'rectangle': {
      item = new paper.Path.Rectangle({
        point: [s.x, s.y],
        size: [s.width, s.height],
        radius: s.cornerRadius || 0,
      });
      item.fillColor = FILL;
      if (s.rotation) item.rotate(s.rotation);
      break;
    }
    case 'circle': {
      item = new paper.Path.Circle({ center: [s.cx, s.cy], radius: s.r });
      item.fillColor = FILL;
      break;
    }
    case 'line': {
      item = new paper.Path.Line([s.x1, s.y1], [s.x2, s.y2]);
      break;
    }
    case 'arc': {
      item = new paper.Path.Arc(
        [s.from.x, s.from.y],
        [s.through.x, s.through.y],
        [s.to.x, s.to.y]
      );
      break;
    }
    case 'path': {
      const path = new paper.Path();
      for (const n of s.nodes) {
        path.add(
          new paper.Segment(
            new paper.Point(n.x, n.y),
            n.hiX != null ? new paper.Point(n.hiX, n.hiY!) : undefined,
            n.hoX != null ? new paper.Point(n.hoX, n.hoY!) : undefined
          )
        );
      }
      path.closed = s.closed;
      if (s.closed) path.fillColor = FILL;
      item = path;
      break;
    }
  }
  item.strokeColor = new paper.Color(STROKE);
  item.strokeWidth = STROKE_PX;
  item.strokeScaling = false;
  item.strokeCap = 'round';
  item.strokeJoin = 'round';
  item.data.id = s.id;
  return item;
}

/** Render a text label as a Paper PointText. `x,y` is the box top-left; we drop
 *  the baseline by ~0.8em and justify about the anchor per `align`. */
function renderText(s: TextShape): paper.Item {
  const { width } = estimateTextSize(s);
  const align = s.align ?? 'left';
  const anchorX = align === 'center' ? s.x + width / 2 : align === 'right' ? s.x + width : s.x;
  const t = new paper.PointText({
    point: [anchorX, s.y + s.fontSize * 0.8],
    content: s.text || ' ',
    fillColor: s.color || '#1d1d1f',
    fontSize: s.fontSize,
    fontWeight: s.bold ? 'bold' : 'normal',
    justification: align,
  });
  if (s.rotation) t.rotate(s.rotation, new paper.Point(s.x + width / 2, s.y + s.fontSize * 0.6));
  t.data.id = s.id;
  return t;
}

/** Render a placed raster image. The Raster loads async; we fit it to the box
 *  (and apply rotation) on load so geometry is driven by the model, not metrics. */
function renderImage(s: ImageShape): paper.Item {
  const group = new paper.Group();
  group.data.id = s.id;
  const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
  const raster = new paper.Raster({ source: s.href, crossOrigin: 'anonymous' });
  raster.opacity = s.opacity ?? 1;
  const fit = () => {
    raster.bounds = new paper.Rectangle(s.x, s.y, s.width, s.height);
    if (s.rotation) raster.rotate(s.rotation, new paper.Point(cx, cy));
  };
  raster.onLoad = fit;
  if (raster.loaded) fit(); // cached data URLs may already be ready
  group.addChild(raster);
  return group;
}
