import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('./src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry,
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'styles',
    },
    sourcemap: true,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'reactflow',
        '@reactflow/node-resizer',
      ],
    },
  },
});
