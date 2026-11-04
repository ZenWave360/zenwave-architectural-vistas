/*
 * Host bridge bootstrap. This module must be the first import of main.tsx so that it is evaluated before React
 * and the visualizers. It is part of the entry chunk, so the page needs no inline script and works under a
 * content security policy that only allows scripts from the page's own location.
 */
import type { DiagramDisplaySettings, FlowViewModel, ServiceViewModel } from '@zenwave360/vistas-eventflow/react';
import { EVENTFLOW_WEBVIEW_PROTOCOL, EVENTFLOW_WEBVIEW_PROTOCOL_VERSION } from './protocol';

export type ViewMode = 'flow' | 'services';

/** One variant of a flow, as zenwave/eventFlowViews lists it. */
export interface FlowVariant {
  id: string;
  title: string;
}

export interface RenderBundle {
  flowGraph?: FlowViewModel | null;
  serviceGraph?: ServiceViewModel | null;
  viewMode?: ViewMode;
  displaySettings?: DiagramDisplaySettings;
  /**
   * A host should send something stable for one diagram, such as the document URI and the flow name.
   * diagramId belongs to the diagrams in the same renderBundle; a bundle with a graph and no diagramId has no identity.
   * A bundle that changes only viewMode or display settings leaves the identity alone.
   * A variant bundle keeps this id. The page frames the flow on it together with the shown variant.
   */
  diagramId?: string;
  /**
   * Variants of this flow. Omit to leave the current list. An empty list means the flow has none.
   * The page shows them in this order and does not invent, reorder or rename any.
   */
  variants?: FlowVariant[];
  /**
   * The variant whose graph this bundle carries, or null for the full diagram. Omit to leave the current selection.
   * The page does not swap graphs for this field: flowGraph is the graph to show, already laid out by the server.
   */
  variant?: string | null;
}

export interface BridgeMessage {
  type: string;
  payload?: RenderBundle & {
    nodeId?: string | null;
  };
}

interface HostChannel {
  postMessage(message: unknown): void;
}

declare global {
  interface Window {
    __eventFlowPendingMessages?: BridgeMessage[];
    renderBundle?: (bundle: RenderBundle) => void;
    setViewMode?: (viewMode: ViewMode) => void;
    setDisplaySettings?: (displaySettings: DiagramDisplaySettings) => void;
    highlightNode?: (nodeId: string | null) => void;
    /** Messaging channel a host may inject before the page scripts run. Preferred over any other channel. */
    __zenwaveHost?: HostChannel;
    /** VS Code webview API, acquired once by whoever calls acquireVsCodeApi first. */
    __zenwaveVsCodeApi?: HostChannel;
  }

  // Provided by VS Code webviews only. It throws when called a second time.
  // eslint-disable-next-line no-var
  var acquireVsCodeApi: (() => HostChannel) | undefined;
}

export const webviewReadyMessage = {
  type: 'webviewReady',
  payload: {
    protocol: EVENTFLOW_WEBVIEW_PROTOCOL,
    protocolVersion: EVENTFLOW_WEBVIEW_PROTOCOL_VERSION,
  },
} as const;

/** Page to host, sent by a page with a view selector when the user changes the view. Never sent for a host request. */
export function viewModeChangedMessage(viewMode: ViewMode) {
  return { type: 'viewModeChanged', payload: { viewMode } } as const;
}

/**
 * Page to host, sent by a page with a variant dropdown when the user chooses a variant or the full diagram.
 * variant null is the full diagram. Never sent for a host renderBundle.
 */
export function variantChangedMessage(variantId: string | null) {
  return { type: 'variantChanged', payload: { variant: variantId } } as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readVariants(value: unknown): FlowVariant[] {
  if (!Array.isArray(value)) return [];
  const variants: FlowVariant[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = entry.id;
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    const title = entry.title;
    variants.push({ id, title: typeof title === 'string' && title.length > 0 ? title : id });
  }
  return variants;
}

/** A non-empty string is a variant id. Anything else the host sent, including null, is the full diagram. */
function readVariant(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Normalizes a host renderBundle payload. A missing graph becomes null, as it does today.
 * variants and variant are omitted from the result when the host did not send them.
 */
export function readRenderBundle(payload: unknown): RenderBundle {
  const record = isRecord(payload) ? payload : {};
  const bundle: RenderBundle = {
    flowGraph: (record.flowGraph ?? null) as FlowViewModel | null,
    serviceGraph: (record.serviceGraph ?? null) as ServiceViewModel | null,
    viewMode: record.viewMode as ViewMode | undefined,
    displaySettings: record.displaySettings as DiagramDisplaySettings | undefined,
    diagramId: typeof record.diagramId === 'string' ? record.diagramId : undefined,
  };
  if (Object.prototype.hasOwnProperty.call(record, 'variants')) {
    bundle.variants = readVariants(record.variants);
  }
  if (Object.prototype.hasOwnProperty.call(record, 'variant')) {
    bundle.variant = readVariant(record.variant);
  }
  return bundle;
}

window.__eventFlowPendingMessages = window.__eventFlowPendingMessages ?? [];

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as BridgeMessage | null | undefined;

  if (!msg || typeof msg.type !== 'string') {
    return;
  }

  const pending = window.__eventFlowPendingMessages ?? (window.__eventFlowPendingMessages = []);

  if (msg.type === 'renderBundle') {
    if (typeof window.renderBundle === 'function') {
      window.renderBundle(readRenderBundle(msg.payload));
    } else {
      pending.push(msg);
    }
  }

  if (msg.type === 'setViewMode') {
    if (typeof window.setViewMode === 'function') {
      window.setViewMode(msg.payload?.viewMode as ViewMode);
    } else {
      pending.push(msg);
    }
  }

  if (msg.type === 'setDisplaySettings') {
    if (typeof window.setDisplaySettings === 'function') {
      window.setDisplaySettings((msg.payload?.displaySettings ?? {}));
    } else {
      pending.push(msg);
    }
  }

  if (msg.type === 'highlightNode') {
    if (typeof window.highlightNode === 'function') {
      window.highlightNode(msg.payload?.nodeId ?? null);
    } else {
      pending.push(msg);
    }
  }

  if (msg.type === 'renderGraph') {
    const graphPayload = msg.payload as { graph?: FlowViewModel | null } | undefined;
    pending.push({
      type: 'renderBundle',
      payload: {
        flowGraph: graphPayload?.graph ?? null,
        viewMode: 'flow',
      },
    });
  }
});

/**
 * Returns the channel the readiness signal is sent on, in order of preference:
 * 1. a channel the host injected as window.__zenwaveHost;
 * 2. the VS Code webview API, acquired once and cached on window.__zenwaveVsCodeApi;
 * 3. the parent frame, when the page is embedded in one.
 * A top-level page without a host channel (for example IntelliJ JCEF) has nobody to address and gets undefined.
 */
export function resolveHostChannel(): HostChannel | undefined {
  const host = window.__zenwaveHost;
  if (host && typeof host.postMessage === 'function') {
    return host;
  }

  if (window.__zenwaveVsCodeApi && typeof window.__zenwaveVsCodeApi.postMessage === 'function') {
    return window.__zenwaveVsCodeApi;
  }

  if (typeof globalThis.acquireVsCodeApi === 'function') {
    window.__zenwaveVsCodeApi = globalThis.acquireVsCodeApi();
    return window.__zenwaveVsCodeApi;
  }

  if (window.parent && window.parent !== window) {
    const parentWindow = window.parent;
    return { postMessage: (message) => parentWindow.postMessage(message, '*') };
  }

  return undefined;
}

/** Sends a message to the host on the same channel as webviewReady. Does nothing when the page has no host channel. */
export function postToHost(message: { type: string; payload?: unknown }): void {
  resolveHostChannel()?.postMessage(message);
}

let readySent = false;

function signalReady() {
  if (readySent) return;
  readySent = true;
  resolveHostChannel()?.postMessage(webviewReadyMessage);
}

if (document.readyState === 'complete') {
  signalReady();
} else {
  window.addEventListener('load', signalReady, { once: true });
}
