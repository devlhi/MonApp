import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(process.cwd(), 'web'),
  plugins: [vue()],
  build: {
    outDir: path.resolve(process.cwd(), 'web', 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router'],
          'map-vendor': ['leaflet']
        }
      }
    }
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://127.0.0.1:3027',
      '/socket.io': {
        target: 'http://127.0.0.1:3027',
        ws: true,
      },
    },
  },
});
