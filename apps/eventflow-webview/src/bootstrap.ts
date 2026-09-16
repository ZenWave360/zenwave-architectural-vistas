/*
 * Host bridge bootstrap. This module must be the first import of main.tsx so that it is evaluated before React
 * and the visualizers. It is part of the entry chunk, so the page needs no inline script and works under a
 * content security policy that only allows scripts from the page's own location.
 */
import type { DiagramDisplaySettings, FlowViewModel, ServiceViewModel } from '@zenwave360/vistas-eventflow/react';
import { EVENTFLOW_WEBVIEW_PROTOCOL, EVENTFLOW_WEBVIEW_PROTOCOL_VERSION } from './protocol';

export type ViewMode = 'flow' | 'services';

export interface RenderBundle {
  flowGraph?: FlowViewModel | null;
  serviceGraph?: ServiceViewModel | null;
  viewMode?: ViewMode;
  displaySettings?: DiagramDisplaySettings;
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

window.__eventFlowPendingMessages = window.__eventFlowPendingMessages ?? [];

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as BridgeMessage | null | undefined;

  if (!msg || typeof msg.type !== 'string') {
    return;
  }

  const pending = window.__eventFlowPendingMessages ?? (window.__eventFlowPendingMessages = []);

  if (msg.type === 'renderBundle') {
    if (typeof window.renderBundle === 'function') {
      window.renderBundle({
        flowGraph: (msg.payload?.flowGraph ?? null),
        serviceGraph: (msg.payload?.serviceGraph ?? null),
        viewMode: msg.payload?.viewMode,
        displaySettings: msg.payload?.displaySettings,
      });
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
