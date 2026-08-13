// Vercel serverless function — POST /api/ai/analyze (Sprint 9.6).
//
// Node.js ESM function (package.json has "type": "module"). Reads the request
// body, normalizes it, and routes it through the shared secure analyze
// handler. The provider key lives only in server env vars — never here.

import { handleAnalyze } from '../../server/ai/analyzeHandler';
import { readRawBody, sendJson, clientIpFrom } from '../../server/ai/http';

export default async function handler(req, res) {
  const rawBody = await readRawBody(req);
  const out = await handleAnalyze({
    method: req.method,
    data: rawBody,
    authorization: req.headers.authorization || '',
    ip: clientIpFrom(req),
    source: process.env,
  });
  sendJson(res, out.status, out.json);
}