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
  SessionRecord,
  UserRecord
} from "./repository.js";

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

interface UserRow {
  created_at: string;
  id: string;
  normalized_email: string;
  primary_email: string;
  updated_at: string;
}

export class D1IdentityRepository implements IdentityRepository {
  constructor(private readonly database: D1Database) {}

  async appendEvent(event: SourceplaneEventEnvelope): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO identity_event_outbox (id, event_type, envelope_json, occurred_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(event.id, event.type, JSON.stringify(event), event.occurredAt)
      .run();
  }

  async consumeLoginChallenge(challengeId: string, consumedAt: string): Promise<boolean> {
    const result = await this.database
      .prepare(
        `UPDATE login_challenges
         SET consumed_at = ?
         WHERE id = ? AND consumed_at IS NULL`
      )
      .bind(consumedAt, challengeId)
      .run();

    return getChanges(result) > 0;
  }

  async createApiKey(record: NewApiKeyRecord): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO api_keys (
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
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(
        record.id,
        record.servicePrincipalId,
        record.ownerUserId,
        record.label,
        record.prefix,
        record.secretHash,
        record.createdAt,
        record.expiresAt
      )
      .run();
  }

  async createLoginChallenge(record: NewLoginChallengeRecord): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO login_challenges (
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
         ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, NULL, ?)`
      )
      .bind(
        record.id,
        record.email,
        record.normalizedEmail,
        record.codeHash,
        record.createdAt,
        record.expiresAt,
        record.maxAttempts,
        record.requestedIp,
        record.deliveryMode
      )
      .run();
  }

  async createServicePrincipal(record: NewServicePrincipalRecord): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO service_principals (
           id,
           owner_user_id,
           organization_id,
           display_name,
           role_names_json,
           created_at,
           revoked_at
         ) VALUES (?, ?, ?, ?, ?, ?, NULL)`
      )
      .bind(
        record.id,
        record.ownerUserId,
        record.organizationId,
        record.displayName,
        JSON.stringify(record.roleNames),
        record.createdAt
      )
      .run();
  }

  async createSession(record: NewSessionRecord): Promise<void> {
    await this.database
      .prepare(
        `INSERT INTO sessions (
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
         ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`
      )
      .bind(
        record.id,
        record.userId,
        record.organizationId,
        record.secretHash,
        record.tokenPrefix,
        record.createdAt,
        record.expiresAt,
        record.userAgent,
        record.ipAddress
      )
      .run();
  }

  async ensureUser(input: EnsureUserInput): Promise<{ created: boolean; user: UserRecord }> {
    const insertResult = await this.database
      .prepare(
        `INSERT OR IGNORE INTO users (
           id,
           primary_email,
           normalized_email,
           created_at,
           updated_at
         ) VALUES (?, ?, ?, ?, ?)`
      )
      .bind(input.id, input.primaryEmail, input.normalizedEmail, input.createdAt, input.updatedAt)
      .run();

    const user = await this.findUserByNormalizedEmail(input.normalizedEmail);

    if (!user) {
      throw new Error("Failed to read the ensured user record.");
    }

    return {
      created: getChanges(insertResult) > 0,
      user
    };
  }

  async findApiKeyById(apiKeyId: string): Promise<ApiKeyRecord | null> {
    return this.readApiKey(
      `SELECT
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
       FROM api_keys ak
       INNER JOIN service_principals sp ON sp.id = ak.service_principal_id
       WHERE ak.id = ?`,
      [apiKeyId]
    );
  }

  async findApiKeyByIdForOwner(apiKeyId: string, ownerUserId: string): Promise<ApiKeyRecord | null> {
    return this.readApiKey(
      `SELECT
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
       FROM api_keys ak
       INNER JOIN service_principals sp ON sp.id = ak.service_principal_id
       WHERE ak.id = ? AND ak.owner_user_id = ?`,
      [apiKeyId, ownerUserId]
    );
  }

  async findLoginChallengeById(challengeId: string): Promise<LoginChallengeRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT
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
         FROM login_challenges
         WHERE id = ?`
      )
      .bind(challengeId)
      .first<LoginChallengeRow>();

    if (!row) {
      return null;
    }

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
    const row = await this.database
      .prepare(
        `SELECT
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
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.id = ?`
      )
      .bind(sessionId)
      .first<SessionRow>();

    if (!row) {
      return null;
    }

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

  async incrementLoginChallengeAttempt(challengeId: string, attemptedAt: string): Promise<void> {
    await this.database
      .prepare(
        `UPDATE login_challenges
         SET attempt_count = attempt_count + 1,
             last_attempt_at = ?
         WHERE id = ?`
      )
      .bind(attemptedAt, challengeId)
      .run();
  }

  async listApiKeysForUser(ownerUserId: string): Promise<ApiKeyRecord[]> {
    const result = await this.database
      .prepare(
        `SELECT
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
         FROM api_keys ak
         INNER JOIN service_principals sp ON sp.id = ak.service_principal_id
         WHERE ak.owner_user_id = ?
         ORDER BY ak.created_at DESC`
      )
      .bind(ownerUserId)
      .all<ApiKeyRow>();

    return result.results.map(mapApiKeyRow);
  }

  async revokeApiKeyAndServicePrincipal(apiKeyId: string, revokedAt: string): Promise<boolean> {
    const apiKey = await this.findApiKeyById(apiKeyId);

    if (!apiKey) {
      return false;
    }

    const result = await this.database
      .prepare(
        `UPDATE api_keys
         SET revoked_at = COALESCE(revoked_at, ?)
         WHERE id = ?`
      )
      .bind(revokedAt, apiKeyId)
      .run();

    await this.database
      .prepare(
        `UPDATE service_principals
         SET revoked_at = COALESCE(revoked_at, ?)
         WHERE id = ?`
      )
      .bind(revokedAt, apiKey.servicePrincipal.id)
      .run();

    return getChanges(result) > 0;
  }

  async revokeSession(sessionId: string, revokedAt: string, revokedReason: string): Promise<boolean> {
    const result = await this.database
      .prepare(
        `UPDATE sessions
         SET revoked_at = COALESCE(revoked_at, ?),
             revoked_reason = COALESCE(revoked_reason, ?)
         WHERE id = ?`
      )
      .bind(revokedAt, revokedReason, sessionId)
      .run();

    return getChanges(result) > 0;
  }

  async touchApiKey(apiKeyId: string, lastUsedAt: string): Promise<void> {
    await this.database
      .prepare(
        `UPDATE api_keys
         SET last_used_at = ?
         WHERE id = ?`
      )
      .bind(lastUsedAt, apiKeyId)
      .run();
  }

  async touchSession(sessionId: string, lastUsedAt: string): Promise<void> {
    await this.database
      .prepare(
        `UPDATE sessions
         SET last_used_at = ?
         WHERE id = ?`
      )
      .bind(lastUsedAt, sessionId)
      .run();
  }

  private async findUserByNormalizedEmail(normalizedEmail: string): Promise<UserRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT id, primary_email, normalized_email, created_at, updated_at
         FROM users
         WHERE normalized_email = ?`
      )
      .bind(normalizedEmail)
      .first<UserRow>();

    if (!row) {
      return null;
    }

    return {
      createdAt: row.created_at,
      id: row.id,
      normalizedEmail: row.normalized_email,
      primaryEmail: row.primary_email,
      updatedAt: row.updated_at
    };
  }

  private async readApiKey(query: string, bindings: readonly unknown[]): Promise<ApiKeyRecord | null> {
    const statement = this.database.prepare(query);
    const row = await statement.bind(...bindings).first<ApiKeyRow>();

    return row ? mapApiKeyRow(row) : null;
  }
}

function getChanges(result: unknown): number {
  if (!result || typeof result !== "object") {
    return 0;
  }

  if (
    "meta" in result &&
    result.meta &&
    typeof result.meta === "object" &&
    "changes" in result.meta &&
    typeof result.meta.changes === "number"
  ) {
    return result.meta.changes;
  }

  if ("changes" in result && typeof result.changes === "number") {
    return result.changes;
  }

  return 0;
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
    servicePrincipal: {
      createdAt: row.service_principal_created_at,
      displayName: row.service_principal_display_name,
      id: row.service_principal_id,
      organizationId: row.service_principal_org_id,
      ownerUserId: row.service_principal_owner_user_id,
      revokedAt: row.service_principal_revoked_at,
      roleNames: parseRoleNames(row.service_principal_role_names_json)
    }
  };
}

function parseRoleNames(serializedRoleNames: string): RoleName[] {
  const parsedValue: unknown = JSON.parse(serializedRoleNames);

  return roleNameSchema.array().parse(parsedValue);
}