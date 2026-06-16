import { useConstraintStore } from '../../store/constraintStore';
import { useSelectionStore } from '../../store/selectionStore';
import { useDocumentStore } from '../../store/documentStore';
import {
  constraintShapeIds,
  constraintLabel,
  newConstraintId,
  shapePointRefs,
  type Constraint,
} from '../../core/constraints/model';

/**
 * Shows applied constraint tags for the selected shapes + a lock button.
 * Tags are clickable (remove constraint). Lock toggles a fixed constraint.
 */
export function ConstraintChips() {
  const selected = useSelectionStore((s) => s.selected);
  const constraints = useConstraintStore((s) => s.constraints);
  const shapes = useDocumentStore((s) => s.shapes);

  if (selected.length === 0) return null;

  const selSet = new Set(selected);
  const relevant = constraints.filter((c) =>
    constraintShapeIds(c).some((id) => selSet.has(id))
  );

  if (relevant.length === 0 && selected.length !== 1) return null;

  const remove = (id: string) => useConstraintStore.getState().remove(id);

  const toggleLock = () => {
    if (selected.length !== 1) return;
    const shape = shapes.find((s) => s.id === selected[0]);
    if (!shape) return;
    const refs = shapePointRefs(shape);
    if (refs.length === 0) return;

    // Check if all points are already locked
    const lockedIds: string[] = [];
    for (const c of constraints) {
      if (c.type === 'fixed' && c.ref.shape === selected[0]) {
        lockedIds.push(c.id);
      }
    }

    if (lockedIds.length > 0) {
      // Unlock — remove all fixed constraints for this shape
      for (const id of lockedIds) remove(id);
    } else {
      // Lock — pin each point at its current position
      const newConstraints: Constraint[] = refs.map((r) => ({
        id: newConstraintId(),
        type: 'fixed' as const,
        ref: r.ref,
        pos: { x: r.pos.x, y: r.pos.y },
      }));
      useConstraintStore.getState().addMany(newConstraints);
    }
  };

  const isLocked = selected.length === 1 &&
    constraints.some((c) => c.type === 'fixed' && c.ref.shape === selected[0]);

  return (
    <>
      {relevant.length > 0 && (
        <div className="ctx-group">
          {relevant.map((c) => (
            <button
              key={c.id}
              className="ctx-btn ctx-constraint-chip"
              title={`Remove "${constraintLabel(c)}" constraint`}
              onClick={() => remove(c.id)}
            >
              <span className="constraint-dot" />
              {constraintLabel(c)}
              <span className="constraint-x">×</span>
            </button>
          ))}
        </div>
      )}
      {selected.length === 1 && (
        <div className="ctx-group">
          <button
            className={`ctx-btn ${isLocked ? 'ctx-locked' : ''}`}
            title={isLocked ? 'Unlock shape' : 'Lock shape in place'}
            onClick={toggleLock}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {isLocked ? (
                <>
                  <rect x="3" y="7" width="10" height="7" rx="1.5" />
                  <path d="M5 7V5a3 3 0 016 0v2" />
                </>
              ) : (
                <>
                  <rect x="3" y="7" width="10" height="7" rx="1.5" />
                  <path d="M5 7V5a3 3 0 016 0" />
                </>
              )}
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
