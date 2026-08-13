// Vite dev-only middleware for the secure AI bridge (Sprint 9.6).
//
// Lets `npm run dev` serve /api/ai/health and /api/ai/analyze locally by
// reusing the SAME server handlers the Vercel functions use — so local
// development and production behave identically and no API key ever touches
// the browser. Never active in `vite build` (configureServer only runs in
// the dev server).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readRawBody, sendJson, clientIpFrom } from './server/ai/http.js';
import { handleAnalyze } from './server/ai/analyzeHandler.js';
import { handleHealth } from './server/ai/healthHandler.js';

// Loads server-side env vars from `.env` into process.env so the shared AI
// handlers see the same configuration locally that Vercel injects in
// production. Real environment variables always win (never overwritten), and
// Vite_* keys are skipped here because the client reads those via import.meta.env.
function loadDotEnv(root = process.cwd()) {
  const file = resolve(root, '.env');
  try {
    const text = readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || match[1].startsWith('VITE_')) continue;
      const key = match[1];
      if (process.env[key] !== undefined) continue;
      process.env[key] = match[2].replace(/^(['"])(.*)\1$/, '$2').trim();
    }
  } catch {
    // No .env file — handlers will fall back to an empty env config.
  }
}

export function devApiPlugin() {
  return {
    name: 'edgejournal-ai-api-dev',
    configureServer(server) {
      loadDotEnv();

      server.middlewares.use('/api/ai/health', async (req, res) => {
        const out = await handleHealth({
          source: process.env,
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
          source: process.env,
        });
        sendJson(res, out.status, out.json);
      });
    },
  };
}