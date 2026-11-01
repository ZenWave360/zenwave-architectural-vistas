import { useEffect, useState, type ReactNode } from 'react';
import {
  EventFlowVisualizer,
  ServiceMapVisualizer,
  type DiagramDisplaySettings,
  type FlowViewModel,
  type ServiceViewModel,
} from '@zenwave360/vistas-eventflow/react';
import type { BridgeMessage, RenderBundle, ViewMode } from './bootstrap';

/** What an embedding application can read and change while the page is showing. */
export interface EventFlowPageState {
  /** The view being shown. It follows the host's renderBundle and setViewMode messages too. */
  viewMode: ViewMode;
  /** Changes the view. It sends nothing to the host: the embedding application decides whether to tell it. */
  setViewMode: (viewMode: ViewMode) => void;
}

export interface EventFlowPageProps {
  /** Models shown before the host sends any, for running without a host (dev only). */
  initialFlowViewModel?: FlowViewModel | null;
  initialServiceViewModel?: ServiceViewModel | null;
  /**
   * Optional chrome rendered above the diagram, given the current view and a way to change it. Without it the page
   * renders the diagram alone.
   */
  children?: (state: EventFlowPageState) => ReactNode;
}

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

/**
 * The EventFlow diagram as a page: holds the models, view and display settings, applies the host's messages and shows
 * a waiting state for a view with no model. It has no control of its own; applications add theirs through children.
 * The host bridge (./bootstrap) must be imported before this module runs.
 */
export function EventFlowPage({ initialFlowViewModel = null, initialServiceViewModel = null, children }: EventFlowPageProps) {
  const [flowViewModel, setFlowViewModel] = useState<FlowViewModel | null>(initialFlowViewModel);
  const [serviceViewModel, setServiceViewModel] = useState<ServiceViewModel | null>(initialServiceViewModel);
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

  let diagram: ReactNode;
  if (viewMode === 'flow' && !flowViewModel) {
    diagram = <EmptyState message="Waiting for graph data from host..." />;
  } else if (viewMode === 'services' && !serviceViewModel) {
    diagram = <EmptyState message="Waiting for services view data from host..." />;
  } else if (viewMode === 'services' && serviceViewModel) {
    diagram = (
      <ServiceMapVisualizer
        serviceViewModel={serviceViewModel}
        editable={true}
        displaySettings={displaySettings}
      />
    );
  } else {
    diagram = (
      <EventFlowVisualizer
        flowViewModel={flowViewModel!}
        editable={true}
        displaySettings={displaySettings}
        highlightedNodeIds={highlightedNodeIds}
      />
    );
  }

  if (!children) {
    return diagram;
  }

  return (
    <div className="eventflow-page">
      {children({ viewMode, setViewMode })}
      <div className="eventflow-page__diagram">{diagram}</div>
    </div>
  );
}
