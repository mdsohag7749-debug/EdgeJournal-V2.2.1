// Vercel serverless function — GET /api/ai/health (Sprint 9.6).
//
// Node.js ESM function (package.json has "type": "module"). Routes the public
// readiness probe through the shared server health handler.

import { handleHealth } from '../../server/ai/healthHandler.js';
import { sendJson, clientIpFrom } from '../../server/ai/http.js';

export default async function handler(req, res) {
  const out = await handleHealth({
    ip: clientIpFrom(req),
    source: process.env,
  });
  sendJson(res, out.status, out.json);
}