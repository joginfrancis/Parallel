import { useEffect, useRef } from 'react';
import paper from 'paper';
import { drawGrid } from './paperGrid';
import { reconcile } from './reconcile';
import { drawSelection, drawMultiBox } from '../selection/selectionOverlay';
import { drawPathEdit } from '../selection/pathEditOverlay';
import { snapPoint } from '../snapping/snapEngine';
import { drawSnapMarker, drawGuides, drawMarquee } from '../snapping/snapIndicator';
import { createToolController } from '../tools/toolController';
import { dimensionChips } from '../../core/geometry/dimensions';
import { useViewStore, BASE_PPMM } from '../../store/viewStore';
import { useToolStore } from '../../store/toolStore';
import { useDocumentStore } from '../../store/documentStore';
import { useSelectionStore } from '../../store/selectionStore';
import { useEditingStore } from '../../store/editingStore';
import { useConstraintStore } from '../../store/constraintStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { useTextEditStore } from '../../store/textEditStore';
import { pickAndPlaceImage } from '../../core/io/placeImage';
import { drawConstraints, drawConstraintHints } from '../selection/constraintOverlay';
import { type Shape } from '../../core/geometry/shapes';
import { type Constraint } from '../../core/constraints/model';

const MIN_PPMM = 0.2;
const MAX_PPMM = 60;

/**
 * Owns the Paper.js project and the single <canvas>. React never re-renders the
 * canvas; Paper draws imperatively. Scope: grid, magenta axes, pan, zoom, and
 * (Pass 2) the draw/select tools + reconciliation from the document model.
 */
export function PaperCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setZoom = useViewStore((s) => s.setZoom);
  const bindControls = useViewStore((s) => s.bindControls);

  useEffect(() => {
    const canvas = canvasRef.current!;
    paper.setup(canvas);

    paper.view.zoom = BASE_PPMM;
    paper.view.center = new paper.Point(0, 0);

    const gridLayer = new paper.Layer();
    const contentLayer = new paper.Layer();
    const overlayLayer = new paper.Layer();
    const snapLayer = new paper.Layer();
    const hintLayer = new paper.Layer(); // transient constraint hints during gestures
    contentLayer.activate();

    const refreshGrid = () => drawGrid(gridLayer, paper.view.zoom);

    let shiftHeld = false; // ortho while drawing / add-to-selection while selecting
    let hoverKey: string | null = null;
    const refreshOverlay = () => {
      const sel = useSelectionStore.getState().selected;
      const editId = useSelectionStore.getState().editPathId;
      const shapes = useDocumentStore.getState().shapes;
      if (editId) {
        const p = shapes.find((s) => s.id === editId);
        if (p && p.type === 'path') {
          drawPathEdit(overlayLayer, p, paper.view.zoom, hoverKey);
          return;
        }
      }
      if (sel.length === 1) {
        drawSelection(overlayLayer, shapes.find((s) => s.id === sel[0]) ?? null, paper.view.zoom, hoverKey);
      } else if (sel.length > 1) {
        drawMultiBox(overlayLayer, shapes.filter((s) => sel.includes(s.id)), paper.view.zoom);
      } else {
        drawSelection(overlayLayer, null, paper.view.zoom);
      }
    };

    // --- Reconcile content + overlay from the document + selection stores ---
    const sync = () => {
      reconcile(
        contentLayer,
        useDocumentStore.getState().shapes,
        useSelectionStore.getState().selected
      );
      refreshOverlay();
      drawConstraints(
        overlayLayer,
        useDocumentStore.getState().shapes,
        useConstraintStore.getState().constraints,
        paper.view.zoom
      );
    };
    refreshGrid();
    sync();
    setZoom(paper.view.zoom);
    const unsubDoc = useDocumentStore.subscribe(sync);
    const unsubSel = useSelectionStore.subscribe(sync);
    const unsubCon = useConstraintStore.subscribe(sync);

    // --- Tool controller (draw + select) ---
    const tools = createToolController({
      layer: contentLayer,
      getTool: () => useToolStore.getState().active,
      setTool: (t) => useToolStore.getState().setTool(t),
      getZoom: () => paper.view.zoom,
      getConstrain: () => shiftHeld,
      getShapes: () => useDocumentStore.getState().shapes,
      getSelection: () => useSelectionStore.getState().selected,
      commitShape: (s) => useDocumentStore.getState().addShape(s),
      updateShape: (id, patch) =>
        useDocumentStore.getState().updateShape(id, patch),
      moveShapes: (ids, dx, dy) =>
        useDocumentStore.getState().moveShapes(ids, dx, dy),
      setSelection: (ids) => useSelectionStore.getState().set(ids),
      clearSelection: () => useSelectionStore.getState().clear(),
      beginInteraction: () => useDocumentStore.getState().beginInteraction(),
      endInteraction: () => useDocumentStore.getState().endInteraction(),
      drawGuides: (guides) => drawGuides(snapLayer, guides, paper.view.zoom),
      drawMarquee: (rect) => drawMarquee(snapLayer, rect),
      getShift: () => shiftHeld,
      getEditPath: () => useSelectionStore.getState().editPathId,
      setEditPath: (id) => useSelectionStore.getState().setEditPath(id),
      getConstraints: () => useConstraintStore.getState().constraints,
      addConstraints: (cs) => useConstraintStore.getState().addMany(cs),
      updateShapeBatch: (patches) => {
        for (const { id, patch } of patches) {
          useDocumentStore.getState().updateShape(id, patch);
        }
      },
      notify: (message) => useFeedbackStore.getState().notify(message),
      drawHints: (shapes: Shape[], candidates: Constraint[]) =>
        drawConstraintHints(hintLayer, shapes, candidates, paper.view.zoom),
      clearHints: () => hintLayer.removeChildren(),
      editText: (id) => {
        const shape = useDocumentStore.getState().shapes.find((s) => s.id === id);
        if (!shape || shape.type !== 'text') return;
        const vp = paper.view.projectToView(new paper.Point(shape.x, shape.y));
        const rect = canvas.getBoundingClientRect();
        useTextEditStore.getState().open({
          shapeId: id,
          x: rect.left + vp.x,
          y: rect.top + vp.y,
          fontPx: shape.fontSize * paper.view.zoom,
        });
      },
      placeImage: (at) => pickAndPlaceImage(at),
    });

    // Cursor reflects the active tool; switching tools cancels any in-progress draw.
    const applyCursor = (tool = useToolStore.getState().active) => {
      canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    };
    applyCursor();
    const unsubTool = useToolStore.subscribe((s) => {
      tools.cancel();
      hoverKey = null;
      clearSnap();
      sync();
      applyCursor(s.active);
    });

    const projPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return paper.view.viewToProject(
        new paper.Point(e.clientX - rect.left, e.clientY - rect.top)
      );
    };
    // Snap a raw project point to nearby geometry key-points (or the grid),
    // excluding the current selection so shapes never snap to themselves. Draws
    // the magenta indicator when a real point-snap occurs.
    // Snap a raw project point. `points` enables snapping to geometry key-points
    // (else grid-only); `exclude` skips shapes (e.g. the ones being moved);
    // `marker` shows the magenta indicator on a real point-snap.
    const snap = (
      p: paper.Point,
      opts: { points?: boolean; marker?: boolean; exclude?: string[] } = {}
    ) => {
      const { points = true, marker = false, exclude = [] } = opts;
      if (!points) {
        drawSnapMarker(snapLayer, null, paper.view.zoom);
        return new paper.Point(Math.round(p.x), Math.round(p.y));
      }
      const res = snapPoint(
        { x: p.x, y: p.y },
        useDocumentStore.getState().shapes,
        exclude,
        paper.view.zoom
      );
      drawSnapMarker(snapLayer, marker && res.pointSnap ? res.point : null, paper.view.zoom);
      return new paper.Point(res.point.x, res.point.y);
    };
    const clearSnap = () => drawSnapMarker(snapLayer, null, paper.view.zoom);

    // Set zoom immediately, keeping `anchor` (pixel coords) fixed.
    const applyZoomExact = (z: number, anchorView: paper.Point | null) => {
      const anchor = anchorView ?? paper.view.center.transform(paper.view.matrix);
      const before = paper.view.viewToProject(anchor);
      paper.view.zoom = z;
      const after = paper.view.viewToProject(anchor);
      paper.view.center = paper.view.center.add(before.subtract(after));
      refreshGrid();
      refreshOverlay();
      setZoom(z);
    };

    // Smooth (eased) zoom: accumulate a target and lerp toward it each frame.
    let zoomRaf: number | null = null;
    let targetZoom = paper.view.zoom;
    let zoomAnchor: paper.Point | null = null;
    const stepZoom = () => {
      const cur = paper.view.zoom;
      const next = cur + (targetZoom - cur) * 0.28;
      if (Math.abs(targetZoom - next) < 0.002) {
        applyZoomExact(targetZoom, zoomAnchor);
        zoomRaf = null;
      } else {
        applyZoomExact(next, zoomAnchor);
        zoomRaf = requestAnimationFrame(stepZoom);
      }
    };
    const smoothZoomBy = (factor: number, anchorView?: paper.Point) => {
      targetZoom = Math.min(MAX_PPMM, Math.max(MIN_PPMM, targetZoom * factor));
      zoomAnchor = anchorView ?? null;
      if (zoomRaf == null) zoomRaf = requestAnimationFrame(stepZoom);
    };

    bindControls({
      zoomBy: (factor) => smoothZoomBy(factor),
      zoomTo: (ppmm) => {
        targetZoom = ppmm;
        applyZoomExact(ppmm, null);
      },
      fit: () => {
        if (zoomRaf != null) cancelAnimationFrame(zoomRaf);
        zoomRaf = null;
        targetZoom = BASE_PPMM;
        paper.view.center = new paper.Point(0, 0);
        applyZoomExact(BASE_PPMM, null);
      },
    });

    // --- Input: pan (space/middle) vs. tools (left button) ---
    let spaceHeld = false;
    let panning = false;
    let pointerDown = false; // a select drag (move/resize/rotate) is in progress
    let lastClient = { x: 0, y: 0 };

    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Shift') shiftHeld = true;
      if (e.code === 'Space') {
        spaceHeld = true;
        canvas.style.cursor = 'grab';
      } else if (e.code === 'Escape') {
        useSelectionStore.getState().setEditPath(null); // exit point-edit mode
        tools.finish(); // commit an in-progress polyline, then drop to Select
        useToolStore.getState().setTool('select');
        sync();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = useSelectionStore.getState().selected;
        if (sel.length) {
          useDocumentStore.getState().removeShapes(sel);
          useSelectionStore.getState().clear();
          e.preventDefault();
        }
      } else if (mod && (e.key === 'd' || e.key === 'D')) {
        const sel = useSelectionStore.getState().selected;
        if (sel.length) {
          const ids = useDocumentStore.getState().duplicateShapes(sel);
          useSelectionStore.getState().set(ids);
        }
        e.preventDefault();
      } else if (mod && (e.key === 'g' || e.key === 'G')) {
        const sel = useSelectionStore.getState().selected;
        if (e.shiftKey) useDocumentStore.getState().ungroupShapes(sel);
        else if (sel.length > 1) useDocumentStore.getState().groupShapes(sel);
        e.preventDefault();
      } else if (mod && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        useDocumentStore.temporal.getState().undo();
        e.preventDefault();
      } else if (
        mod &&
        ((e.key === 'z' || e.key === 'Z') && e.shiftKey || e.key === 'y' || e.key === 'Y')
      ) {
        useDocumentStore.temporal.getState().redo();
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeld = false;
      if (e.code === 'Space') {
        spaceHeld = false;
        canvas.style.cursor = 'default';
      }
    };
    // An editable dimension chip under the pointer → open the inline editor.
    const findConstraintTag = (proj: paper.Point): string | null => {
      const hit = overlayLayer.hitTest(proj, { fill: true, tolerance: 4 / paper.view.zoom });
      let g: paper.Item | null = hit?.item ?? null;
      while (g && !g.data?.constraintId) g = g.parent;
      return g?.data?.constraintId ?? null;
    };

    const findDimChip = (proj: paper.Point): paper.Item | null => {
      const hit = overlayLayer.hitTest(proj, { fill: true, tolerance: 2 / paper.view.zoom });
      let g: paper.Item | null = hit?.item ?? null;
      while (g && !g.data?.dimField) g = g.parent;
      return g?.data?.dimField ? g : null;
    };
    const openDimEditor = (g: paper.Item) => {
      const shapeId = g.data.dimShape as string;
      const field = g.data.dimField;
      const shape = useDocumentStore.getState().shapes.find((s) => s.id === shapeId);
      if (!shape) return;
      const ch = dimensionChips(shape).find((c) => c.field === field);
      if (!ch) return;
      const vp = paper.view.projectToView(g.bounds.center);
      const rect = canvas.getBoundingClientRect();
      useEditingStore.getState().open({
        shapeId,
        field,
        value: ch.value,
        x: rect.left + vp.x,
        y: rect.top + vp.y,
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (spaceHeld || e.button === 1) {
        panning = true;
        lastClient = { x: e.clientX, y: e.clientY };
        canvas.style.cursor = 'grabbing';
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
      if (e.button !== 0) return;
      if (useToolStore.getState().active === 'select') {
        // Click constraint tag → remove it
        const cId = findConstraintTag(projPoint(e));
        if (cId) {
          useConstraintStore.getState().remove(cId);
          return;
        }
        const chip = findDimChip(projPoint(e));
        if (chip) {
          openDimEditor(chip);
          return;
        }
      }
      useEditingStore.getState().close(); // clicking elsewhere closes the editor
      // Select clicks use grid-only snap (don't let placement hijack a click);
      // draw tools snap to all geometry points.
      const drawing = useToolStore.getState().active !== 'select';
      const pt = drawing
        ? snap(projPoint(e), { points: true, marker: true })
        : snap(projPoint(e), { points: false });
      const consumed = tools.down(pt);
      if (consumed) {
        pointerDown = true;
        canvas.setPointerCapture(e.pointerId);
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (panning) {
        const dx = e.clientX - lastClient.x;
        const dy = e.clientY - lastClient.y;
        lastClient = { x: e.clientX, y: e.clientY };
        const z = paper.view.zoom;
        paper.view.center = paper.view.center.subtract(
          new paper.Point(dx / z, dy / z)
        );
        refreshGrid();
        refreshOverlay();
        return;
      }
      // Always drive the tool: live preview between draw clicks, and select drags.
      const drawing = useToolStore.getState().active !== 'select';
      const raw = projPoint(e);
      const style = tools.pointerStyle(raw);
      const transforming =
        pointerDown && (style.cursor.includes('resize') || style.cursor === 'grab');
      let pt: paper.Point;
      if (drawing) {
        pt = snap(raw, { points: true, marker: true }); // snap to all geometry
      } else if (transforming) {
        // Resize/rotate endpoint: snap to other shapes' points (not itself).
        pt = snap(raw, { points: true, marker: true, exclude: useSelectionStore.getState().selected });
      } else {
        // Move (smart guides) / marquee / idle hover → grid only, no point-snap.
        pt = snap(raw, { points: false });
      }
      const prevHover = hoverKey;
      hoverKey = style.hoverKey;
      canvas.style.cursor = style.cursor;
      tools.moveTo(pt); // may trigger sync() → refreshOverlay(hoverKey)
      if (hoverKey !== prevHover) refreshOverlay(); // reflect hover when no store change
    };
    const onPointerUp = (e: PointerEvent) => {
      if (panning) {
        panning = false;
        canvas.style.cursor = spaceHeld ? 'grab' : 'default';
        canvas.releasePointerCapture(e.pointerId);
        return;
      }
      tools.up();
      pointerDown = false;
      if (useToolStore.getState().active === 'select') clearSnap();
      if (canvas.hasPointerCapture?.(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cursorView = new paper.Point(e.clientX - rect.left, e.clientY - rect.top);
      smoothZoomBy(Math.exp(-e.deltaY * 0.0012), cursorView);
    };
    const onDblClick = (e: MouseEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const pt = paper.view.viewToProject(
        new paper.Point(e.clientX - rect.left, e.clientY - rect.top)
      );
      tools.doubleClick(pt);
      sync();
    };
    const onResize = () => refreshGrid();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      if (zoomRaf != null) cancelAnimationFrame(zoomRaf);
      unsubDoc();
      unsubSel();
      unsubCon();
      unsubTool();
      paper.project?.clear();
    };
  }, [setZoom, bindControls]);

  return (
    <canvas
      ref={canvasRef}
      data-paper-resize="true"
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
    />
  );
}
