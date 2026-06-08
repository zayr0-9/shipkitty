import { AuthError, clearSession, createSessionCookie, getSessionUser, requireSessionUser } from './auth';
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES } from './constants';
import {
  audit,
  consumeOAuthState,
  getPreparedImage,
  getReleaseImage,
  getReleaseImageByPublicRoute,
  insertOAuthState,
  insertPet,
  insertPreparedImage,
  replaceReleaseImage,
  upsertGitHubToken,
  upsertRepo,
  upsertUserFromGitHub,
} from './db';
import { createOAuthStart, exchangeOAuthCode, fetchGitHubUser, fetchReleases, fetchRepo, fetchUserRepos } from './github';
import { buildHtml, buildMarkdown } from './markdown';
import { assertUploadRateLimit } from './rateLimit';
import type { Env, PreparedImageMetadata } from './types';
import { assertAllowedContentLength, assertAllowedContentType, assertImageBytes } from './validation';
import { corsJson, error, hashIp, json, methodNotAllowed, normalizeSegment, notFound, randomId, requireText, withCorsHeaders } from './utils';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === 'OPTIONS') return handleOptions(request);

      if (url.pathname === '/api/auth/github/start') {
        return request.method === 'GET' ? handleOAuthStart(request, env, url) : methodNotAllowed();
      }

      if (url.pathname === '/api/auth/github/callback') {
        return request.method === 'GET' ? handleOAuthCallback(request, env, url) : methodNotAllowed();
      }

      if (url.pathname === '/api/auth/me') {
        return request.method === 'GET' ? handleMe(request, env) : methodNotAllowed();
      }

      if (url.pathname === '/api/auth/logout') {
        return request.method === 'POST' ? handleLogout(request, env) : methodNotAllowed();
      }

      if (url.pathname === '/api/github/repos') {
        return request.method === 'GET' ? handleRepos(request, env) : methodNotAllowed();
      }

      const verifyMatch = url.pathname.match(/^\/api\/github\/repos\/([^/]+)\/([^/]+)\/verify$/);
      if (verifyMatch) {
        return request.method === 'GET' ? handleRepoVerify(request, env, verifyMatch) : methodNotAllowed();
      }

      const releasesMatch = url.pathname.match(/^\/api\/github\/repos\/([^/]+)\/([^/]+)\/releases$/);
      if (releasesMatch) {
        return request.method === 'GET' ? handleReleases(request, env, releasesMatch) : methodNotAllowed();
      }

      if (url.pathname === '/api/images/prepare') {
        return request.method === 'POST' ? handlePrepare(request, env) : methodNotAllowed();
      }

      const uploadMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/upload$/);
      if (uploadMatch) {
        return request.method === 'PUT' ? handleUpload(request, env, uploadMatch[1]) : methodNotAllowed();
      }

      if (url.pathname === '/api/markdown') {
        return request.method === 'GET' ? handleMarkdown(request, url, env) : methodNotAllowed();
      }

      const publicMatch = url.pathname.match(/^\/r\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\.webp$/);
      if (publicMatch) {
        return request.method === 'GET' ? handlePublicImage(request, env, publicMatch) : methodNotAllowed();
      }

      if (url.pathname === '/api/health') {
        return json({ ok: true, service: 'shipkitty-api' });
      }

      return notFound();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unexpected error.';
      const status = caught instanceof AuthError ? caught.status : message.includes('limit reached') ? 429 : message.includes('not found') ? 404 : 400;
      return error(message, status);
    }
  },
};

async function handleOAuthStart(request: Request, env: Env, url: URL) {
  ensureOAuthConfigured(env);
  const redirectPath = sanitizeRedirectPath(url.searchParams.get('redirect') || '/');
  const oauth = await createOAuthStart(env, request, redirectPath);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.parse(now) + 10 * 60 * 1000).toISOString();
  await insertOAuthState(env.DB, { state: oauth.state, codeVerifier: oauth.codeVerifier, redirectPath, now, expiresAt });
  return Response.redirect(oauth.authorizeUrl, 302);
}

async function handleOAuthCallback(request: Request, env: Env, url: URL) {
  ensureOAuthConfigured(env);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return redirectToFrontend(env, request, '/?auth=failed');

  const storedState = await consumeOAuthState(env.DB, state);
  if (!storedState) return redirectToFrontend(env, request, '/?auth=expired');

  const token = await exchangeOAuthCode(env, request, code, storedState.code_verifier);
  const githubUser = await fetchGitHubUser(token.access_token);
  const now = new Date().toISOString();
  const userId = await upsertUserFromGitHub(env.DB, {
    githubUserId: String(githubUser.id),
    githubUsername: githubUser.login,
    email: githubUser.email,
    avatarUrl: githubUser.avatar_url,
    now,
  });

  await upsertGitHubToken(env.DB, {
    userId,
    accessToken: token.access_token,
    scope: token.scope ?? null,
    tokenType: token.token_type ?? null,
    now,
  });

  const sessionCookie = await createSessionCookie(env, request, userId, now);
  const headers = new Headers({ location: frontendUrl(env, request, storedState.redirect_path || '/?auth=ok') });
  headers.append('set-cookie', sessionCookie);
  return new Response(null, { status: 302, headers });
}

async function handleMe(request: Request, env: Env) {
  const user = await getSessionUser(request, env);
  if (!user) return corsJson(request, { user: null });
  return corsJson(request, {
    user: {
      id: user.id,
      githubUserId: user.githubUserId,
      githubUsername: user.githubUsername,
      email: user.email,
      avatarUrl: user.avatarUrl,
      scopes: splitScopes(user.scope),
    },
  });
}

async function handleLogout(request: Request, env: Env) {
  const cookie = await clearSession(request, env);
  return corsJson(request, { ok: true }, { headers: { 'set-cookie': cookie } });
}

async function handleRepos(request: Request, env: Env) {
  const user = await requireSessionUser(request, env);
  const repos = await fetchUserRepos(user.accessToken);
  return corsJson(request, { repos });
}

async function handleRepoVerify(request: Request, env: Env, match: RegExpMatchArray) {
  const user = await requireSessionUser(request, env);
  const owner = normalizeSegment(decodeURIComponent(match[1]));
  const repo = normalizeSegment(decodeURIComponent(match[2]));
  const { raw, summary } = await fetchRepo(user.accessToken, owner, repo);
  await upsertRepo(env.DB, summary.owner, summary.name, new Date().toISOString(), {
    userId: user.id,
    githubRepoId: raw.id,
    permission: summary.permission,
  });
  return corsJson(request, { ok: true, repo: summary });
}

async function handleReleases(request: Request, env: Env, match: RegExpMatchArray) {
  const user = await requireSessionUser(request, env);
  const owner = normalizeSegment(decodeURIComponent(match[1]));
  const repo = normalizeSegment(decodeURIComponent(match[2]));
  await fetchRepo(user.accessToken, owner, repo);
  const releases = await fetchReleases(user.accessToken, owner, repo);
  return corsJson(request, { releases });
}

async function handlePrepare(request: Request, env: Env) {
  const user = await requireSessionUser(request, env);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return error('Request body must be JSON.');
  }

  const owner = normalizeSegment(requireText((body as Record<string, unknown>).owner, 'owner', 80));
  const repo = normalizeSegment(requireText((body as Record<string, unknown>).repo, 'repo', 100));
  const releaseTagRaw = requireText((body as Record<string, unknown>).releaseTag, 'releaseTag', 120);
  const releaseTag = normalizeSegment(releaseTagRaw, 'release');
  const petName = requireText((body as Record<string, unknown>).petName, 'petName', 80);
  const petTitle = optionalText((body as Record<string, unknown>).petTitle, 120);
  const caption = optionalText((body as Record<string, unknown>).caption, 160) || `Release approved by ${petName} 🐾`;
  const width = optionalNumber((body as Record<string, unknown>).width);
  const height = optionalNumber((body as Record<string, unknown>).height);
  const now = new Date().toISOString();
  const imageId = randomId('img');

  const { raw, summary } = await fetchRepo(user.accessToken, owner, repo);
  const repoId = await upsertRepo(env.DB, summary.owner, summary.name, now, { userId: user.id, githubRepoId: raw.id, permission: summary.permission });
  const petId = await insertPet(env.DB, { userId: user.id, name: petName, title: petTitle, latestImageId: imageId, now });
  const publicUrl = buildPublicImageUrl(env, request, owner, repo, releaseTag, imageId);
  const markdown = buildMarkdown({ petName, petTitle, caption, publicUrl });
  const html = buildHtml({ petName, petTitle, caption, publicUrl });
  const r2Key = `repos/${owner}/${repo}/releases/${releaseTag}/${imageId}.webp`;

  const metadata: PreparedImageMetadata = {
    id: imageId,
    repoId,
    petId,
    userId: user.id,
    owner,
    repo,
    releaseTag,
    petName,
    petTitle,
    caption,
    width,
    height,
    r2Key,
    publicUrl,
    markdown,
    html,
    createdAt: now,
  };

  await insertPreparedImage(env.DB, metadata);
  await audit(env.DB, {
    userId: user.id,
    eventType: 'image_prepared',
    ipHash: await getIpHash(request),
    userAgent: request.headers.get('user-agent') ?? undefined,
    metadata: { imageId, owner, repo, releaseTag },
    now,
  });

  return corsJson(request, { imageId, uploadUrl: `/api/images/${imageId}/upload`, maxBytes: MAX_UPLOAD_BYTES, allowedTypes: ALLOWED_TYPES });
}

async function handleUpload(request: Request, env: Env, imageId: string) {
  const user = await requireSessionUser(request, env);
  const prepared = await getPreparedImage(env.DB, imageId);
  if (!prepared) return notFound();
  if (prepared.user_id !== user.id) throw new AuthError('This upload belongs to a different session.', 403);

  const ipHash = await getIpHash(request);
  await assertUploadRateLimit(env.DB, ipHash);

  assertAllowedContentLength(request.headers.get('content-length'));
  const mimeType = assertAllowedContentType(request.headers.get('content-type'));
  const bytes = await assertImageBytes(request, mimeType);

  await env.PET_IMAGES.put(prepared.r2_key, bytes, {
    httpMetadata: { contentType: mimeType, cacheControl: 'public, max-age=31536000, immutable' },
    customMetadata: { imageId, owner: prepared.owner, repo: prepared.repo, releaseTag: prepared.release_tag, userId: user.id },
  });

  const now = new Date().toISOString();
  const previousR2Key = await replaceReleaseImage(env.DB, { prepared, fileSizeBytes: bytes.byteLength, mimeType, now });

  if (previousR2Key) await env.PET_IMAGES.delete(previousR2Key);

  await audit(env.DB, {
    userId: user.id,
    eventType: 'image_uploaded',
    ipHash,
    userAgent: request.headers.get('user-agent') ?? undefined,
    metadata: { imageId, owner: prepared.owner, repo: prepared.repo, releaseTag: prepared.release_tag, bytes: bytes.byteLength },
    now,
  });

  return corsJson(request, { imageId, publicUrl: prepared.public_url, markdown: prepared.markdown, html: prepared.html });
}

async function handleMarkdown(request: Request, url: URL, env: Env) {
  const owner = normalizeSegment(requireText(url.searchParams.get('owner'), 'owner', 80));
  const repo = normalizeSegment(requireText(url.searchParams.get('repo'), 'repo', 100));
  const tag = normalizeSegment(requireText(url.searchParams.get('tag'), 'tag', 120));
  const row = await getReleaseImage(env.DB, owner, repo, tag);
  if (!row) return notFound();
  return corsJson(request, { imageId: row.id, publicUrl: row.public_url, markdown: row.markdown, html: row.html });
}

async function handlePublicImage(request: Request, env: Env, match: RegExpMatchArray) {
  const [, rawOwner, rawRepo, rawTag, rawImageId] = match;
  const owner = normalizeSegment(decodeURIComponent(rawOwner));
  const repo = normalizeSegment(decodeURIComponent(rawRepo));
  const tag = normalizeSegment(decodeURIComponent(rawTag));
  const imageId = decodeURIComponent(rawImageId);
  const row = await getReleaseImageByPublicRoute(env.DB, owner, repo, tag, imageId);
  if (!row) return notFound();

  const object = await env.PET_IMAGES.get(row.r2_key);
  if (!object) return notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('content-type', row.mime_type || 'image/webp');
  return new Response(object.body, { headers: withCorsHeaders(request, headers) });
}

function handleOptions(request: Request) {
  const origin = request.headers.get('origin') || '*';
  return new Response(null, {
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}

function ensureOAuthConfigured(env: Env) {
  if (!env.GITHUB_CLIENT_ID || env.GITHUB_CLIENT_ID.includes('replace-with') || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SECRET) {
    throw new AuthError('GitHub OAuth is not configured.', 500);
  }
}

function buildPublicImageUrl(env: Env, request: Request, owner: string, repo: string, releaseTag: string, imageId: string) {
  const base = getCdnBase(env, request);
  return new URL(`/r/${owner}/${repo}/${releaseTag}/${imageId}.webp`, base).toString();
}

function getCdnBase(env: Env, request: Request) {
  const origin = new URL(request.url).origin;
  const configuredBase = origin.includes('localhost') || origin.includes('127.0.0.1') ? origin : env.PUBLIC_CDN_BASE || origin;
  return normalizeHttpBaseUrl(configuredBase, 'PUBLIC_CDN_BASE');
}

function getFrontendBase(env: Env, request: Request) {
  return normalizeHttpBaseUrl(env.FRONTEND_BASE_URL || new URL(request.url).origin, 'FRONTEND_BASE_URL');
}

function normalizeHttpBaseUrl(value: string, name: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AuthError(`${name} must be a valid URL.`, 500);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new AuthError(`${name} must use http or https.`, 500);
  }

  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname.replace(/\/$/, '');
  return parsed.toString().replace(/\/$/, '');
}

function frontendUrl(env: Env, request: Request, path: string) {
  const cleanPath = sanitizeRedirectPath(path);
  return `${getFrontendBase(env, request)}${cleanPath}`;
}

function redirectToFrontend(env: Env, request: Request, path: string) {
  return Response.redirect(frontendUrl(env, request, path), 302);
}

function sanitizeRedirectPath(value: string) {
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  return value;
}

function splitScopes(scope: string | null) {
  return scope ? scope.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

function optionalText(value: unknown, maxLength: number) {
  if (value == null || typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function optionalNumber(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

async function getIpHash(request: Request) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  return hashIp(ip);
}
