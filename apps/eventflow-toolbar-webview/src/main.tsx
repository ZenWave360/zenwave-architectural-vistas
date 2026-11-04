// The bridge bootstrap must stay the first import: it registers the message listener before anything else runs.
import '@zenwave360/vistas-eventflow-page/bootstrap';
import '@zenwave360/vistas-eventflow-page/page.css';
import './toolbar.css';
import { createRoot } from 'react-dom/client';
import { EventFlowPage, devFixtures, postToHost, variantChangedMessage, viewModeChangedMessage } from '@zenwave360/vistas-eventflow-page';
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
  >
    {({ viewMode, setViewMode, variants, variantId, setVariantId }) => (
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
        <ViewSelector
          viewMode={viewMode}
          onUserChange={(next) => {
            if (next === viewMode) return;
            setViewMode(next);
            postToHost(viewModeChangedMessage(next));
          }}
        />
      </div>
    )}
  </EventFlowPage>
);
