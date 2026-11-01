// The bridge bootstrap must stay the first import: it registers the message listener before anything else runs.
import '@zenwave360/vistas-eventflow-page/bootstrap';
import '@zenwave360/vistas-eventflow-page/page.css';
import { createRoot } from 'react-dom/client';
import { EventFlowPage, devFixtures } from '@zenwave360/vistas-eventflow-page';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element "#root" was not found.');
}

// The minimal page: no control of its own, for a host that has its own toolbar (IntelliJ).
createRoot(rootElement).render(
  <EventFlowPage
    initialFlowViewModel={import.meta.env.DEV ? devFixtures.flowViewModel : null}
    initialServiceViewModel={import.meta.env.DEV ? devFixtures.serviceViewModel : null}
  />
);
