// The bridge bootstrap must stay the first import: it registers the message listener before anything else runs.
import '@zenwave360/vistas-eventflow-page/bootstrap';
import '@zenwave360/vistas-eventflow-page/page.css';
import './toolbar.css';
import { createRoot } from 'react-dom/client';
import { EventFlowPage, devFixtures, labelsChangedMessage, lanesChangedMessage, postToHost, savePositionsMessage, variantChangedMessage, viewModeChangedMessage } from '@zenwave360/vistas-eventflow-page';
import { LanesControl } from './LanesControl';
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
    statusBar={({ viewMode, lanesActive, savedPositions, savePositionsFailure }) => (viewMode === 'flow' && lanesActive
      ? <span className="status-message" role="status">Lanes use automatic layout; saved positions are not applied</span>
      : viewMode === 'flow' && (savedPositions?.exists || savePositionsFailure !== undefined) ? <SavedPositionsStatus saved={savedPositions} failure={savePositionsFailure} /> : null)}
  >
    {({ viewMode, setViewMode, variants, variantId, setVariantId, canSavePositions, currentPositions, markPositionsSaved, humanizeLabels, setHumanizeLabels, lanes, setLanes, lanesActive, lanesSupported }) => (
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
        {viewMode === 'flow' && lanesSupported && <LanesControl lanes={lanes} onUserChange={(next) => {
          if (next === lanes) return;
          setLanes(next);
          postToHost(lanesChangedMessage(next));
        }} />}
        <ViewSelector
          viewMode={viewMode}
          onUserChange={(next) => {
            if (next === viewMode) return;
            setViewMode(next);
            postToHost(viewModeChangedMessage(next));
          }}
        />
        {(canSavePositions || (viewMode === 'flow' && lanesActive)) && (
          <SavePositionsButton
            disabled={lanesActive}
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
