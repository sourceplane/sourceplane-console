PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, user_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_organization_id ON memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);

CREATE TABLE IF NOT EXISTS role_assignments (
  id TEXT PRIMARY KEY,
  membership_id TEXT NOT NULL,
  subject_user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  scope_kind TEXT NOT NULL CHECK (scope_kind IN ('organization', 'project', 'environment', 'resource')),
  scope_key TEXT NOT NULL,
  project_id TEXT,
  environment_id TEXT,
  resource_id TEXT,
  role_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (subject_user_id, scope_key),
  FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_role_assignments_org_subject ON role_assignments(organization_id, subject_user_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_membership_id ON role_assignments(membership_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_scope_kind ON role_assignments(scope_kind);

CREATE TABLE IF NOT EXISTS organization_invites (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL,
  role_name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  accepted_by_user_id TEXT,
  revoked_at TEXT,
  revoked_by_user_id TEXT,
  created_by_user_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_normalized_email ON organization_invites(normalized_email);
CREATE INDEX IF NOT EXISTS idx_org_invites_expires_at ON organization_invites(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invites_active_email ON organization_invites(organization_id, normalized_email) WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS membership_event_outbox (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  envelope_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_membership_event_outbox_occurred_at ON membership_event_outbox(occurred_at);
