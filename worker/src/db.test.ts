import { describe, expect, it, vi } from 'vitest';
import { getReleaseImageForUser, replaceReleaseImage } from './db';

type Statement = {
  sql: string;
  values: unknown[];
  bind: (...values: unknown[]) => Statement;
  first: <T>() => Promise<T | null>;
  run: () => Promise<void>;
};

function createMockD1(previousR2Key: string | null) {
  const statements: Statement[] = [];
  const db = {
    prepare(sql: string) {
      const statement: Statement = {
        sql,
        values: [],
        bind(...values: unknown[]) {
          statement.values = values;
          return statement;
        },
        async first<T>() {
          return previousR2Key ? ({ r2_key: previousR2Key } as T) : null;
        },
        run: vi.fn(async () => undefined),
      };
      statements.push(statement);
      return statement;
    },
  } as unknown as D1Database;

  return { db, statements };
}

const prepared = {
  id: 'img_new',
  repo_id: 'repo_1',
  pet_id: 'pet_1',
  user_id: 'user_1',
  owner: 'owner',
  repo: 'repo',
  release_tag: 'v1',
  pet_name: 'Bobby',
  pet_title: 'CPO',
  caption: 'Approved',
  width: 100,
  height: 100,
  r2_key: 'repos/owner/repo/releases/v1/img_new.webp',
  public_url: 'https://cdn.example.test/r/owner/repo/v1/img_new.webp',
  markdown: 'markdown',
  html: 'html',
  created_at: '2026-06-08T00:00:00.000Z',
  expires_at: '2026-06-08T00:15:00.000Z',
};

describe('replaceReleaseImage', () => {
  it('updates the active release image id on replacement so returned public URLs resolve', async () => {
    const { db, statements } = createMockD1('repos/owner/repo/releases/v1/img_old.webp');

    const previous = await replaceReleaseImage(db, {
      prepared,
      fileSizeBytes: 1234,
      mimeType: 'image/webp',
      now: '2026-06-08T00:01:00.000Z',
    });

    const upsert = statements.find((statement) => statement.sql.includes('INSERT INTO release_images'));
    expect(upsert?.sql).toContain('id = excluded.id');
    expect(previous).toBe('repos/owner/repo/releases/v1/img_old.webp');
  });
});

describe('getReleaseImageForUser', () => {
  it('filters active release image lookup by image id and user id', async () => {
    const { db, statements } = createMockD1(null);

    await getReleaseImageForUser(db, 'img_1', 'user_1');

    const query = statements[0];
    expect(query.sql).toContain('JOIN repos ON repos.id = release_images.repo_id');
    expect(query.sql).toContain('WHERE release_images.id = ? AND release_images.user_id = ?');
    expect(query.values).toEqual(['img_1', 'user_1']);
  });
});
