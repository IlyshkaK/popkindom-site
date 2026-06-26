function sendJson(res, status, data) {
  if (!res.headersSent) {
    res.status(status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  return res.end(JSON.stringify(data));
}

function methodNotAllowed(res) {
  return sendJson(res, 405, { message: 'Метод не разрешён.' });
}

async function readJson(req) {
  // Native Express mode: body is already parsed by express.json().
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  // Compatibility fallback for old Vercel-style handlers.
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};

  if (!header) return cookies;

  header.split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index === -1) return;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    cookies[key] = decodeURIComponent(value);
  });

  return cookies;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  return parts.join('; ');
}

module.exports = {
  sendJson,
  methodNotAllowed,
  readJson,
  parseCookies,
  serializeCookie,
};
