import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env    = loadEnv(mode, process.cwd(), '');
  const backend = `http://localhost:${env.BACKEND_PORT || 3000}`;

  return {
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api':      { target: backend, changeOrigin: true },
      '/announce': { target: backend, changeOrigin: true },
      '/scrape':   { target: backend, changeOrigin: true },
      '/uploads':  { target: backend, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query:  ['@tanstack/react-query'],
        },
      },
    },
  },
  };
});
