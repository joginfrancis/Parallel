import { type Shape, type ShapeId } from '../../core/geometry/shapes';
import { renderShape } from './renderShape';

/**
 * Rebuild the content layer from the document model. Rebuilds all items on each
 * change (simple + correct); later passes can diff by id for perf. Selection
 * chrome (handles/box) is drawn separately on the overlay layer (Pass 3), so
 * this only renders geometry.
 */
export function reconcile(
  layer: paper.Layer,
  shapes: Shape[],
  _selected: ShapeId[]
) {
  layer.removeChildren();
  for (const s of shapes) {
    layer.addChild(renderShape(s));
  }
}
