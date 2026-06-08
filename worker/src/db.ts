import { PREPARED_TTL_SECONDS } from './constants';
import type { PreparedImageMetadata } from './types';
import { randomId } from './utils';

export async function upsertRepo(db: D1Database, owner: string, name: string, now: string) {
  const existing = await db
    .prepare('SELECT id FROM repos WHERE owner = ? AND name = ?')
    .bind(owner, name)
    .first<{ id: string }>();

  if (existing) return existing.id;

  const id = randomId('repo');
  await db
    .prepare('INSERT INTO repos (id, owner, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, owner, name, now, now)
    .run();

  return id;
}

export async function insertPet(db: D1Database, input: { name: string; title: string; latestImageId: string; now: string }) {
  const id = randomId('pet');
  await db
    .prepare('INSERT INTO pets (id, name, title, latest_image_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, input.name, input.title || null, input.latestImageId, input.now, input.now)
    .run();
  return id;
}

export async function insertPreparedImage(db: D1Database, metadata: PreparedImageMetadata) {
  await db
    .prepare(
      `INSERT INTO prepared_images
       (id, repo_id, pet_id, owner, repo, release_tag, pet_name, pet_title, caption, width, height, r2_key, public_url, markdown, html, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      metadata.id,
      metadata.repoId,
      metadata.petId,
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
  return db
    .prepare('SELECT * FROM prepared_images WHERE id = ? AND expires_at > ?')
    .bind(imageId, new Date().toISOString())
    .first<PreparedImageRow>();
}

export async function replaceReleaseImage(db: D1Database, input: {
  prepared: PreparedImageRow;
  fileSizeBytes: number;
  mimeType: string;
  now: string;
}) {
  const previous = await db
    .prepare('SELECT r2_key FROM release_images WHERE repo_id = ? AND release_tag = ?')
    .bind(input.prepared.repo_id, input.prepared.release_tag)
    .first<{ r2_key: string }>();

  await db
    .prepare(
      `INSERT INTO release_images
       (id, repo_id, pet_id, release_tag, r2_key, public_url, file_size_bytes, width, height, mime_type, caption, markdown, html, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(repo_id, release_tag) DO UPDATE SET
         pet_id = excluded.pet_id,
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
       WHERE repos.owner = ? AND repos.name = ? AND release_images.release_tag = ?`,
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
       WHERE repos.owner = ? AND repos.name = ? AND release_images.release_tag = ? AND release_images.id = ?`,
    )
    .bind(owner, repo, tag, imageId)
    .first<{ r2_key: string; mime_type: string }>();
}

export async function audit(db: D1Database, input: { eventType: string; ipHash?: string; userAgent?: string; metadata?: unknown; now: string }) {
  await db
    .prepare('INSERT INTO audit_events (id, event_type, ip_hash, user_agent, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(randomId('evt'), input.eventType, input.ipHash ?? null, input.userAgent ?? null, input.metadata ? JSON.stringify(input.metadata) : null, input.now)
    .run();
}

type PreparedImageRow = {
  id: string;
  repo_id: string;
  pet_id: string;
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
