import { PaperCanvas } from './editor/canvas/PaperCanvas';
import { TopBar } from './ui/toolbar/TopBar';
import { ToolRail } from './ui/toolbar/ToolRail';
import { CanvasOverlays } from './ui/CanvasOverlays';
import { ContextToolbar } from './ui/context-toolbar/ContextToolbar';
import { ObjectLibrary } from './ui/panels/ObjectLibrary';
import { ExportPanel } from './ui/panels/ExportPanel';
import { DimensionEditor } from './ui/DimensionEditor';
import { TextEditor } from './ui/TextEditor';
import { ConstraintFeedback } from './ui/ConstraintFeedback';
import './styles/app.css';

export default function App() {
  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        <ToolRail />
        <div className="canvas-stage">
          <PaperCanvas />
          <CanvasOverlays />
          <ContextToolbar />
          <ConstraintFeedback />
          <ObjectLibrary />
        </div>
      </div>
      <DimensionEditor />
      <TextEditor />
      <ExportPanel />
    </div>
  );
}
