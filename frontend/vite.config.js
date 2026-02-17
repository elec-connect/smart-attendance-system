import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // IMPORTANT
    open: true, // Ouvre le navigateur automatiquement
    // Middleware pour SPA routing
    middlewareMode: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('❌ Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log(`📤 [PROXY] ${req.method} ${req.url} -> ${proxyReq.path}`);
          });
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    // IMPORTANT pour SPA
    rollupOptions: {
      input: './index.html'
    }
  },
  // CE PARAMÈTRE EST CRITIQUE
  appType: 'spa',
  base: '/',
})