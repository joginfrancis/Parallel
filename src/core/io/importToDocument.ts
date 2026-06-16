import { useDocumentStore } from '../../store/documentStore';
import { useSelectionStore } from '../../store/selectionStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { svgToShapes } from './svgImport';

/**
 * Parse SVG text and add the resulting shapes to the document as a single undo
 * step, selecting them. Returns the number of shapes added. Surfaces a friendly
 * message and returns 0 when nothing usable was found.
 */
export function importSvgText(svg: string): number {
  const shapes = svgToShapes(svg);
  if (shapes.length === 0) {
    useFeedbackStore.getState().notify("Hmm, I couldn't find any shapes in that file.");
    return 0;
  }
  const ids = useDocumentStore.getState().replaceShapes([], shapes);
  useSelectionStore.getState().set(ids);
  useFeedbackStore.getState().notify(
    `Added ${shapes.length} shape${shapes.length === 1 ? '' : 's'} from your file.`
  );
  return shapes.length;
}

/** Read a File (from a picker or drop) and import it. */
export function importSvgFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => importSvgText(String(reader.result ?? ''));
  reader.readAsText(file);
}
