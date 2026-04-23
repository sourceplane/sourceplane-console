PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  primary_email TEXT NOT NULL,
  normalized_email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_normalized_email ON users(normalized_email);

CREATE TABLE IF NOT EXISTS login_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL,
  requested_ip TEXT,
  last_attempt_at TEXT,
  delivery_mode TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_challenges_normalized_email ON login_challenges(normalized_email);
CREATE INDEX IF NOT EXISTS idx_login_challenges_expires_at ON login_challenges(expires_at);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT,
  secret_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_reason TEXT,
  last_used_at TEXT,
  user_agent TEXT,
  ip_address TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS service_principals (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role_names_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_service_principals_owner_user_id ON service_principals(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_service_principals_organization_id ON service_principals(organization_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  service_principal_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  visible_prefix TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  last_used_at TEXT,
  FOREIGN KEY (service_principal_id) REFERENCES service_principals(id),
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_owner_user_id ON api_keys(owner_user_id);

CREATE TABLE IF NOT EXISTS identity_event_outbox (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  envelope_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identity_event_outbox_occurred_at ON identity_event_outbox(occurred_at);