export declare const EVENTFLOW_WEBVIEW_PROTOCOL: 'zenwave.eventflow.webview';
export declare const EVENTFLOW_WEBVIEW_PROTOCOL_VERSION: 1;
export declare const EVENTFLOW_WEBVIEW_DIRECTORY: 'webview';
export declare const EVENTFLOW_WEBVIEW_ENTRY: 'webview/index.html';
export declare const EVENTFLOW_WEBVIEW_INBOUND_MESSAGES: readonly [
  'renderBundle',
  'setViewMode',
  'setDisplaySettings',
  'highlightNode',
  'renderGraph',
];
export declare const EVENTFLOW_WEBVIEW_OUTBOUND_MESSAGES: readonly ['webviewReady'];

export declare const EVENTFLOW_WEBVIEW_TOOLBAR_DIRECTORY: 'webview-toolbar';
export declare const EVENTFLOW_WEBVIEW_TOOLBAR_ENTRY: 'webview-toolbar/index.html';
export declare const EVENTFLOW_WEBVIEW_TOOLBAR_OUTBOUND_MESSAGES: readonly ['webviewReady', 'viewModeChanged', 'variantChanged', 'savePositions'];

export type EventFlowViewMode = 'flow' | 'services';

export interface EventFlowDisplaySettings {
  humanizeLabels?: boolean;
}

/** One variant of a flow, as zenwave/eventFlowViews lists it. The page shows title and sends id back. */
export interface FlowVariant {
  id: string;
  title: string;
}

/** Host to page. flowGraph and serviceGraph are the server's view models, passed through unchanged. */
export interface RenderBundleMessage {
  type: 'renderBundle';
  payload: {
    flowGraph?: unknown;
    serviceGraph?: unknown;
    viewMode?: EventFlowViewMode;
    displaySettings?: EventFlowDisplaySettings;
    /**
     * A host should send something stable for one diagram, such as the document URI and the flow name.
     * diagramId belongs to the diagrams in the same renderBundle; a bundle with a graph and no diagramId has no identity.
     * A bundle that changes only viewMode or display settings leaves the identity alone.
     * A variant bundle keeps the full diagram's diagramId. The page frames the flow on this id together with variant.
     */
    diagramId?: string;
    /**
     * Variants of this flow. Omit to leave the current list. An empty list hides the dropdown.
     * Entries without a non-empty string id are ignored. The page keeps this order.
     */
    variants?: FlowVariant[];
    /**
     * The variant whose laid-out flowGraph this bundle carries, or null for the full diagram.
     * Omit to leave the current selection. An id that is not in the current variants selects the full diagram.
     * The page does not choose or lay out a graph for this field. It shows flowGraph as sent.
     */
    variant?: string | null;
    /**
     * What the host did with the positions saved for this flow. Omit to leave the current value. The toolbar page
     * notes exists true with applied false ("Saved positions do not match this flow; automatic layout", with the
     * missing count when given) and may show a subtle indicator for applied true. The minimal page shows nothing.
     * Not shown while a variant is on screen.
     */
    savedPositions?: { exists: boolean; applied: boolean; missing?: number };
  };
}

export interface SetViewModeMessage {
  type: 'setViewMode';
  payload: { viewMode: EventFlowViewMode };
}

/** Merged into the current settings: fields that are not sent keep their values. */
export interface SetDisplaySettingsMessage {
  type: 'setDisplaySettings';
  payload: { displaySettings: EventFlowDisplaySettings };
}

/** nodeId is a flow view node id (for example a hierarchy node's viewNodeIds entry), or null to clear. */
export interface HighlightNodeMessage {
  type: 'highlightNode';
  payload: { nodeId: string | null };
}

/** Legacy: a flow graph alone. Prefer renderBundle. */
export interface RenderGraphMessage {
  type: 'renderGraph';
  payload: { graph: unknown };
}

export type EventFlowWebviewInboundMessage =
  | RenderBundleMessage
  | SetViewModeMessage
  | SetDisplaySettingsMessage
  | HighlightNodeMessage
  | RenderGraphMessage;

/** Page to host, sent once when the page has loaded. payload was added in protocol version 1. */
export interface WebviewReadyMessage {
  type: 'webviewReady';
  payload?: {
    protocol: typeof EVENTFLOW_WEBVIEW_PROTOCOL;
    protocolVersion: number;
  };
}

/**
 * Page to host, sent by the page in webview-toolbar/ when the user changes the view in its selector. It is not sent for
 * a host setViewMode or renderBundle, and the page in webview/ never sends it. A host may ignore it.
 */
export interface ViewModeChangedMessage {
  type: 'viewModeChanged';
  payload: { viewMode: EventFlowViewMode };
}

/**
 * Page to host, sent by the page in webview-toolbar/ when the user chooses a variant or the full diagram.
 * variant is an id from renderBundle.variants, or null for the full diagram. The page does not change the graph:
 * it waits for the host to send renderBundle. It is not sent when the host set the choice, and the page in webview/
 * never sends it. A host may ignore it.
 */
export interface VariantChangedMessage {
  type: 'variantChanged';
  payload: { variant: string | null };
}

/**
 * Page to host, sent by the page in webview-toolbar/ when the user clicks Save positions. The button shows only in the
 * Flow view of the full diagram, after a node was moved since the last renderBundle with a graph. positions holds every
 * node of the full diagram as shown, by node id, rounded to whole numbers. The host writes all of them or none, and
 * discarding saved positions is the host's. Never sent for a variant, and the page in webview/ never sends it.
 */
export interface SavePositionsMessage {
  type: 'savePositions';
  payload: { positions: Record<string, { x: number; y: number }> };
}
