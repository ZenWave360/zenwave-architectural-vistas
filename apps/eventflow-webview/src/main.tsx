// The bridge bootstrap must stay the first import: it registers the message listener before anything else runs.
import './bootstrap';
import './page.css';
import type { BridgeMessage, RenderBundle, ViewMode } from './bootstrap';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  EventFlowVisualizer,
  ServiceMapVisualizer,
  type DiagramDisplaySettings,
  type FlowViewModel,
  type ServiceViewModel,
} from '@zenwave360/vistas-eventflow/react';
import placeOrderFlow from './fixtures/place-order-flow.json';
import placeOrderServices from './fixtures/place-order-services.json';

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#64748b',
        fontSize: '14px',
        padding: '24px',
        textAlign: 'center',
        background: '#f8fafc',
      }}
    >
      {message}
    </div>
  );
}

function applyBridgeMessage(
  message: BridgeMessage,
  renderBundle: (bundle: RenderBundle) => void,
  setViewMode: (viewMode: ViewMode) => void,
  setDisplaySettings: (displaySettings: DiagramDisplaySettings) => void,
  highlightNode: (nodeId: string | null) => void
) {
  if (message.type === 'renderBundle') {
    renderBundle({
      flowGraph: message.payload?.flowGraph ?? null,
      serviceGraph: message.payload?.serviceGraph ?? null,
      viewMode: message.payload?.viewMode,
      displaySettings: message.payload?.displaySettings,
    });
  }

  if (message.type === 'setViewMode' && message.payload?.viewMode) {
    setViewMode(message.payload.viewMode);
  }

  if (message.type === 'setDisplaySettings' && message.payload?.displaySettings) {
    setDisplaySettings(message.payload.displaySettings);
  }

  if (message.type === 'highlightNode') {
    highlightNode(message.payload?.nodeId ?? null);
  }
}

function WebviewApp() {
  const [flowViewModel, setFlowViewModel] = useState<FlowViewModel | null>(
    import.meta.env.DEV ? (placeOrderFlow as FlowViewModel) : null
  );
  const [serviceViewModel, setServiceViewModel] = useState<ServiceViewModel | null>(
    import.meta.env.DEV ? (placeOrderServices as ServiceViewModel) : null
  );
  const [viewMode, setViewMode] = useState<ViewMode>('flow');
  const [displaySettings, setDisplaySettings] = useState<DiagramDisplaySettings>({ humanizeLabels: true });
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);

  useEffect(() => {
    const renderBundle = (bundle: RenderBundle) => {
      if (bundle.flowGraph !== undefined) {
        setFlowViewModel(bundle.flowGraph ?? null);
      }
      if (bundle.serviceGraph !== undefined) {
        setServiceViewModel(bundle.serviceGraph ?? null);
      }
      if (bundle.viewMode) {
        setViewMode(bundle.viewMode);
      }
      if (bundle.displaySettings) {
        setDisplaySettings((current) => ({ ...current, ...bundle.displaySettings }));
      }
    };

    const highlightNode = (nodeId: string | null) => {
      setHighlightedNodeIds(nodeId ? [nodeId] : []);
    };

    window.renderBundle = renderBundle;
    window.setViewMode = setViewMode;
    window.setDisplaySettings = (nextDisplaySettings) => {
      setDisplaySettings((current) => ({ ...current, ...nextDisplaySettings }));
    };
    window.highlightNode = highlightNode;

    const pendingMessages = window.__eventFlowPendingMessages ?? [];
    pendingMessages.forEach((message) => applyBridgeMessage(
      message,
      renderBundle,
      setViewMode,
      (nextDisplaySettings) => setDisplaySettings((current) => ({ ...current, ...nextDisplaySettings })),
      highlightNode
    ));
    window.__eventFlowPendingMessages = [];

    return () => {
      delete window.renderBundle;
      delete window.setViewMode;
      delete window.setDisplaySettings;
      delete window.highlightNode;
    };
  }, []);

  if (viewMode === 'flow' && !flowViewModel) {
    return <EmptyState message="Waiting for graph data from host..." />;
  }

  if (viewMode === 'services' && !serviceViewModel) {
    return <EmptyState message="Waiting for services view data from host..." />;
  }

  if (viewMode === 'services' && serviceViewModel) {
    return (
      <ServiceMapVisualizer
        serviceViewModel={serviceViewModel}
        editable={true}
        displaySettings={displaySettings}
      />
    );
  }

  return (
    <EventFlowVisualizer
      flowViewModel={flowViewModel!}
      editable={true}
      displaySettings={displaySettings}
      highlightedNodeIds={highlightedNodeIds}
    />
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element "#root" was not found.');
}

createRoot(rootElement).render(<WebviewApp />);
