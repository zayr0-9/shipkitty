import { ALLOWED_TYPES, MAX_UPLOAD_BYTES } from './constants';
import { audit, getPreparedImage, getReleaseImage, getReleaseImageByPublicRoute, insertPet, insertPreparedImage, replaceReleaseImage, upsertRepo } from './db';
import { buildHtml, buildMarkdown } from './markdown';
import { assertUploadRateLimit } from './rateLimit';
import type { Env, PreparedImageMetadata } from './types';
import { assertAllowedContentLength, assertAllowedContentType, assertImageBytes } from './validation';
import { error, hashIp, json, methodNotAllowed, normalizeSegment, notFound, randomId, requireText } from './utils';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === 'OPTIONS') return handleOptions();

      if (url.pathname === '/api/images/prepare') {
        return request.method === 'POST' ? handlePrepare(request, env) : methodNotAllowed();
      }

      const uploadMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/upload$/);
      if (uploadMatch) {
        return request.method === 'PUT' ? handleUpload(request, env, uploadMatch[1]) : methodNotAllowed();
      }

      if (url.pathname === '/api/markdown') {
        return request.method === 'GET' ? handleMarkdown(url, env) : methodNotAllowed();
      }

      const publicMatch = url.pathname.match(/^\/r\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\.webp$/);
      if (publicMatch) {
        return request.method === 'GET' ? handlePublicImage(env, publicMatch) : methodNotAllowed();
      }

      if (url.pathname === '/api/health') {
        return json({ ok: true, service: 'petship-api' });
      }

      return notFound();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unexpected error.';
      const status = message.includes('limit reached') ? 429 : 400;
      return error(message, status);
    }
  },
};

async function handlePrepare(request: Request, env: Env) {
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

  const repoId = await upsertRepo(env.DB, owner, repo, now);
  const petId = await insertPet(env.DB, { name: petName, title: petTitle, latestImageId: imageId, now });
  const publicUrl = `${getCdnBase(env, request)}/r/${owner}/${repo}/${releaseTag}/${imageId}.webp`;
  const markdown = buildMarkdown({ petName, petTitle, caption, publicUrl });
  const html = buildHtml({ petName, petTitle, caption, publicUrl });
  const r2Key = `repos/${owner}/${repo}/releases/${releaseTag}/${imageId}.webp`;

  const metadata: PreparedImageMetadata = {
    id: imageId,
    repoId,
    petId,
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
    eventType: 'image_prepared',
    ipHash: await getIpHash(request),
    userAgent: request.headers.get('user-agent') ?? undefined,
    metadata: { imageId, owner, repo, releaseTag },
    now,
  });

  return json({
    imageId,
    uploadUrl: `/api/images/${imageId}/upload`,
    maxBytes: MAX_UPLOAD_BYTES,
    allowedTypes: ALLOWED_TYPES,
  });
}

async function handleUpload(request: Request, env: Env, imageId: string) {
  const prepared = await getPreparedImage(env.DB, imageId);
  if (!prepared) {
    return notFound();
  }

  const ipHash = await getIpHash(request);
  await assertUploadRateLimit(env.DB, ipHash);

  assertAllowedContentLength(request.headers.get('content-length'));
  const mimeType = assertAllowedContentType(request.headers.get('content-type'));
  const bytes = await assertImageBytes(request, mimeType);

  await env.PET_IMAGES.put(prepared.r2_key, bytes, {
    httpMetadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      imageId,
      owner: prepared.owner,
      repo: prepared.repo,
      releaseTag: prepared.release_tag,
    },
  });

  const now = new Date().toISOString();
  const previousR2Key = await replaceReleaseImage(env.DB, {
    prepared,
    fileSizeBytes: bytes.byteLength,
    mimeType,
    now,
  });

  if (previousR2Key) {
    await env.PET_IMAGES.delete(previousR2Key);
  }

  await audit(env.DB, {
    eventType: 'image_uploaded',
    ipHash,
    userAgent: request.headers.get('user-agent') ?? undefined,
    metadata: { imageId, owner: prepared.owner, repo: prepared.repo, releaseTag: prepared.release_tag, bytes: bytes.byteLength },
    now,
  });

  return json({
    imageId,
    publicUrl: prepared.public_url,
    markdown: prepared.markdown,
    html: prepared.html,
  });
}

async function handleMarkdown(url: URL, env: Env) {
  const owner = normalizeSegment(requireText(url.searchParams.get('owner'), 'owner', 80));
  const repo = normalizeSegment(requireText(url.searchParams.get('repo'), 'repo', 100));
  const tag = normalizeSegment(requireText(url.searchParams.get('tag'), 'tag', 120));
  const row = await getReleaseImage(env.DB, owner, repo, tag);

  if (!row) {
    return notFound();
  }

  return json({ imageId: row.id, publicUrl: row.public_url, markdown: row.markdown, html: row.html });
}

async function handlePublicImage(env: Env, match: RegExpMatchArray) {
  const [, rawOwner, rawRepo, rawTag, rawImageId] = match;
  const owner = normalizeSegment(decodeURIComponent(rawOwner));
  const repo = normalizeSegment(decodeURIComponent(rawRepo));
  const tag = normalizeSegment(decodeURIComponent(rawTag));
  const imageId = decodeURIComponent(rawImageId);
  const row = await getReleaseImageByPublicRoute(env.DB, owner, repo, tag, imageId);

  if (!row) {
    return notFound();
  }

  const object = await env.PET_IMAGES.get(row.r2_key);
  if (!object) {
    return notFound();
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('content-type', row.mime_type || 'image/webp');

  return new Response(object.body, { headers });
}

function handleOptions() {
  return new Response(null, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    },
  });
}

function getCdnBase(env: Env, request: Request) {
  const origin = new URL(request.url).origin;

  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return origin;
  }

  return (env.PUBLIC_CDN_BASE || origin).replace(/\/$/, '');
}

function optionalText(value: unknown, maxLength: number) {
  if (value == null) return '';
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function optionalNumber(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value);
}

async function getIpHash(request: Request) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  return hashIp(ip);
}
