PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  redirect_path TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_hash TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS github_tokens (
  user_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  scope TEXT,
  token_type TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_repos (
  user_id TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  github_repo_id TEXT,
  permission TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, repo_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(repo_id) REFERENCES repos(id)
);

ALTER TABLE prepared_images ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE release_images ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE users ADD COLUMN avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_hash_expires ON sessions(session_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_repos_user_owner_name ON repos(user_id, owner, name);
CREATE INDEX IF NOT EXISTS idx_pets_user_created ON pets(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_type_created ON audit_events(user_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_prepared_images_user ON prepared_images(user_id);
CREATE INDEX IF NOT EXISTS idx_release_images_user ON release_images(user_id);
