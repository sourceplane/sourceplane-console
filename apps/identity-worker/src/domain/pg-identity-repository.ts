/**
 * PostgresIdentityRepository
 *
 * Implements IdentityRepository using a Postgres connection obtained from
 * Cloudflare Hyperdrive (production) or any postgres-compatible connectionString
 * (for future local Postgres test scenarios).
 *
 * SQL details are fully encapsulated here. All queries use parameterized
 * binding via postgres.js tagged template literals. All tables live in the
 * `identity` schema to avoid cross-context collisions.
 *
 * Multi-step mutations that must be atomic (revokeApiKeyAndServicePrincipal)
 * are wrapped in a Postgres transaction.
 */
import postgres from "postgres";

import { roleNameSchema, type RoleName, type SourceplaneEventEnvelope } from "@sourceplane/contracts";

import type {
  ApiKeyRecord,
  EnsureUserInput,
  IdentityRepository,
  LoginChallengeRecord,
  NewApiKeyRecord,
  NewLoginChallengeRecord,
  NewServicePrincipalRecord,
  NewSessionRecord,
  ServicePrincipalRecord,
  SessionRecord,
  UserRecord
} from "./repository.js";

// ---------------------------------------------------------------------------
// Row shapes returned by Postgres queries
// ---------------------------------------------------------------------------

interface UserRow {
  created_at: string;
  id: string;
  normalized_email: string;
  primary_email: string;
  updated_at: string;
}

interface LoginChallengeRow {
  attempt_count: number;
  code_hash: string;
  consumed_at: string | null;
  created_at: string;
  delivery_mode: string;
  email: string;
  expires_at: string;
  id: string;
  last_attempt_at: string | null;
  max_attempts: number;
  normalized_email: string;
  requested_ip: string | null;
}

interface SessionRow {
  created_at: string;
  expires_at: string;
  id: string;
  ip_address: string | null;
  last_used_at: string | null;
  organization_id: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  secret_hash: string;
  token_prefix: string;
  user_agent: string | null;
  user_created_at: string;
  user_id: string;
  user_normalized_email: string;
  user_primary_email: string;
  user_updated_at: string;
}

interface ApiKeyRow {
  api_key_created_at: string;
  api_key_expires_at: string | null;
  api_key_id: string;
  api_key_label: string;
  api_key_last_used_at: string | null;
  api_key_owner_user_id: string;
  api_key_prefix: string;
  api_key_revoked_at: string | null;
  api_key_secret_hash: string;
  service_principal_created_at: string;
  service_principal_display_name: string;
  service_principal_id: string;
  service_principal_org_id: string;
  service_principal_owner_user_id: string;
  service_principal_revoked_at: string | null;
  service_principal_role_names_json: string;
}

// ---------------------------------------------------------------------------
// Repository implementation
// ---------------------------------------------------------------------------

export class PostgresIdentityRepository implements IdentityRepository {
  private readonly sql: postgres.Sql;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, {
      // postgres.js defaults; keep explicit for clarity.
      max: 1, // Cloudflare Workers run per-isolate; one connection is fine.
      idle_timeout: 20,
      connect_timeout: 10,
      // Prevent postgres.js from trying to set application_name via SET which
      // fails when the connection is pre-authenticated by Hyperdrive.
      connection: {
        application_name: "identity-worker"
      }
    });
  }

  async appendEvent(event: SourceplaneEventEnvelope): Promise<void> {
    await this.sql`
      INSERT INTO identity.event_outbox (id, event_type, envelope_json, occurred_at)
      VALUES (${event.id}, ${event.type}, ${JSON.stringify(event)}, ${event.occurredAt})
    `;
  }

  async consumeLoginChallenge(challengeId: string, consumedAt: string): Promise<boolean> {
    const result = await this.sql`
      UPDATE identity.login_challenges
      SET consumed_at = ${consumedAt}
      WHERE id = ${challengeId} AND consumed_at IS NULL
    `;
    return result.count > 0;
  }

  async createApiKey(record: NewApiKeyRecord): Promise<void> {
    await this.sql`
      INSERT INTO identity.api_keys (
        id, service_principal_id, owner_user_id, label,
        visible_prefix, secret_hash, created_at, expires_at,
        revoked_at, last_used_at
      ) VALUES (
        ${record.id}, ${record.servicePrincipalId}, ${record.ownerUserId},
        ${record.label}, ${record.prefix}, ${record.secretHash},
        ${record.createdAt}, ${record.expiresAt ?? null},
        NULL, NULL
      )
    `;
  }

  async createLoginChallenge(record: NewLoginChallengeRecord): Promise<void> {
    await this.sql`
      INSERT INTO identity.login_challenges (
        id, email, normalized_email, code_hash, created_at, expires_at,
        consumed_at, attempt_count, max_attempts, requested_ip, last_attempt_at,
        delivery_mode
      ) VALUES (
        ${record.id}, ${record.email}, ${record.normalizedEmail},
        ${record.codeHash}, ${record.createdAt}, ${record.expiresAt},
        NULL, 0, ${record.maxAttempts}, ${record.requestedIp ?? null},
        NULL, ${record.deliveryMode}
      )
    `;
  }

  async createServicePrincipal(record: NewServicePrincipalRecord): Promise<void> {
    await this.sql`
      INSERT INTO identity.service_principals (
        id, owner_user_id, organization_id, display_name,
        role_names_json, created_at, revoked_at
      ) VALUES (
        ${record.id}, ${record.ownerUserId}, ${record.organizationId},
        ${record.displayName}, ${JSON.stringify(record.roleNames)},
        ${record.createdAt}, NULL
      )
    `;
  }

  async createSession(record: NewSessionRecord): Promise<void> {
    await this.sql`
      INSERT INTO identity.sessions (
        id, user_id, organization_id, secret_hash, token_prefix,
        created_at, expires_at, revoked_at, revoked_reason,
        last_used_at, user_agent, ip_address
      ) VALUES (
        ${record.id}, ${record.userId}, ${record.organizationId ?? null},
        ${record.secretHash}, ${record.tokenPrefix}, ${record.createdAt},
        ${record.expiresAt}, NULL, NULL, NULL,
        ${record.userAgent ?? null}, ${record.ipAddress ?? null}
      )
    `;
  }

  async ensureUser(input: EnsureUserInput): Promise<{ created: boolean; user: UserRecord }> {
    // Use INSERT ... ON CONFLICT DO NOTHING for idempotent upsert, then read back.
    const insertResult = await this.sql`
      INSERT INTO identity.users (id, primary_email, normalized_email, created_at, updated_at)
      VALUES (${input.id}, ${input.primaryEmail}, ${input.normalizedEmail}, ${input.createdAt}, ${input.updatedAt})
      ON CONFLICT (normalized_email) DO NOTHING
    `;

    const rows = await this.sql<UserRow[]>`
      SELECT id, primary_email, normalized_email, created_at, updated_at
      FROM identity.users
      WHERE normalized_email = ${input.normalizedEmail}
    `;

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to read the ensured user record.");
    }

    return {
      created: insertResult.count > 0,
      user: mapUserRow(row)
    };
  }

  async findApiKeyById(apiKeyId: string): Promise<ApiKeyRecord | null> {
    const rows = await this.sql<ApiKeyRow[]>`
      SELECT
        ak.id                   AS api_key_id,
        ak.owner_user_id        AS api_key_owner_user_id,
        ak.label                AS api_key_label,
        ak.visible_prefix       AS api_key_prefix,
        ak.secret_hash          AS api_key_secret_hash,
        ak.created_at           AS api_key_created_at,
        ak.expires_at           AS api_key_expires_at,
        ak.revoked_at           AS api_key_revoked_at,
        ak.last_used_at         AS api_key_last_used_at,
        sp.id                   AS service_principal_id,
        sp.owner_user_id        AS service_principal_owner_user_id,
        sp.organization_id      AS service_principal_org_id,
        sp.display_name         AS service_principal_display_name,
        sp.role_names_json      AS service_principal_role_names_json,
        sp.created_at           AS service_principal_created_at,
        sp.revoked_at           AS service_principal_revoked_at
      FROM identity.api_keys ak
      INNER JOIN identity.service_principals sp ON sp.id = ak.service_principal_id
      WHERE ak.id = ${apiKeyId}
    `;
    return rows[0] ? mapApiKeyRow(rows[0]) : null;
  }

  async findApiKeyByIdForOwner(apiKeyId: string, ownerUserId: string): Promise<ApiKeyRecord | null> {
    const rows = await this.sql<ApiKeyRow[]>`
      SELECT
        ak.id                   AS api_key_id,
        ak.owner_user_id        AS api_key_owner_user_id,
        ak.label                AS api_key_label,
        ak.visible_prefix       AS api_key_prefix,
        ak.secret_hash          AS api_key_secret_hash,
        ak.created_at           AS api_key_created_at,
        ak.expires_at           AS api_key_expires_at,
        ak.revoked_at           AS api_key_revoked_at,
        ak.last_used_at         AS api_key_last_used_at,
        sp.id                   AS service_principal_id,
        sp.owner_user_id        AS service_principal_owner_user_id,
        sp.organization_id      AS service_principal_org_id,
        sp.display_name         AS service_principal_display_name,
        sp.role_names_json      AS service_principal_role_names_json,
        sp.created_at           AS service_principal_created_at,
        sp.revoked_at           AS service_principal_revoked_at
      FROM identity.api_keys ak
      INNER JOIN identity.service_principals sp ON sp.id = ak.service_principal_id
      WHERE ak.id = ${apiKeyId} AND ak.owner_user_id = ${ownerUserId}
    `;
    return rows[0] ? mapApiKeyRow(rows[0]) : null;
  }

  async findLoginChallengeById(challengeId: string): Promise<LoginChallengeRecord | null> {
    const rows = await this.sql<LoginChallengeRow[]>`
      SELECT
        id, email, normalized_email, code_hash, created_at,
        expires_at, consumed_at, attempt_count, max_attempts,
        requested_ip, last_attempt_at, delivery_mode
      FROM identity.login_challenges
      WHERE id = ${challengeId}
    `;
    const row = rows[0];
    if (!row) return null;

    return {
      attemptCount: row.attempt_count,
      codeHash: row.code_hash,
      consumedAt: row.consumed_at,
      createdAt: row.created_at,
      deliveryMode: row.delivery_mode,
      email: row.email,
      expiresAt: row.expires_at,
      id: row.id,
      lastAttemptAt: row.last_attempt_at,
      maxAttempts: row.max_attempts,
      normalizedEmail: row.normalized_email,
      requestedIp: row.requested_ip
    };
  }

  async findSessionById(sessionId: string): Promise<SessionRecord | null> {
    const rows = await this.sql<SessionRow[]>`
      SELECT
        s.id,
        s.organization_id,
        s.secret_hash,
        s.token_prefix,
        s.created_at,
        s.expires_at,
        s.revoked_at,
        s.revoked_reason,
        s.last_used_at,
        s.user_agent,
        s.ip_address,
        u.id           AS user_id,
        u.primary_email    AS user_primary_email,
        u.normalized_email AS user_normalized_email,
        u.created_at   AS user_created_at,
        u.updated_at   AS user_updated_at
      FROM identity.sessions s
      INNER JOIN identity.users u ON u.id = s.user_id
      WHERE s.id = ${sessionId}
    `;
    const row = rows[0];
    if (!row) return null;

    return {
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      id: row.id,
      ipAddress: row.ip_address,
      lastUsedAt: row.last_used_at,
      organizationId: row.organization_id,
      revokedAt: row.revoked_at,
      revokedReason: row.revoked_reason,
      secretHash: row.secret_hash,
      tokenPrefix: row.token_prefix,
      user: {
        createdAt: row.user_created_at,
        id: row.user_id,
        normalizedEmail: row.user_normalized_email,
        primaryEmail: row.user_primary_email,
        updatedAt: row.user_updated_at
      },
      userAgent: row.user_agent
    };
  }

  async findUserById(userId: string): Promise<UserRecord | null> {
    const rows = await this.sql<UserRow[]>`
      SELECT id, primary_email, normalized_email, created_at, updated_at
      FROM identity.users
      WHERE id = ${userId}
    `;
    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async incrementLoginChallengeAttempt(challengeId: string, attemptedAt: string): Promise<void> {
    await this.sql`
      UPDATE identity.login_challenges
      SET attempt_count = attempt_count + 1,
          last_attempt_at = ${attemptedAt}
      WHERE id = ${challengeId}
    `;
  }

  async listApiKeysForUser(ownerUserId: string): Promise<ApiKeyRecord[]> {
    const rows = await this.sql<ApiKeyRow[]>`
      SELECT
        ak.id                   AS api_key_id,
        ak.owner_user_id        AS api_key_owner_user_id,
        ak.label                AS api_key_label,
        ak.visible_prefix       AS api_key_prefix,
        ak.secret_hash          AS api_key_secret_hash,
        ak.created_at           AS api_key_created_at,
        ak.expires_at           AS api_key_expires_at,
        ak.revoked_at           AS api_key_revoked_at,
        ak.last_used_at         AS api_key_last_used_at,
        sp.id                   AS service_principal_id,
        sp.owner_user_id        AS service_principal_owner_user_id,
        sp.organization_id      AS service_principal_org_id,
        sp.display_name         AS service_principal_display_name,
        sp.role_names_json      AS service_principal_role_names_json,
        sp.created_at           AS service_principal_created_at,
        sp.revoked_at           AS service_principal_revoked_at
      FROM identity.api_keys ak
      INNER JOIN identity.service_principals sp ON sp.id = ak.service_principal_id
      WHERE ak.owner_user_id = ${ownerUserId}
      ORDER BY ak.created_at DESC
    `;
    return rows.map(mapApiKeyRow);
  }

  async revokeApiKeyAndServicePrincipal(apiKeyId: string, revokedAt: string): Promise<boolean> {
    // Atomically revoke both the api key and its service principal.
    let changed = false;

    await this.sql.begin(async (tx) => {
      const apiKeyRows = await tx<{ service_principal_id: string }[]>`
        SELECT service_principal_id FROM identity.api_keys WHERE id = ${apiKeyId}
      `;
      const apiKeyRow = apiKeyRows[0];
      if (!apiKeyRow) return;

      const akResult = await tx`
        UPDATE identity.api_keys
        SET revoked_at = COALESCE(revoked_at, ${revokedAt})
        WHERE id = ${apiKeyId}
      `;

      await tx`
        UPDATE identity.service_principals
        SET revoked_at = COALESCE(revoked_at, ${revokedAt})
        WHERE id = ${apiKeyRow.service_principal_id}
      `;

      changed = akResult.count > 0;
    });

    return changed;
  }

  async revokeSession(sessionId: string, revokedAt: string, revokedReason: string): Promise<boolean> {
    const result = await this.sql`
      UPDATE identity.sessions
      SET revoked_at = COALESCE(revoked_at, ${revokedAt}),
          revoked_reason = COALESCE(revoked_reason, ${revokedReason})
      WHERE id = ${sessionId}
    `;
    return result.count > 0;
  }

  async touchApiKey(apiKeyId: string, lastUsedAt: string): Promise<void> {
    await this.sql`
      UPDATE identity.api_keys
      SET last_used_at = ${lastUsedAt}
      WHERE id = ${apiKeyId}
    `;
  }

  async touchSession(sessionId: string, lastUsedAt: string): Promise<void> {
    await this.sql`
      UPDATE identity.sessions
      SET last_used_at = ${lastUsedAt}
      WHERE id = ${sessionId}
    `;
  }

  /**
   * End the underlying Postgres connection pool.
   * Call this at the end of a Worker request (via waitUntil) to avoid
   * keeping connections open past their useful lifetime.
   */
  async end(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function mapUserRow(row: UserRow): UserRecord {
  return {
    createdAt: row.created_at,
    id: row.id,
    normalizedEmail: row.normalized_email,
    primaryEmail: row.primary_email,
    updatedAt: row.updated_at
  };
}

function mapApiKeyRow(row: ApiKeyRow): ApiKeyRecord {
  return {
    createdAt: row.api_key_created_at,
    expiresAt: row.api_key_expires_at,
    id: row.api_key_id,
    label: row.api_key_label,
    lastUsedAt: row.api_key_last_used_at,
    ownerUserId: row.api_key_owner_user_id,
    prefix: row.api_key_prefix,
    revokedAt: row.api_key_revoked_at,
    secretHash: row.api_key_secret_hash,
    servicePrincipal: mapServicePrincipalFromApiKeyRow(row)
  };
}

function mapServicePrincipalFromApiKeyRow(row: ApiKeyRow): ServicePrincipalRecord {
  return {
    createdAt: row.service_principal_created_at,
    displayName: row.service_principal_display_name,
    id: row.service_principal_id,
    organizationId: row.service_principal_org_id,
    ownerUserId: row.service_principal_owner_user_id,
    revokedAt: row.service_principal_revoked_at,
    roleNames: parseRoleNames(row.service_principal_role_names_json)
  };
}

function parseRoleNames(serialized: string): RoleName[] {
  const parsed: unknown = JSON.parse(serialized);
  return roleNameSchema.array().parse(parsed);
}
