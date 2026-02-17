// frontend/vite-spa-plugin.js
export default function spaPlugin() {
  return {
    name: 'vite-spa-plugin',
    configureServer(server) {
      // Middleware pour servir index.html pour toutes les routes SPA
      server.middlewares.use((req, res, next) => {
        const url = req.url;
        
        // Ignorer les fichiers, assets, API, etc.
        const ignorePatterns = [
          '/api',
          '/@',
          '/node_modules',
          '.',
          '.js',
          '.css',
          '.json',
          '.png',
          '.jpg',
          '.svg',
          '.ico',
          '.woff',
          '.woff2',
          '.ttf',
          '.eot'
        ];
        
        const shouldIgnore = ignorePatterns.some(pattern => 
          url.includes(pattern) || 
          url.endsWith(pattern) ||
          url.startsWith(pattern)
        );
        
        if (shouldIgnore) {
          return next();
        }
        
        // Pour toutes les routes SPA, servir index.html
        console.log(`🔄 SPA Routing: ${url} -> /index.html`);
        req.url = '/index.html';
        next();
      });
    }
  };
}// JavaScript source code
