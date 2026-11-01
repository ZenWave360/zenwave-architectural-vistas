import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { webviewProtocol } from '@zenwave360/vistas-eventflow-page/vite';

const eventFlowSource = fileURLToPath(new URL('../../packages/eventflow/src/index.ts', import.meta.url));

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
