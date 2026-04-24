import type { RoleName, SourceplaneEventEnvelope } from "@sourceplane/contracts";

export interface UserRecord {
  createdAt: string;
  id: string;
  normalizedEmail: string;
  primaryEmail: string;
  updatedAt: string;
}

export interface LoginChallengeRecord {
  attemptCount: number;
  codeHash: string;
  consumedAt: string | null;
  createdAt: string;
  deliveryMode: string;
  email: string;
  expiresAt: string;
  id: string;
  lastAttemptAt: string | null;
  maxAttempts: number;
  normalizedEmail: string;
  requestedIp: string | null;
}

export interface SessionRecord {
  createdAt: string;
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  lastUsedAt: string | null;
  organizationId: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  secretHash: string;
  tokenPrefix: string;
  user: UserRecord;
  userAgent: string | null;
}

export interface ServicePrincipalRecord {
  createdAt: string;
  displayName: string;
  id: string;
  organizationId: string;
  ownerUserId: string;
  revokedAt: string | null;
  roleNames: RoleName[];
}

export interface ApiKeyRecord {
  createdAt: string;
  expiresAt: string | null;
  id: string;
  label: string;
  lastUsedAt: string | null;
  ownerUserId: string;
  prefix: string;
  revokedAt: string | null;
  secretHash: string;
  servicePrincipal: ServicePrincipalRecord;
}

export interface EnsureUserInput {
  createdAt: string;
  id: string;
  normalizedEmail: string;
  primaryEmail: string;
  updatedAt: string;
}

export interface NewLoginChallengeRecord {
  codeHash: string;
  createdAt: string;
  deliveryMode: string;
  email: string;
  expiresAt: string;
  id: string;
  maxAttempts: number;
  normalizedEmail: string;
  requestedIp: string | null;
}

export interface NewSessionRecord {
  createdAt: string;
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  organizationId: string | null;
  secretHash: string;
  tokenPrefix: string;
  userAgent: string | null;
  userId: string;
}

export interface NewServicePrincipalRecord {
  createdAt: string;
  displayName: string;
  id: string;
  organizationId: string;
  ownerUserId: string;
  roleNames: RoleName[];
}

export interface NewApiKeyRecord {
  createdAt: string;
  expiresAt: string | null;
  id: string;
  label: string;
  ownerUserId: string;
  prefix: string;
  secretHash: string;
  servicePrincipalId: string;
}

export interface IdentityRepository {
  appendEvent(event: SourceplaneEventEnvelope): Promise<void>;
  consumeLoginChallenge(challengeId: string, consumedAt: string): Promise<boolean>;
  createApiKey(record: NewApiKeyRecord): Promise<void>;
  createLoginChallenge(record: NewLoginChallengeRecord): Promise<void>;
  createServicePrincipal(record: NewServicePrincipalRecord): Promise<void>;
  createSession(record: NewSessionRecord): Promise<void>;
  ensureUser(input: EnsureUserInput): Promise<{ created: boolean; user: UserRecord }>;
  findApiKeyById(apiKeyId: string): Promise<ApiKeyRecord | null>;
  findApiKeyByIdForOwner(apiKeyId: string, ownerUserId: string): Promise<ApiKeyRecord | null>;
  findLoginChallengeById(challengeId: string): Promise<LoginChallengeRecord | null>;
  findSessionById(sessionId: string): Promise<SessionRecord | null>;
  findUserById(userId: string): Promise<UserRecord | null>;
  incrementLoginChallengeAttempt(challengeId: string, attemptedAt: string): Promise<void>;
  listApiKeysForUser(ownerUserId: string): Promise<ApiKeyRecord[]>;
  revokeApiKeyAndServicePrincipal(apiKeyId: string, revokedAt: string): Promise<boolean>;
  revokeSession(sessionId: string, revokedAt: string, revokedReason: string): Promise<boolean>;
  touchApiKey(apiKeyId: string, lastUsedAt: string): Promise<void>;
  touchSession(sessionId: string, lastUsedAt: string): Promise<void>;
}