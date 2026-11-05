// The bridge bootstrap must stay the first import: it registers the message listener before anything else runs.
import '@zenwave360/vistas-eventflow-page/bootstrap';
import '@zenwave360/vistas-eventflow-page/page.css';
import './toolbar.css';
import { createRoot } from 'react-dom/client';
import { EventFlowPage, devFixtures, labelsChangedMessage, postToHost, savePositionsMessage, variantChangedMessage, viewModeChangedMessage } from '@zenwave360/vistas-eventflow-page';
import { HumanizeToggle } from './HumanizeToggle';
import { SavePositionsButton, SavedPositionsStatus } from './SavePositions';
import { VariantSelector } from './VariantSelector';
import { ViewSelector } from './ViewSelector';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element "#root" was not found.');
}

// The page with selectors, for a host with no toolbar inside the editor (VS Code). Zoom and fit are the controls the
// visualizers already draw. Only the user's own choice is reported: both selectors follow a host message silently.
// Choosing a variant does not swap the graph. The page waits for the host's next renderBundle.
createRoot(rootElement).render(
  <EventFlowPage
    initialFlowViewModel={import.meta.env.DEV ? devFixtures.flowViewModel : null}
    initialServiceViewModel={import.meta.env.DEV ? devFixtures.serviceViewModel : null}
    statusBar={({ viewMode, savedPositions }) => (viewMode === 'flow' && savedPositions?.exists ? <SavedPositionsStatus saved={savedPositions} /> : null)}
  >
    {({ viewMode, setViewMode, variants, variantId, setVariantId, canSavePositions, currentPositions, markPositionsSaved, humanizeLabels, setHumanizeLabels }) => (
      <div className="eventflow-toolbar">
        {viewMode === 'flow' && (
          <VariantSelector
            variants={variants}
            variantId={variantId}
            onUserChange={(next) => {
              if (next === variantId) return;
              setVariantId(next);
              postToHost(variantChangedMessage(next));
            }}
          />
        )}
        <HumanizeToggle
          humanize={humanizeLabels}
          onUserChange={(next) => {
            setHumanizeLabels(next);
            postToHost(labelsChangedMessage(next));
          }}
        />
        <ViewSelector
          viewMode={viewMode}
          onUserChange={(next) => {
            if (next === viewMode) return;
            setViewMode(next);
            postToHost(viewModeChangedMessage(next));
          }}
        />
        {canSavePositions && (
          <SavePositionsButton
            onSave={() => {
              const positions = currentPositions();
              if (!positions) return;
              postToHost(savePositionsMessage(positions));
              markPositionsSaved();
            }}
          />
        )}
      </div>
    )}
  </EventFlowPage>
);
