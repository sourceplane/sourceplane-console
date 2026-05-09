-- Identity worker initial Postgres schema
-- Scoped to the identity schema to avoid cross-context collisions.
-- Apply to the shared Supabase Postgres database reached via Hyperdrive.

CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE IF NOT EXISTS identity.users (
  id TEXT PRIMARY KEY,
  primary_email TEXT NOT NULL,
  normalized_email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identity_users_normalized_email ON identity.users (normalized_email);

CREATE TABLE IF NOT EXISTS identity.login_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL,
  requested_ip TEXT,
  last_attempt_at TIMESTAMPTZ,
  delivery_mode TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identity_login_challenges_normalized_email ON identity.login_challenges (normalized_email);
CREATE INDEX IF NOT EXISTS idx_identity_login_challenges_expires_at ON identity.login_challenges (expires_at);

CREATE TABLE IF NOT EXISTS identity.sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES identity.users (id),
  organization_id TEXT,
  secret_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  last_used_at TIMESTAMPTZ,
  user_agent TEXT,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_identity_sessions_user_id ON identity.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_identity_sessions_expires_at ON identity.sessions (expires_at);

CREATE TABLE IF NOT EXISTS identity.service_principals (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES identity.users (id),
  organization_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role_names_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_identity_service_principals_owner_user_id ON identity.service_principals (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_identity_service_principals_organization_id ON identity.service_principals (organization_id);

CREATE TABLE IF NOT EXISTS identity.api_keys (
  id TEXT PRIMARY KEY,
  service_principal_id TEXT NOT NULL UNIQUE REFERENCES identity.service_principals (id),
  owner_user_id TEXT NOT NULL REFERENCES identity.users (id),
  label TEXT NOT NULL,
  visible_prefix TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_identity_api_keys_owner_user_id ON identity.api_keys (owner_user_id);

CREATE TABLE IF NOT EXISTS identity.event_outbox (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  envelope_json TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identity_event_outbox_occurred_at ON identity.event_outbox (occurred_at);
