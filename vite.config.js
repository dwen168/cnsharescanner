import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom dev server middleware to replicate api/yahoo.js
const apiYahooMiddleware = () => ({
  name: 'api-yahoo-middleware',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (urlObj.pathname === '/api/yahoo') {
        const symbol = urlObj.searchParams.get('symbol');
        const period = urlObj.searchParams.get('period') || '3mo';
        const interval = urlObj.searchParams.get('interval') || '1d';

        if (!symbol) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Symbol is required' }));
          return;
        }

        const targets = [
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${period}&interval=${interval}`,
          `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${period}&interval=${interval}`
        ];

        let lastError = '';
        for (const target of targets) {
          try {
            const response = await fetch(target, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://finance.yahoo.com/',
                'Accept': 'application/json'
              }
            });
            if (response.ok) {
              const data = await response.json();
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
              res.end(JSON.stringify(data));
              return;
            } else {
              lastError = `Status ${response.status} ${response.statusText}`;
            }
          } catch (error) {
            lastError = error.message;
          }
        }

        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: `Failed to connect to Yahoo Finance servers. Error: ${lastError}` }));
        return;
      }
      next();
    });
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    apiYahooMiddleware()
  ]
})
