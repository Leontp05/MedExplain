import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['webgazer'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false, // Security: no source maps in production exposing internals
    rollupOptions: {
      output: {
        manualChunks: {
          pdf: ['pdfjs-dist'],
        },
      },
    },
  },
});
