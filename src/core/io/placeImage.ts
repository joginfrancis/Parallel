import { newId, type ImageShape } from '../geometry/shapes';
import { useDocumentStore } from '../../store/documentStore';
import { useSelectionStore } from '../../store/selectionStore';
import { useFeedbackStore } from '../../store/feedbackStore';

/** Largest dimension (mm) a freshly-placed image is scaled to fit. */
const TARGET_MM = 120;

/**
 * Open a file picker, read the chosen image as a data URL, and place it as an
 * ImageShape centered on `at` (project mm), scaled so its longest side is
 * ~120mm. Selects the new shape. Used by the Image tool.
 */
export function pickAndPlaceImage(at: { x: number; y: number }) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  input.onchange = () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const href = String(reader.result ?? '');
      const img = new Image();
      img.onload = () => {
        const nw = img.naturalWidth || 1;
        const nh = img.naturalHeight || 1;
        const scale = TARGET_MM / Math.max(nw, nh);
        const width = nw * scale;
        const height = nh * scale;
        const shape: ImageShape = {
          id: newId(), type: 'image',
          x: at.x - width / 2, y: at.y - height / 2,
          width, height, href, opacity: 1,
        };
        useDocumentStore.getState().addShape(shape);
        useSelectionStore.getState().set([shape.id]);
      };
      img.onerror = () =>
        useFeedbackStore.getState().notify("Hmm, I couldn't read that image.");
      img.src = href;
    };
    reader.readAsDataURL(file);
  };
  document.body.appendChild(input);
  input.click();
}
