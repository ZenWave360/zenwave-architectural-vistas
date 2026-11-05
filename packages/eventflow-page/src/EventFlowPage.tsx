import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  EventFlowVisualizer,
  ServiceMapVisualizer,
  type DiagramDisplaySettings,
  type FlowViewModel,
  type ServiceViewModel,
} from '@zenwave360/vistas-eventflow/react';
import {
  readRenderBundle,
  readDisplaySettings,
  type BridgeMessage,
  type FlowVariant,
  type NodePositions,
  type RenderBundle,
  type SavedPositions,
  type ViewMode,
  type LanesMode,
} from './bootstrap';

/** What an embedding application can read and change while the page is showing. */
export interface EventFlowPageState {
  /** The view being shown. It follows the host's renderBundle and setViewMode messages too. */
  viewMode: ViewMode;
  /** Changes the view. It sends nothing to the host: the embedding application decides whether to tell it. */
  setViewMode: (viewMode: ViewMode) => void;
  /** Variants the host has listed, in that order. Empty when the flow has none. */
  variants: readonly FlowVariant[];
  /** The variant the dropdown shows. Null is the full diagram. It can move ahead of the graph on screen. */
  variantId: string | null;
  /**
   * Records the user's choice in the dropdown. It does not change the graph and sends nothing to the host:
   * the embedding application tells the host, and the graph changes when the next renderBundle arrives.
   */
  setVariantId: (variantId: string | null) => void;
  /** True when a node of the full diagram was moved since the last renderBundle with a graph, and not saved yet. */
  canSavePositions: boolean;
  /** Every node of the full diagram as shown, rounded to whole numbers. Null when no node was moved. */
  currentPositions: () => NodePositions | null;
  /** Hides the save control until the next move. The embedding application calls it after sending the positions. */
  markPositionsSaved: () => void;
  /** What the host last said about the saved positions of this flow. Undefined until it says. */
  savedPositions: SavedPositions | undefined;
  /** Why the host could not save the positions, from its savePositionsFailed message. Cleared by the next save click or renderBundle. */
  savePositionsFailure: string | undefined;
  /** Whether labels are humanized. It starts from the host's displaySettings and follows them. */
  humanizeLabels: boolean;
  /** Changes the labels on screen at once. It sends nothing to the host: the embedding application decides whether to tell it. */
  setHumanizeLabels: (humanizeLabels: boolean) => void;
  /** Requested lanes, initialized by the host alongside humanizeLabels. */
  lanes: LanesMode;
  setLanes: (lanes: LanesMode) => void;
  /** Requested or still displayed lanes: saving/dragging remain off while awaiting the host. */
  lanesActive: boolean;
  /** False when the host says the server offers no lanes: hide the Lanes control. Lanes then behave as none. */
  lanesSupported: boolean;
}

interface VariantState {
  variants: FlowVariant[];
  variantId: string | null;
  /** The variant whose graph is on screen. Null is the full diagram. This, not the dropdown, frames the flow. */
  shownVariantId: string | null;
}

const NO_VARIANTS: VariantState = { variants: [], variantId: null, shownVariantId: null };

function listedVariant(variants: readonly FlowVariant[], variantId: string | null): string | null {
  if (!variantId) return null;
  return variants.some((item) => item.id === variantId) ? variantId : null;
}

/** Applies the host's variants and variant. An id that is not in the list selects the full diagram. */
function applyHostVariants(current: VariantState, bundle: RenderBundle): VariantState {
  if (bundle.variants === undefined && bundle.variant === undefined) return current;
  const variants = bundle.variants ?? current.variants;
  const shownVariantId = bundle.variant !== undefined
    ? listedVariant(variants, bundle.variant)
    : listedVariant(variants, current.shownVariantId);
  const variantId = bundle.variant !== undefined
    ? shownVariantId
    : listedVariant(variants, current.variantId);
  if (
    variants === current.variants
    && variantId === current.variantId
    && shownVariantId === current.shownVariantId
  ) {
    return current;
  }
  return { variants, variantId, shownVariantId };
}

/**
 * Identity the flow canvas frames on.
 *
 * A variant bundle keeps the full diagram's diagramId: that id names the flow, and a variant is the same flow.
 * The shown variant is a different laid-out graph, so the identity adds its id and the opening zoom runs again.
 * The full diagram uses diagramId alone. With no diagramId and no variant, the flow still has no identity.
 */
function flowFramingDiagramId(diagramId: string | undefined, shownVariantId: string | null, shownLanes: LanesMode): string | undefined {
  const variantFrame = shownVariantId ? `${diagramId ?? ''}\u0000${shownVariantId}` : diagramId;
  return shownLanes === 'none' ? variantFrame : `${variantFrame ?? ''}\u0000lanes:${shownLanes}`;
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
  /**
   * Optional status bar rendered below the diagram, for the page's messages. Nothing is drawn when it returns
   * null, false or undefined.
   */
  statusBar?: (state: EventFlowPageState) => ReactNode;
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
  highlightNode: (nodeId: string | null) => void,
  savePositionsFailed: (message: string) => void
) {
  if (message.type === 'renderBundle') {
    renderBundle(readRenderBundle(message.payload));
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

  if (message.type === 'savePositionsFailed') {
    savePositionsFailed(typeof message.payload?.message === 'string' ? message.payload.message : '');
  }
}

/**
 * The EventFlow diagram as a page: holds the models, view and display settings, applies the host's messages and shows
 * a waiting state for a view with no model. It has no control of its own; applications add theirs through children.
 * The host bridge (./bootstrap) must be imported before this module runs.
 */
export function EventFlowPage({ initialFlowViewModel = null, initialServiceViewModel = null, children, statusBar }: EventFlowPageProps) {
  const [flowViewModel, setFlowViewModel] = useState<FlowViewModel | null>(initialFlowViewModel);
  const [serviceViewModel, setServiceViewModel] = useState<ServiceViewModel | null>(initialServiceViewModel);
  const [viewMode, setViewMode] = useState<ViewMode>('flow');
  const [displaySettings, setDisplaySettings] = useState<DiagramDisplaySettings>({ humanizeLabels: true });
  const [lanesSupported, setLanesSupported] = useState(true);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [diagramId, setDiagramId] = useState<string | undefined>(undefined);
  const [variantState, setVariantState] = useState<VariantState>(NO_VARIANTS);
  const [positionsMoved, setPositionsMoved] = useState(false);
  const [savedPositions, setSavedPositions] = useState<SavedPositions | undefined>(undefined);
  const [savePositionsFailure, setSavePositionsFailure] = useState<string | undefined>(undefined);
  const movedFlowRef = useRef<FlowViewModel | null>(null);
  const lanes: LanesMode = lanesSupported ? displaySettings.lanes ?? 'none' : 'none';
  const shownLanes: LanesMode = !lanesSupported || flowViewModel?.lanes == null ? 'none'
    : flowViewModel.lanes[0]?.kind === 'service' ? 'services' : 'systems';
  const lanesActive = lanes !== 'none' || shownLanes !== 'none';

  const onFlowViewModelChange = useCallback((moved: FlowViewModel) => {
    movedFlowRef.current = moved;
    setPositionsMoved(true);
  }, []);

  const currentPositions = (): NodePositions | null => {
    if (lanesActive || viewMode !== 'flow' || variantState.variantId !== null || variantState.shownVariantId !== null) return null;
    const moved = movedFlowRef.current;
    if (!moved) return null;
    const positions: NodePositions = {};
    for (const node of moved.nodes) {
      if (!node.position) continue; // not drawn, so not shown
      positions[node.id] = { x: Math.round(node.position.x), y: Math.round(node.position.y) };
    }
    return positions;
  };

  // The moved graph stays until something redraws the diagram, so the control can return when the host reports a failed save.
  const markPositionsSaved = () => {
    setPositionsMoved(false);
    setSavePositionsFailure(undefined);
  };

  // The visualizer redraws from the server graph whenever its inputs change and unmounts outside the flow view,
  // so moves made before that are no longer on screen and must not be saved.
  useEffect(() => {
    movedFlowRef.current = null;
    setPositionsMoved(false);
  }, [flowViewModel, displaySettings, highlightedNodeIds, viewMode, variantState.shownVariantId]);

  const setVariantId = (variantId: string | null) => {
    setVariantState((current) => {
      const next = listedVariant(current.variants, variantId);
      return next === current.variantId ? current : { ...current, variantId: next };
    });
  };

  useEffect(() => {
    const renderBundle = (bundle: RenderBundle) => {
      setSavePositionsFailure(undefined);
      if (bundle.flowGraph !== undefined) {
        setFlowViewModel(bundle.flowGraph ?? null);
      }
      // A new graph replaces what the user moved.
      if (bundle.flowGraph != null) {
        movedFlowRef.current = null;
        setPositionsMoved(false);
      }
      if (bundle.savedPositions !== undefined) {
        setSavedPositions(bundle.savedPositions);
      }
      if (bundle.serviceGraph !== undefined) {
        setServiceViewModel(bundle.serviceGraph ?? null);
      }
      if (bundle.viewMode) {
        setViewMode(bundle.viewMode);
      }
      if (bundle.lanesSupported !== undefined) {
        setLanesSupported(bundle.lanesSupported);
      }
      if (bundle.displaySettings) {
        setDisplaySettings((current) => ({ ...current, ...readDisplaySettings(bundle.displaySettings) }));
      }
      // diagramId belongs to the graphs in this bundle. View and display settings alone leave it.
      if (typeof bundle.diagramId === 'string') {
        setDiagramId(bundle.diagramId);
      } else if (bundle.flowGraph != null || bundle.serviceGraph != null) {
        setDiagramId(undefined);
      }
      if (bundle.variants !== undefined || bundle.variant !== undefined) {
        setVariantState((current) => applyHostVariants(current, bundle));
      }
    };

    const highlightNode = (nodeId: string | null) => {
      setHighlightedNodeIds(nodeId ? [nodeId] : []);
    };

    // The save did not happen: the positions are still the ones on screen, so the user can save again.
    const savePositionsFailed = (message: string) => {
      setSavePositionsFailure(message || 'The positions were not saved.');
      if (movedFlowRef.current) setPositionsMoved(true);
    };

    window.renderBundle = renderBundle;
    window.savePositionsFailed = savePositionsFailed;
    window.setViewMode = setViewMode;
    window.setDisplaySettings = (nextDisplaySettings) => {
      setDisplaySettings((current) => ({ ...current, ...readDisplaySettings(nextDisplaySettings) }));
    };
    window.highlightNode = highlightNode;

    const pendingMessages = window.__eventFlowPendingMessages ?? [];
    pendingMessages.forEach((message) => applyBridgeMessage(
      message,
      renderBundle,
      setViewMode,
      (nextDisplaySettings) => setDisplaySettings((current) => ({ ...current, ...readDisplaySettings(nextDisplaySettings) })),
      highlightNode,
      savePositionsFailed
    ));
    window.__eventFlowPendingMessages = [];

    return () => {
      delete window.renderBundle;
      delete window.setViewMode;
      delete window.setDisplaySettings;
      delete window.highlightNode;
      delete window.savePositionsFailed;
    };
  }, []);

  // A node move is remembered here and reaches the host only when an application with a Save positions control
  // sends it. The minimal page has no such control. A move in a variant is remembered too, but canSavePositions
  // is false there (EF-R12), and the host's next renderBundle replaces the graph.
  let diagram: ReactNode;
  if (viewMode === 'flow' && !flowViewModel) {
    diagram = <EmptyState message="Waiting for graph data from host..." />;
  } else if (viewMode === 'services' && !serviceViewModel) {
    diagram = <EmptyState message="Waiting for services view data from host..." />;
  } else if (viewMode === 'services' && serviceViewModel) {
    diagram = (
      <ServiceMapVisualizer
        serviceViewModel={serviceViewModel}
        diagramId={diagramId}
        editable={true}
        displaySettings={displaySettings}
      />
    );
  } else {
    diagram = (
      <EventFlowVisualizer
        flowViewModel={flowViewModel!}
        diagramId={flowFramingDiagramId(diagramId, variantState.shownVariantId, shownLanes)}
        editable={!lanesActive}
        displaySettings={displaySettings}
        highlightedNodeIds={highlightedNodeIds}
        onFlowViewModelChange={onFlowViewModelChange}
      />
    );
  }

  if (!children) {
    return diagram;
  }

  const state: EventFlowPageState = {
        viewMode,
        setViewMode,
        variants: variantState.variants,
        variantId: variantState.variantId,
        setVariantId,
        canSavePositions: viewMode === 'flow' && !lanesActive && positionsMoved && variantState.variantId === null && variantState.shownVariantId === null,
        currentPositions,
        markPositionsSaved,
        savedPositions: variantState.shownVariantId === null ? savedPositions : undefined,
        savePositionsFailure,
        humanizeLabels: displaySettings.humanizeLabels ?? true,
        setHumanizeLabels: (humanizeLabels) => setDisplaySettings((current) => ({ ...current, humanizeLabels })),
        lanes,
        setLanes: (lanes) => setDisplaySettings((current) => ({ ...current, lanes })),
        lanesActive,
        lanesSupported,
  };
  const status = statusBar?.(state);

  return (
    <div className="eventflow-page">
      <div className="eventflow-page__toolbar">{children(state)}</div>
      <div className="eventflow-page__diagram">{diagram}</div>
      {status ? <div className="eventflow-page__status">{status}</div> : null}
    </div>
  );
}
