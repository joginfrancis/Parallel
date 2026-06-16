import { create } from 'zustand';

/**
 * Transient, kid-friendly status messages (e.g. over-constrained warnings).
 * Never shows CAD jargon or degrees-of-freedom counts — just plain language.
 */
interface FeedbackState {
  message: string | null;
  /** Show a message; auto-clears after `ttl` ms (0 = sticky until replaced). */
  notify: (message: string, ttl?: number) => void;
  clear: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useFeedbackStore = create<FeedbackState>()((set) => ({
  message: null,
  notify: (message, ttl = 2500) => {
    if (timer) clearTimeout(timer);
    set({ message });
    if (ttl > 0) {
      timer = setTimeout(() => set({ message: null }), ttl);
    }
  },
  clear: () => {
    if (timer) clearTimeout(timer);
    set({ message: null });
  },
}));
