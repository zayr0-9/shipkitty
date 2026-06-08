import { PREPARED_TTL_SECONDS } from './constants';
import type { PreparedImageMetadata } from './types';
import { randomId } from './utils';

export type UserRow = {
  id: string;
  github_user_id: string;
  github_username: string;
  email: string | null;
  avatar_url: string | null;
  scope: string | null;
  access_token: string;
};

export async function insertOAuthState(db: D1Database, input: { state: string; codeVerifier: string; redirectPath: string; now: string; expiresAt: string }) {
  await db
    .prepare('INSERT INTO oauth_states (state, code_verifier, redirect_path, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(input.state, input.codeVerifier, input.redirectPath, input.now, input.expiresAt)
    .run();
}

export async function consumeOAuthState(db: D1Database, state: string) {
  const row = await db
    .prepare('SELECT state, code_verifier, redirect_path FROM oauth_states WHERE state = ? AND expires_at > ?')
    .bind(state, new Date().toISOString())
    .first<{ state: string; code_verifier: string; redirect_path: string | null }>();

  await db.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();
  return row;
}

export async function upsertUserFromGitHub(db: D1Database, input: { githubUserId: string; githubUsername: string; email?: string | null; avatarUrl?: string | null; now: string }) {
  const existing = await db.prepare('SELECT id FROM users WHERE github_user_id = ?').bind(input.githubUserId).first<{ id: string }>();
  const id = existing?.id ?? randomId('u');

  if (existing) {
    await db
      .prepare('UPDATE users SET github_username = ?, email = ?, avatar_url = ?, updated_at = ? WHERE id = ?')
      .bind(input.githubUsername, input.email ?? null, input.avatarUrl ?? null, input.now, id)
      .run();
  } else {
    await db
      .prepare('INSERT INTO users (id, github_user_id, github_username, email, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, input.githubUserId, input.githubUsername, input.email ?? null, input.avatarUrl ?? null, input.now, input.now)
      .run();
  }

  return id;
}

export async function upsertGitHubToken(db: D1Database, input: { userId: string; accessToken: string; scope?: string | null; tokenType?: string | null; now: string }) {
  await db
    .prepare(
      `INSERT INTO github_tokens (user_id, access_token, scope, token_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         access_token = excluded.access_token,
         scope = excluded.scope,
         token_type = excluded.token_type,
         updated_at = excluded.updated_at`,
    )
    .bind(input.userId, input.accessToken, input.scope ?? null, input.tokenType ?? null, input.now, input.now)
    .run();
}

export async function createSession(db: D1Database, input: { userId: string; sessionHash: string; now: string; expiresAt: string }) {
  await db
    .prepare('INSERT INTO sessions (id, user_id, session_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(randomId('sess'), input.userId, input.sessionHash, input.now, input.expiresAt)
    .run();
}

export async function getSessionByHash(db: D1Database, sessionHash: string) {
  return db
    .prepare(
      `SELECT users.id, users.github_user_id, users.github_username, users.email, users.avatar_url, github_tokens.scope, github_tokens.access_token
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       JOIN github_tokens ON github_tokens.user_id = users.id
       WHERE sessions.session_hash = ? AND sessions.expires_at > ?`,
    )
    .bind(sessionHash, new Date().toISOString())
    .first<UserRow>();
}

export async function deleteSessionByHash(db: D1Database, sessionHash: string) {
  await db.prepare('DELETE FROM sessions WHERE session_hash = ?').bind(sessionHash).run();
}

export async function upsertRepo(db: D1Database, owner: string, name: string, now: string, options: { userId?: string; githubRepoId?: string | number; permission?: string | null } = {}) {
  const existing = await db.prepare('SELECT id FROM repos WHERE owner = ? AND name = ?').bind(owner, name).first<{ id: string }>();
  const repoId = existing?.id ?? randomId('repo');

  if (existing) {
    await db.prepare('UPDATE repos SET github_repo_id = COALESCE(?, github_repo_id), updated_at = ? WHERE id = ?').bind(options.githubRepoId?.toString() ?? null, now, repoId).run();
  } else {
    await db
      .prepare('INSERT INTO repos (id, user_id, owner, name, github_repo_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(repoId, options.userId ?? null, owner, name, options.githubRepoId?.toString() ?? null, now, now)
      .run();
  }

  if (options.userId) {
    await db
      .prepare(
        `INSERT INTO user_repos (user_id, repo_id, github_repo_id, permission, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, repo_id) DO UPDATE SET
           github_repo_id = excluded.github_repo_id,
           permission = excluded.permission,
           updated_at = excluded.updated_at`,
      )
      .bind(options.userId, repoId, options.githubRepoId?.toString() ?? null, options.permission ?? null, now, now)
      .run();
  }

  return repoId;
}

export async function insertPet(db: D1Database, input: { userId?: string; name: string; title: string; latestImageId: string; now: string }) {
  const id = randomId('pet');
  await db
    .prepare('INSERT INTO pets (id, user_id, name, title, latest_image_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, input.userId ?? null, input.name, input.title || null, input.latestImageId, input.now, input.now)
    .run();
  return id;
}

export async function insertPreparedImage(db: D1Database, metadata: PreparedImageMetadata) {
  await db
    .prepare(
      `INSERT INTO prepared_images
       (id, repo_id, pet_id, user_id, owner, repo, release_tag, pet_name, pet_title, caption, width, height, r2_key, public_url, markdown, html, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      metadata.id,
      metadata.repoId,
      metadata.petId,
      metadata.userId ?? null,
      metadata.owner,
      metadata.repo,
      metadata.releaseTag,
      metadata.petName,
      metadata.petTitle || null,
      metadata.caption || null,
      metadata.width,
      metadata.height,
      metadata.r2Key,
      metadata.publicUrl,
      metadata.markdown,
      metadata.html,
      metadata.createdAt,
      new Date(Date.parse(metadata.createdAt) + PREPARED_TTL_SECONDS * 1000).toISOString(),
    )
    .run();
}

export async function getPreparedImage(db: D1Database, imageId: string) {
  return db.prepare('SELECT * FROM prepared_images WHERE id = ? AND expires_at > ?').bind(imageId, new Date().toISOString()).first<PreparedImageRow>();
}

export async function replaceReleaseImage(db: D1Database, input: { prepared: PreparedImageRow; fileSizeBytes: number; mimeType: string; now: string }) {
  const previous = await db.prepare('SELECT r2_key FROM release_images WHERE repo_id = ? AND release_tag = ?').bind(input.prepared.repo_id, input.prepared.release_tag).first<{ r2_key: string }>();

  await db
    .prepare(
      `INSERT INTO release_images
       (id, repo_id, pet_id, user_id, release_tag, r2_key, public_url, file_size_bytes, width, height, mime_type, caption, markdown, html, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(repo_id, release_tag) DO UPDATE SET
         id = excluded.id,
         pet_id = excluded.pet_id,
         user_id = excluded.user_id,
         r2_key = excluded.r2_key,
         public_url = excluded.public_url,
         file_size_bytes = excluded.file_size_bytes,
         width = excluded.width,
         height = excluded.height,
         mime_type = excluded.mime_type,
         caption = excluded.caption,
         markdown = excluded.markdown,
         html = excluded.html,
         updated_at = excluded.updated_at`,
    )
    .bind(
      input.prepared.id,
      input.prepared.repo_id,
      input.prepared.pet_id,
      input.prepared.user_id,
      input.prepared.release_tag,
      input.prepared.r2_key,
      input.prepared.public_url,
      input.fileSizeBytes,
      input.prepared.width,
      input.prepared.height,
      input.mimeType,
      input.prepared.caption,
      input.prepared.markdown,
      input.prepared.html,
      input.now,
      input.now,
    )
    .run();

  await db.prepare('DELETE FROM prepared_images WHERE id = ?').bind(input.prepared.id).run();
  return previous?.r2_key === input.prepared.r2_key ? null : previous?.r2_key ?? null;
}

export async function getReleaseImage(db: D1Database, owner: string, repo: string, tag: string) {
  return db
    .prepare(
      `SELECT release_images.id, release_images.public_url, release_images.markdown, release_images.html
       FROM release_images
       JOIN repos ON repos.id = release_images.repo_id
       WHERE lower(repos.owner) = lower(?) AND lower(repos.name) = lower(?) AND release_images.release_tag = ?`,
    )
    .bind(owner, repo, tag)
    .first<{ id: string; public_url: string; markdown: string; html: string }>();
}

export async function getReleaseImageByPublicRoute(db: D1Database, owner: string, repo: string, tag: string, imageId: string) {
  return db
    .prepare(
      `SELECT release_images.r2_key, release_images.mime_type
       FROM release_images
       JOIN repos ON repos.id = release_images.repo_id
       WHERE lower(repos.owner) = lower(?) AND lower(repos.name) = lower(?) AND release_images.release_tag = ? AND release_images.id = ?`,
    )
    .bind(owner, repo, tag, imageId)
    .first<{ r2_key: string; mime_type: string }>();
}

export async function audit(db: D1Database, input: { userId?: string; eventType: string; ipHash?: string; userAgent?: string; metadata?: unknown; now: string }) {
  await db
    .prepare('INSERT INTO audit_events (id, user_id, event_type, ip_hash, user_agent, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(randomId('evt'), input.userId ?? null, input.eventType, input.ipHash ?? null, input.userAgent ?? null, input.metadata ? JSON.stringify(input.metadata) : null, input.now)
    .run();
}

type PreparedImageRow = {
  id: string;
  repo_id: string;
  pet_id: string;
  user_id: string | null;
  owner: string;
  repo: string;
  release_tag: string;
  pet_name: string;
  pet_title: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  r2_key: string;
  public_url: string;
  markdown: string;
  html: string;
  created_at: string;
  expires_at: string;
};

export async function getReleaseImageForUser(db: D1Database, imageId: string, userId: string) {
  return db
    .prepare(
      `SELECT release_images.id, release_images.user_id, release_images.release_tag, release_images.markdown, release_images.public_url,
              repos.owner, repos.name AS repo
       FROM release_images
       JOIN repos ON repos.id = release_images.repo_id
       WHERE release_images.id = ? AND release_images.user_id = ?`,
    )
    .bind(imageId, userId)
    .first<{
      id: string;
      user_id: string;
      release_tag: string;
      markdown: string;
      public_url: string;
      owner: string;
      repo: string;
    }>();
}
