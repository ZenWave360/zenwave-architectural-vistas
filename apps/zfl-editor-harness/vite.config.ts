import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const eventFlowSource = fileURLToPath(new URL('../../packages/eventflow/src/index.ts', import.meta.url));

// Dev harness only; nothing here ships. Port 3001 so it can run beside `pnpm dev:views` (3000).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@zenwave360/vistas-eventflow/react': eventFlowSource } },
  server: { port: 3001, strictPort: true },
});
