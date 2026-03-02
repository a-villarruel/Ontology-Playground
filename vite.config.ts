import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    outDir: 'build',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('cytoscape')) return 'graph-vendor';
          if (id.includes('react') || id.includes('zustand') || id.includes('framer-motion')) return 'ui-vendor';
          return 'vendor';
        },
      },
    },
  },
  server: {
    proxy: {
      // GitHub OAuth device-flow endpoints don't support CORS — proxy in dev
      '/__github/login/device/code': {
        target: 'https://github.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace('/__github', ''),
      },
      '/__github/login/oauth/access_token': {
        target: 'https://github.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace('/__github', ''),
      },
      ...(process.env.VITE_ENABLE_AI_BUILDER === 'true'
        ? {
            '/api': {
              target: 'http://localhost:7071',
              changeOrigin: true,
            },
          }
        : {}),
    },
  },
})
