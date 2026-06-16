import paper from 'paper';
import { type Shape } from '../../core/geometry/shapes';
import {
  getHandles,
  boundsOf,
  measureLabel,
  HANDLE_RADIUS_PX,
} from '../../core/geometry/transform';
import { dimensionChips } from '../../core/geometry/dimensions';
import { makeLabelChip } from '../canvas/labelChip';

const BLUE = '#3b82f6';
const WHITE = '#ffffff';

/**
 * Draws the selection chrome for a single shape onto the overlay layer:
 * bounding outline, resize handles, rotate handle (with tether), and a live
 * measure label. `hoverKey` highlights one handle/node (hover or active drag).
 * Constant on-screen sizing via `zoom` (UI_UX_SPEC §3.2). `null` clears.
 */
export function drawSelection(
  layer: paper.Layer,
  shape: Shape | null,
  zoom: number,
  hoverKey?: string | null
) {
  layer.removeChildren();
  if (!shape) return;
  layer.activate();

  const blue = new paper.Color(BLUE);
  const handles = getHandles(shape, zoom);
  const rPx = HANDLE_RADIUS_PX / zoom;

  // --- Bounding outline (box shapes only) ---
  if (shape.type === 'rectangle' || shape.type === 'circle') {
    const order = ['nw', 'ne', 'se', 'sw'];
    const corners = order.map((k) => handles.find((h) => h.key === k)!);
    if (corners.every(Boolean)) {
      const outline = new paper.Path({
        segments: corners.map((h) => new paper.Point(h.pos.x, h.pos.y)),
        closed: true,
      });
      outline.strokeColor = blue;
      outline.strokeWidth = 1;
      outline.strokeScaling = false;
    }
  }

  // --- Rotate tether (n handle → rotate handle) ---
  const rot = handles.find((h) => h.kind === 'rotate');
  const nH = handles.find((h) => h.key === 'n');
  if (rot && nH) {
    const tether = new paper.Path.Line(
      new paper.Point(nH.pos.x, nH.pos.y),
      new paper.Point(rot.pos.x, rot.pos.y)
    );
    tether.strokeColor = blue;
    tether.strokeWidth = 1;
    tether.strokeScaling = false;
  }

  // --- Handles ---
  for (const h of handles) {
    const hot = hoverKey != null && h.key === hoverKey;
    let item: paper.Path;
    if (h.kind === 'rotate') {
      item = new paper.Path.Rectangle({
        point: [h.pos.x - rPx, h.pos.y - rPx],
        size: [rPx * 2, rPx * 2],
        radius: rPx * 0.3,
      });
    } else {
      item = new paper.Path.Circle(new paper.Point(h.pos.x, h.pos.y), hot ? rPx * 1.25 : rPx);
    }
    item.fillColor = new paper.Color(hot ? BLUE : WHITE);
    item.strokeColor = blue;
    item.strokeWidth = 1.5;
    item.strokeScaling = false;
  }

  // --- Editable dimension chips (or a plain measure label as fallback) ---
  const chips = dimensionChips(shape);
  if (chips.length) {
    for (const ch of chips) {
      const at = { x: ch.at.x + (ch.dir.x * 16) / zoom, y: ch.at.y + (ch.dir.y * 16) / zoom };
      const chip = makeLabelChip(ch.text, at, zoom);
      chip.data.dimField = ch.field;
      chip.data.dimShape = shape.id;
      chip.data.editable = true;
    }
  } else {
    const label = measureLabel(shape);
    if (label) {
      layer.addChild(makeLabelChip(label.text, { x: label.at.x, y: label.at.y + 16 / zoom }, zoom));
    }
  }
}

/**
 * Multi-selection chrome: a combined bounding box + corner dots. Move-only for
 * now (group resize/rotate is a later phase); count chip shows N items.
 */
export function drawMultiBox(layer: paper.Layer, shapes: Shape[], zoom: number) {
  layer.removeChildren();
  if (shapes.length < 2) return;
  layer.activate();

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) {
    const b = boundsOf(s);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  const blue = new paper.Color(BLUE);
  const box = new paper.Path.Rectangle({
    point: [minX, minY],
    size: [maxX - minX, maxY - minY],
  });
  box.strokeColor = blue;
  box.strokeWidth = 1;
  box.strokeScaling = false;
  box.dashArray = [4 / zoom, 3 / zoom];

  const rPx = HANDLE_RADIUS_PX / zoom;
  for (const [cx, cy] of [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]) {
    const dot = new paper.Path.Circle(new paper.Point(cx, cy), rPx);
    dot.fillColor = new paper.Color(WHITE);
    dot.strokeColor = blue;
    dot.strokeWidth = 1.5;
    dot.strokeScaling = false;
  }
  layer.addChild(
    makeLabelChip(`${shapes.length} items`, { x: (minX + maxX) / 2, y: maxY + 16 / zoom }, zoom)
  );
}
