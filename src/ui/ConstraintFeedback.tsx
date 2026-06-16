import { useFeedbackStore } from '../store/feedbackStore';
import './ConstraintFeedback.css';

/**
 * A small, friendly status toast near the top-center of the canvas. Used for
 * over-constrained warnings and similar plain-language hints (no CAD jargon).
 */
export function ConstraintFeedback() {
  const message = useFeedbackStore((s) => s.message);
  if (!message) return null;
  return (
    <div className="constraint-feedback" role="status">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 5v3.5" />
        <circle cx="8" cy="11" r="0.5" fill="currentColor" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
