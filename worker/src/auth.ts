import { createSession, deleteSessionByHash, getSessionByHash } from './db';
import type { Env } from './types';

export type SessionUser = {
  id: string;
  githubUserId: string;
  githubUsername: string;
  email: string | null;
  avatarUrl: string | null;
  scope: string | null;
  accessToken: string;
};

const SESSION_COOKIE = 'petship_session';
const SESSION_DAYS = 30;

export function getCookie(request: Request, name: string) {
  const cookie = request.headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === name) return decodeURIComponent(rawValue.join('='));
  }
  return null;
}

export async function getSessionUser(request: Request, env: Env): Promise<SessionUser | null> {
  const sessionToken = getCookie(request, SESSION_COOKIE);
  if (!sessionToken) return null;

  const sessionHash = await hashToken(sessionToken, env.SESSION_SECRET);
  const row = await getSessionByHash(env.DB, sessionHash);
  if (!row) return null;
  return {
    id: row.id,
    githubUserId: row.github_user_id,
    githubUsername: row.github_username,
    email: row.email,
    avatarUrl: row.avatar_url,
    scope: row.scope,
    accessToken: row.access_token,
  };
}

export async function requireSessionUser(request: Request, env: Env) {
  const user = await getSessionUser(request, env);
  if (!user) throw new AuthError('Sign in with GitHub first.', 401);
  return user;
}

export async function createSessionCookie(env: Env, request: Request, userId: string, now: string) {
  const token = randomToken(32);
  const sessionHash = await hashToken(token, env.SESSION_SECRET);
  const expiresAt = new Date(Date.parse(now) + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await createSession(env.DB, { userId, sessionHash, now, expiresAt });
  return serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 24 * 60 * 60, request });
}

export async function clearSession(request: Request, env: Env) {
  const sessionToken = getCookie(request, SESSION_COOKIE);
  if (sessionToken) {
    await deleteSessionByHash(env.DB, await hashToken(sessionToken, env.SESSION_SECRET));
  }
  return serializeCookie(SESSION_COOKIE, '', { maxAge: 0, request });
}

export function serializeCookie(name: string, value: string, input: { maxAge: number; request: Request }) {
  const secure = isSecureCookie(input.request) ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${input.maxAge}${secure}`;
}

export function randomToken(bytes = 32) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return base64Url(array);
}

export async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

async function hashToken(token: string, secret: string) {
  return sha256Base64Url(`${secret}:${token}`);
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function isSecureCookie(request: Request) {
  const url = new URL(request.url);
  return url.protocol === 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1';
}

export class AuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
  }
}
