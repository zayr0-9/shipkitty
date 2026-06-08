PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  github_user_id TEXT UNIQUE,
  github_username TEXT,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repos (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  github_repo_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(owner, name),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS pets (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  species TEXT,
  title TEXT,
  default_caption TEXT,
  latest_image_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS prepared_images (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  pet_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  release_tag TEXT NOT NULL,
  pet_name TEXT NOT NULL,
  pet_title TEXT,
  caption TEXT,
  width INTEGER,
  height INTEGER,
  r2_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  markdown TEXT NOT NULL,
  html TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(repo_id) REFERENCES repos(id),
  FOREIGN KEY(pet_id) REFERENCES pets(id)
);

CREATE TABLE IF NOT EXISTS release_images (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL,
  pet_id TEXT,
  release_tag TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  mime_type TEXT NOT NULL,
  caption TEXT,
  markdown TEXT NOT NULL,
  html TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(repo_id) REFERENCES repos(id),
  FOREIGN KEY(pet_id) REFERENCES pets(id),
  UNIQUE(repo_id, release_tag)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event_type TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prepared_images_expires_at ON prepared_images(expires_at);
CREATE INDEX IF NOT EXISTS idx_release_images_repo_tag ON release_images(repo_id, release_tag);
CREATE INDEX IF NOT EXISTS idx_audit_events_ip_type_created ON audit_events(ip_hash, event_type, created_at);
