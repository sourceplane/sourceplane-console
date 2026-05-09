import { roleNameSchema, type RoleName, type SourceplaneEventEnvelope } from "@sourceplane/contracts";
import postgres from "postgres";

import type {
  ApiKeyRecord,
  EnsureUserInput,
  IdentityRepository,
  LoginChallengeRecord,
  NewApiKeyRecord,
  NewLoginChallengeRecord,
  NewServicePrincipalRecord,
  NewSessionRecord,
  SessionRecord,
  UserRecord
} from "./repository.js";

/**
 * Postgres repository adapter for identity-worker.
 *
 * Implements the IdentityRepository contract using parameterized queries
 * against the `identity` schema in Supabase Postgres, reached via Cloudflare
 * Hyperdrive. All driver/SQL details are private to this module.
 */
export class PgIdentityRepository implements IdentityRepository {
  private readonly sql: postgres.Sql;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, {
      // Hyperdrive connection strings are pooled TCP connections.
      // Postgres.js must not open additional SSL on top of the Hyperdrive tunnel.
      ssl: "prefer",
      // Keep connections short-lived in Worker request-scoped usage.
      max: 1,
      idle_timeout: 0,
      connect_timeout: 10
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
        id,
        service_principal_id,
        owner_user_id,
        label,
        visible_prefix,
        secret_hash,
        created_at,
        expires_at,
        revoked_at,
        last_used_at
      ) VALUES (
        ${record.id},
        ${record.servicePrincipalId},
        ${record.ownerUserId},
        ${record.label},
        ${record.prefix},
        ${record.secretHash},
        ${record.createdAt},
        ${record.expiresAt ?? null},
        NULL,
        NULL
      )
    `;
  }

  async createLoginChallenge(record: NewLoginChallengeRecord): Promise<void> {
    await this.sql`
      INSERT INTO identity.login_challenges (
        id,
        email,
        normalized_email,
        code_hash,
        created_at,
        expires_at,
        consumed_at,
        attempt_count,
        max_attempts,
        requested_ip,
        last_attempt_at,
        delivery_mode
      ) VALUES (
        ${record.id},
        ${record.email},
        ${record.normalizedEmail},
        ${record.codeHash},
        ${record.createdAt},
        ${record.expiresAt},
        NULL,
        0,
        ${record.maxAttempts},
        ${record.requestedIp ?? null},
        NULL,
        ${record.deliveryMode}
      )
    `;
  }

  async createServicePrincipal(record: NewServicePrincipalRecord): Promise<void> {
    await this.sql`
      INSERT INTO identity.service_principals (
        id,
        owner_user_id,
        organization_id,
        display_name,
        role_names_json,
        created_at,
        revoked_at
      ) VALUES (
        ${record.id},
        ${record.ownerUserId},
        ${record.organizationId},
        ${record.displayName},
        ${JSON.stringify(record.roleNames)},
        ${record.createdAt},
        NULL
      )
    `;
  }

  async createSession(record: NewSessionRecord): Promise<void> {
    await this.sql`
      INSERT INTO identity.sessions (
        id,
        user_id,
        organization_id,
        secret_hash,
        token_prefix,
        created_at,
        expires_at,
        revoked_at,
        revoked_reason,
        last_used_at,
        user_agent,
        ip_address
      ) VALUES (
        ${record.id},
        ${record.userId},
        ${record.organizationId ?? null},
        ${record.secretHash},
        ${record.tokenPrefix},
        ${record.createdAt},
        ${record.expiresAt},
        NULL,
        NULL,
        NULL,
        ${record.userAgent ?? null},
        ${record.ipAddress ?? null}
      )
    `;
  }

  async ensureUser(input: EnsureUserInput): Promise<{ created: boolean; user: UserRecord }> {
    // Use a transaction to atomically upsert and read.
    const result = await this.sql.begin(async (tx) => {
      const insertResult = await tx`
        INSERT INTO identity.users (id, primary_email, normalized_email, created_at, updated_at)
        VALUES (${input.id}, ${input.primaryEmail}, ${input.normalizedEmail}, ${input.createdAt}, ${input.updatedAt})
        ON CONFLICT (normalized_email) DO NOTHING
      `;

      const rows = await tx`
        SELECT id, primary_email, normalized_email, created_at, updated_at
        FROM identity.users
        WHERE normalized_email = ${input.normalizedEmail}
      `;

      const row = rows[0];

      if (!row) {
        throw new Error("Failed to read the ensured user record.");
      }

      return { created: insertResult.count > 0, row };
    });

    return {
      created: result.created,
      user: mapUserRow(result.row)
    };
  }

  async findApiKeyById(apiKeyId: string): Promise<ApiKeyRecord | null> {
    const rows = await this.sql`
      SELECT
        ak.id AS api_key_id,
        ak.owner_user_id AS api_key_owner_user_id,
        ak.label AS api_key_label,
        ak.visible_prefix AS api_key_prefix,
        ak.secret_hash AS api_key_secret_hash,
        ak.created_at AS api_key_created_at,
        ak.expires_at AS api_key_expires_at,
        ak.revoked_at AS api_key_revoked_at,
        ak.last_used_at AS api_key_last_used_at,
        sp.id AS service_principal_id,
        sp.owner_user_id AS service_principal_owner_user_id,
        sp.organization_id AS service_principal_org_id,
        sp.display_name AS service_principal_display_name,
        sp.role_names_json AS service_principal_role_names_json,
        sp.created_at AS service_principal_created_at,
        sp.revoked_at AS service_principal_revoked_at
      FROM identity.api_keys ak
      INNER JOIN identity.service_principals sp ON sp.id = ak.service_principal_id
      WHERE ak.id = ${apiKeyId}
    `;

    const row = rows[0];
    return row ? mapApiKeyRow(row) : null;
  }

  async findApiKeyByIdForOwner(apiKeyId: string, ownerUserId: string): Promise<ApiKeyRecord | null> {
    const rows = await this.sql`
      SELECT
        ak.id AS api_key_id,
        ak.owner_user_id AS api_key_owner_user_id,
        ak.label AS api_key_label,
        ak.visible_prefix AS api_key_prefix,
        ak.secret_hash AS api_key_secret_hash,
        ak.created_at AS api_key_created_at,
        ak.expires_at AS api_key_expires_at,
        ak.revoked_at AS api_key_revoked_at,
        ak.last_used_at AS api_key_last_used_at,
        sp.id AS service_principal_id,
        sp.owner_user_id AS service_principal_owner_user_id,
        sp.organization_id AS service_principal_org_id,
        sp.display_name AS service_principal_display_name,
        sp.role_names_json AS service_principal_role_names_json,
        sp.created_at AS service_principal_created_at,
        sp.revoked_at AS service_principal_revoked_at
      FROM identity.api_keys ak
      INNER JOIN identity.service_principals sp ON sp.id = ak.service_principal_id
      WHERE ak.id = ${apiKeyId} AND ak.owner_user_id = ${ownerUserId}
    `;

    const row = rows[0];
    return row ? mapApiKeyRow(row) : null;
  }

  async findLoginChallengeById(challengeId: string): Promise<LoginChallengeRecord | null> {
    const rows = await this.sql`
      SELECT
        id,
        email,
        normalized_email,
        code_hash,
        created_at,
        expires_at,
        consumed_at,
        attempt_count,
        max_attempts,
        requested_ip,
        last_attempt_at,
        delivery_mode
      FROM identity.login_challenges
      WHERE id = ${challengeId}
    `;

    const row = rows[0];

    if (!row) {
      return null;
    }

    return {
      attemptCount: row.attempt_count as number,
      codeHash: row.code_hash as string,
      consumedAt: toIsoStringOrNull(row.consumed_at),
      createdAt: toIsoString(row.created_at),
      deliveryMode: row.delivery_mode as string,
      email: row.email as string,
      expiresAt: toIsoString(row.expires_at),
      id: row.id as string,
      lastAttemptAt: toIsoStringOrNull(row.last_attempt_at),
      maxAttempts: row.max_attempts as number,
      normalizedEmail: row.normalized_email as string,
      requestedIp: (row.requested_ip as string | null) ?? null
    };
  }

  async findSessionById(sessionId: string): Promise<SessionRecord | null> {
    const rows = await this.sql`
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
        u.id AS user_id,
        u.primary_email AS user_primary_email,
        u.normalized_email AS user_normalized_email,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at
      FROM identity.sessions s
      INNER JOIN identity.users u ON u.id = s.user_id
      WHERE s.id = ${sessionId}
    `;

    const row = rows[0];

    if (!row) {
      return null;
    }

    return {
      createdAt: toIsoString(row.created_at),
      expiresAt: toIsoString(row.expires_at),
      id: row.id as string,
      ipAddress: (row.ip_address as string | null) ?? null,
      lastUsedAt: toIsoStringOrNull(row.last_used_at),
      organizationId: (row.organization_id as string | null) ?? null,
      revokedAt: toIsoStringOrNull(row.revoked_at),
      revokedReason: (row.revoked_reason as string | null) ?? null,
      secretHash: row.secret_hash as string,
      tokenPrefix: row.token_prefix as string,
      user: {
        createdAt: toIsoString(row.user_created_at),
        id: row.user_id as string,
        normalizedEmail: row.user_normalized_email as string,
        primaryEmail: row.user_primary_email as string,
        updatedAt: toIsoString(row.user_updated_at)
      },
      userAgent: (row.user_agent as string | null) ?? null
    };
  }

  async findUserById(userId: string): Promise<UserRecord | null> {
    const rows = await this.sql`
      SELECT id, primary_email, normalized_email, created_at, updated_at
      FROM identity.users
      WHERE id = ${userId}
    `;

    const row = rows[0];
    return row ? mapUserRow(row) : null;
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
    const rows = await this.sql`
      SELECT
        ak.id AS api_key_id,
        ak.owner_user_id AS api_key_owner_user_id,
        ak.label AS api_key_label,
        ak.visible_prefix AS api_key_prefix,
        ak.secret_hash AS api_key_secret_hash,
        ak.created_at AS api_key_created_at,
        ak.expires_at AS api_key_expires_at,
        ak.revoked_at AS api_key_revoked_at,
        ak.last_used_at AS api_key_last_used_at,
        sp.id AS service_principal_id,
        sp.owner_user_id AS service_principal_owner_user_id,
        sp.organization_id AS service_principal_org_id,
        sp.display_name AS service_principal_display_name,
        sp.role_names_json AS service_principal_role_names_json,
        sp.created_at AS service_principal_created_at,
        sp.revoked_at AS service_principal_revoked_at
      FROM identity.api_keys ak
      INNER JOIN identity.service_principals sp ON sp.id = ak.service_principal_id
      WHERE ak.owner_user_id = ${ownerUserId}
      ORDER BY ak.created_at DESC
    `;

    return rows.map(mapApiKeyRow);
  }

  async revokeApiKeyAndServicePrincipal(apiKeyId: string, revokedAt: string): Promise<boolean> {
    return this.sql.begin(async (tx) => {
      const apiKeyRows = await tx`
        SELECT service_principal_id
        FROM identity.api_keys
        WHERE id = ${apiKeyId}
      `;

      const apiKeyRow = apiKeyRows[0];

      if (!apiKeyRow) {
        return false;
      }

      const servicePrincipalId = apiKeyRow.service_principal_id as string;

      const result = await tx`
        UPDATE identity.api_keys
        SET revoked_at = COALESCE(revoked_at, ${revokedAt})
        WHERE id = ${apiKeyId}
      `;

      await tx`
        UPDATE identity.service_principals
        SET revoked_at = COALESCE(revoked_at, ${revokedAt})
        WHERE id = ${servicePrincipalId}
      `;

      return result.count > 0;
    });
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
   * End the connection pool. Call this when the Worker's request is complete
   * if you need to free resources (normally Hyperdrive manages the pool).
   */
  async end(): Promise<void> {
    await this.sql.end();
  }
}

interface PgRow {
  [column: string]: unknown;
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function toIsoStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return toIsoString(value);
}

function mapApiKeyRow(row: PgRow): ApiKeyRecord {
  return {
    createdAt: toIsoString(row.api_key_created_at),
    expiresAt: toIsoStringOrNull(row.api_key_expires_at),
    id: row.api_key_id as string,
    label: row.api_key_label as string,
    lastUsedAt: toIsoStringOrNull(row.api_key_last_used_at),
    ownerUserId: row.api_key_owner_user_id as string,
    prefix: row.api_key_prefix as string,
    revokedAt: toIsoStringOrNull(row.api_key_revoked_at),
    secretHash: row.api_key_secret_hash as string,
    servicePrincipal: {
      createdAt: toIsoString(row.service_principal_created_at),
      displayName: row.service_principal_display_name as string,
      id: row.service_principal_id as string,
      organizationId: row.service_principal_org_id as string,
      ownerUserId: row.service_principal_owner_user_id as string,
      revokedAt: toIsoStringOrNull(row.service_principal_revoked_at),
      roleNames: parseRoleNames(row.service_principal_role_names_json as string)
    }
  };
}

function mapUserRow(row: PgRow): UserRecord {
  return {
    createdAt: toIsoString(row.created_at),
    id: row.id as string,
    normalizedEmail: row.normalized_email as string,
    primaryEmail: row.primary_email as string,
    updatedAt: toIsoString(row.updated_at)
  };
}

function parseRoleNames(serializedRoleNames: string): RoleName[] {
  const parsedValue: unknown = JSON.parse(serializedRoleNames);

  return roleNameSchema.array().parse(parsedValue);
}
