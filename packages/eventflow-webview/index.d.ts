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

export type EventFlowViewMode = 'flow' | 'services';

export interface EventFlowDisplaySettings {
  humanizeLabels?: boolean;
}

/** Host to page. flowGraph and serviceGraph are the server's view models, passed through unchanged. */
export interface RenderBundleMessage {
  type: 'renderBundle';
  payload: {
    flowGraph?: unknown;
    serviceGraph?: unknown;
    viewMode?: EventFlowViewMode;
    displaySettings?: EventFlowDisplaySettings;
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
