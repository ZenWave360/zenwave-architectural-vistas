// The bridge bootstrap must stay the first import: it registers the message listener before anything else runs.
import '@zenwave360/vistas-eventflow-page/bootstrap';
import '@zenwave360/vistas-eventflow-page/page.css';
import './toolbar.css';
import { createRoot } from 'react-dom/client';
import { EventFlowPage, devFixtures, postToHost, viewModeChangedMessage } from '@zenwave360/vistas-eventflow-page';
import { ViewSelector } from './ViewSelector';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element "#root" was not found.');
}

// The page with a selector, for a host with no toolbar inside the editor (VS Code). Zoom and fit are the controls the
// visualizers already draw. Only the user's own choice is reported: the selector follows a host setViewMode or
// renderBundle without telling the host about it.
createRoot(rootElement).render(
  <EventFlowPage
    initialFlowViewModel={import.meta.env.DEV ? devFixtures.flowViewModel : null}
    initialServiceViewModel={import.meta.env.DEV ? devFixtures.serviceViewModel : null}
  >
    {({ viewMode, setViewMode }) => (
      <ViewSelector
        viewMode={viewMode}
        onUserChange={(next) => {
          if (next === viewMode) return;
          setViewMode(next);
          postToHost(viewModeChangedMessage(next));
        }}
      />
    )}
  </EventFlowPage>
);
