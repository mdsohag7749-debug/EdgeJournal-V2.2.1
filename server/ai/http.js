// Shared HTTP plumbing for the secure AI bridge (Sprint 9.6).
//
// Works for BOTH Vercel Node functions and the Vite dev middleware so the two
// surfaces behave identically.

export function readRawBody(req) {
  return new Promise((resolve) => {
    if (!req) {
      resolve('');
      return;
    }
    if (typeof req.body === 'string') {
      resolve(req.body);
      return;
    }
    if (req.body && typeof req.body === 'object') {
      let text = '';
      try {
        text = JSON.stringify(req.body);
      } catch {
        text = '';
      }
      resolve(text);
      return;
    }
    if (typeof req.on !== 'function') {
      resolve('');
      return;
    }
    let data = '';
    req.setEncoding?.('utf8');
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(data));
  });
}

export function sendJson(res, status, json) {
  if (!res || typeof res.end !== 'function') return;
  if (typeof res.statusCode === 'number') res.statusCode = status;
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json');
    if (status === 429 || status === 404 || status === 405) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
  res.end(JSON.stringify(json));
}

export function clientIpFrom(req, fallback = '') {
  const fwd = req?.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string') {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return req?.socket?.remoteAddress || fallback;
}