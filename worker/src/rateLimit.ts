const UPLOADS_PER_HOUR = 10;
const UPLOADS_PER_DAY = 50;

export async function assertUploadRateLimit(db: D1Database, ipHash: string) {
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const row = await db
    .prepare(
      `SELECT
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS hour_count,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS day_count
       FROM audit_events
       WHERE ip_hash = ? AND event_type = 'image_uploaded'`,
    )
    .bind(hourAgo, dayAgo, ipHash)
    .first<{ hour_count: number | null; day_count: number | null }>();

  if ((row?.hour_count ?? 0) >= UPLOADS_PER_HOUR) {
    throw new Error('Upload limit reached. Try again in an hour.');
  }

  if ((row?.day_count ?? 0) >= UPLOADS_PER_DAY) {
    throw new Error('Daily upload limit reached. Try again tomorrow.');
  }
}
