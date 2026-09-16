import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { EVENTFLOW_WEBVIEW_PROTOCOL, EVENTFLOW_WEBVIEW_PROTOCOL_VERSION } from './src/protocol';

const eventFlowSource = fileURLToPath(new URL('../../packages/eventflow/src/index.ts', import.meta.url));

/**
 * Writes the protocol identity into index.html (meta tags a host can read before loading the page) and emits
 * protocol.json next to it, so a host can check the bundle's protocol version without running it.
 */
function webviewProtocol(): Plugin {
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

export default defineConfig({
  base: './',
  plugins: [react(), webviewProtocol()],
  resolve: {
    alias: {
      '@zenwave360/vistas-eventflow/react': eventFlowSource,
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // The host bridge must be in the entry chunk that index.html references: IntelliJ registers only the assets
    // named in index.html, and the bridge must run before the page can receive messages.
    modulePreload: { polyfill: false },
  },
});
