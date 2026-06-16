import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';

// Dev-only: expose stores for debugging/inspection from the browser console.
if ((import.meta as any).env?.DEV) {
  import('./store/documentStore').then((m) => ((window as any).docStore = m.useDocumentStore));
  import('./store/constraintStore').then((m) => ((window as any).conStore = m.useConstraintStore));
  import('./store/selectionStore').then((m) => ((window as any).selStore = m.useSelectionStore));
  import('./store/feedbackStore').then((m) => ((window as any).fbStore = m.useFeedbackStore));
  import('./store/toolStore').then((m) => ((window as any).toolStore = m.useToolStore));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
