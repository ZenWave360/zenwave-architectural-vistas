import type { Plugin } from 'vite';
import { EVENTFLOW_WEBVIEW_PROTOCOL, EVENTFLOW_WEBVIEW_PROTOCOL_VERSION } from './protocol';

/**
 * Writes the protocol identity into index.html (meta tags a host can read before loading the page) and emits
 * protocol.json next to it, so a host can check the bundle's protocol version without running it.
 */
export function webviewProtocol(): Plugin {
  return {
    name: 'zenwave-webview-protocol',
    transformIndexHtml(html) {
      return html
        .split('@@ZENWAVE_WEBVIEW_PROTOCOL@@').join(EVENTFLOW_WEBVIEW_PROTOCOL)
        .split('@@ZENWAVE_WEBVIEW_PROTOCOL_VERSION@@').join(String(EVENTFLOW_WEBVIEW_PROTOCOL_VERSION));
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'protocol.json',
        source: `${JSON.stringify(
          { protocol: EVENTFLOW_WEBVIEW_PROTOCOL, protocolVersion: EVENTFLOW_WEBVIEW_PROTOCOL_VERSION },
          null,
          2,
        )}\n`,
      });
    },
  };
}
