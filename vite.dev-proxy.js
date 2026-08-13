// Vite dev-only middleware for the secure AI bridge (Sprint 9.6).
//
// Lets `npm run dev` serve /api/ai/health and /api/ai/analyze locally by
// reusing the SAME server handlers the Vercel functions use — so local
// development and production behave identically and no API key ever touches
// the browser. Never active in `vite build` (configureServer only runs in
// the dev server).

import { readRawBody, sendJson, clientIpFrom } from './server/ai/http.js';
import { handleAnalyze } from './server/ai/analyzeHandler.js';
import { handleHealth } from './server/ai/healthHandler.js';

export function devApiPlugin() {
  return {
    name: 'edgejournal-ai-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/ai/health', async (req, res) => {
        const out = await handleHealth({
          ip: clientIpFrom(req),
        });
        sendJson(res, out.status, out.json);
      });

      server.middlewares.use('/api/ai/analyze', async (req, res) => {
        const rawBody = await readRawBody(req);
        const out = await handleAnalyze({
          method: req.method,
          data: rawBody,
          authorization: req.headers.authorization || '',
          ip: clientIpFrom(req),
        });
        sendJson(res, out.status, out.json);
      });
    },
  };
}