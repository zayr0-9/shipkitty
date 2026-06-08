export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function corsJson(request: Request, data: unknown, init: ResponseInit = {}) {
  return json(data, { ...init, headers: withCorsHeaders(request, init.headers) });
}

export function withCorsHeaders(request: Request, headersInit?: HeadersInit) {
  const headers = new Headers(headersInit);
  const origin = request.headers.get('origin');
  if (origin) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
    headers.append('vary', 'Origin');
  }
  return headers;
}

export function error(message: string, status = 400) {
  return json({ error: message }, { status });
}

export function notFound() {
  return error('Not found.', 404);
}

export function methodNotAllowed() {
  return error('Method not allowed.', 405);
}

export function randomId(prefix: string) {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${value}`;
}

export function normalizeSegment(value: string, fallback = 'unknown') {
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || fallback;
}

export function requireText(value: unknown, field: string, maxLength = 120) {
  if (typeof value !== 'string') {
    throw new Error(`${field} is required.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
}

export async function hashIp(ip: string) {
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
