import type {
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  IdentityResolveResult,
  IdentityUserLookupResponse,
  IdentityUser,
  ListApiKeysResponse,
  LoginCompleteResponse,
  LoginStartResponse,
  LogoutResponse,
  ResolveSessionResponse,
  RevokeApiKeyResponse,
  RbacActor
} from "@sourceplane/contracts";
import { SourceplaneHttpError } from "@sourceplane/shared";

import { IdentityCrypto } from "./crypto.js";
import { createIdentityEvent } from "./events.js";
import type { LoginCodeDelivery } from "./email-delivery.js";
import type { ApiKeyRecord, IdentityRepository, SessionRecord, UserRecord } from "./repository.js";

const loginChallengeLifetimeMinutes = 10;
const sessionLifetimeDays = 30;
const maxLoginAttempts = 5;

export interface IdentityService {
  completeLogin(input: CompleteLoginInput): Promise<LoginCompleteResponse>;
  createApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResponse>;
  listApiKeys(input: ListApiKeysInput): Promise<ListApiKeysResponse>;
  logout(input: LogoutInput): Promise<LogoutResponse>;
  resolveAuthToken(token: string): Promise<IdentityResolveResult>;
  resolveUser(userId: string): Promise<IdentityUserLookupResponse>;
  resolveSession(token: string | null): Promise<ResolveSessionResponse>;
  revokeApiKey(input: RevokeApiKeyInput): Promise<RevokeApiKeyResponse>;
  startLogin(input: StartLoginInput): Promise<LoginStartResponse>;
}

export interface RequestMetadata {
  ipAddress: string | null;
  requestId: string;
  userAgent: string | null;
}

export interface StartLoginInput extends RequestMetadata {
  email: string;
}

export interface CompleteLoginInput extends RequestMetadata {
  challengeId: string;
  code: string;
}

export interface ListApiKeysInput extends RequestMetadata {
  actor: RbacActor & { type: "user" };
}

export interface CreateApiKeyInput extends ListApiKeysInput {
  expiresAt: string | null;
  label: string;
  organizationId: string;
  roleNames: CreateApiKeyRequest["roleNames"];
  sessionId: string;
}

export interface RevokeApiKeyInput extends ListApiKeysInput {
  apiKeyId: string;
  sessionId: string;
}

export interface LogoutInput extends RequestMetadata {
  actor: RbacActor & { type: "user" };
  sessionId: string;
}

export interface IdentityServiceDependencies {
  delivery: LoginCodeDelivery;
  now?: () => Date;
  repository: IdentityRepository;
  serviceName: string;
  tokenHashSecret: string;
}

interface CredentialResolution {
  actor: RbacActor;
  kind: "api_key" | "session";
  organizationId: string | null;
  session: SessionRecord | null;
}

export function createIdentityService(dependencies: IdentityServiceDependencies): IdentityService {
  const identityCrypto = new IdentityCrypto(dependencies.tokenHashSecret);
  const now = dependencies.now ?? (() => new Date());

  return {
    async completeLogin(input: CompleteLoginInput): Promise<LoginCompleteResponse> {
      const requestTimestamp = now().toISOString();
      const challenge = await dependencies.repository.findLoginChallengeById(input.challengeId);

      if (!challenge || !isActiveLoginChallenge(challenge, requestTimestamp)) {
        throw invalidLoginError();
      }

      const isValidCode = await identityCrypto.matchesLoginCode(input.code.trim(), challenge.codeHash);
      if (!isValidCode) {
        await dependencies.repository.incrementLoginChallengeAttempt(challenge.id, requestTimestamp);
        throw invalidLoginError();
      }

      const consumed = await dependencies.repository.consumeLoginChallenge(challenge.id, requestTimestamp);
      if (!consumed) {
        throw invalidLoginError();
      }

      const userId = createId("usr");
      const userResult = await dependencies.repository.ensureUser({
        createdAt: requestTimestamp,
        id: userId,
        normalizedEmail: challenge.normalizedEmail,
        primaryEmail: challenge.email,
        updatedAt: requestTimestamp
      });

      const sessionId = createId("ses");
      const sessionExpiry = addDays(now(), sessionLifetimeDays).toISOString();
      const issuedSession = await identityCrypto.issueSessionToken(sessionId);

      await dependencies.repository.createSession({
        createdAt: requestTimestamp,
        expiresAt: sessionExpiry,
        id: sessionId,
        ipAddress: input.ipAddress,
        organizationId: null,
        secretHash: issuedSession.secretHash,
        tokenPrefix: issuedSession.tokenPrefix,
        userAgent: input.userAgent,
        userId: userResult.user.id
      });

      const actor: RbacActor = {
        id: userResult.user.id,
        type: "user"
      };

      if (userResult.created) {
        await dependencies.repository.appendEvent(
          createIdentityEvent({
            actor,
            ipAddress: input.ipAddress,
            occurredAt: requestTimestamp,
            organizationId: null,
            payload: {
              primaryEmail: userResult.user.primaryEmail,
              userId: userResult.user.id
            },
            requestId: input.requestId,
            sessionId: null,
            source: dependencies.serviceName,
            subject: {
              id: userResult.user.id,
              kind: "user",
              name: userResult.user.primaryEmail
            },
            type: "user.created"
          })
        );
      }

      await dependencies.repository.appendEvent(
        createIdentityEvent({
          actor,
          ipAddress: input.ipAddress,
          occurredAt: requestTimestamp,
          organizationId: null,
          payload: {
            expiresAt: sessionExpiry,
            sessionId,
            userId: userResult.user.id
          },
          requestId: input.requestId,
          sessionId,
          source: dependencies.serviceName,
          subject: {
            id: sessionId,
            kind: "session"
          },
          type: "session.created"
        })
      );

      return {
        session: {
          actor: {
            id: userResult.user.id,
            type: "user"
          },
          expiresAt: sessionExpiry,
          id: sessionId,
          organizationId: null,
          token: issuedSession.token,
          tokenType: "bearer"
        },
        user: mapUser(userResult.user)
      };
    },

    async createApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResponse> {
      const requestTimestamp = now().toISOString();

      if (input.expiresAt && hasExpired(input.expiresAt, requestTimestamp)) {
        throw new SourceplaneHttpError(400, "bad_request", "API keys cannot be created with an expiry in the past.", {
          field: "expiresAt"
        });
      }

      const servicePrincipalId = createId("spn");
      const apiKeyId = createId("key");
      const issuedApiKey = await identityCrypto.issueApiKeyToken(apiKeyId);

      await dependencies.repository.createServicePrincipal({
        createdAt: requestTimestamp,
        displayName: input.label,
        id: servicePrincipalId,
        organizationId: input.organizationId,
        ownerUserId: input.actor.id,
        roleNames: input.roleNames
      });

      await dependencies.repository.createApiKey({
        createdAt: requestTimestamp,
        expiresAt: input.expiresAt,
        id: apiKeyId,
        label: input.label,
        ownerUserId: input.actor.id,
        prefix: issuedApiKey.tokenPrefix,
        secretHash: issuedApiKey.secretHash,
        servicePrincipalId
      });

      await dependencies.repository.appendEvent(
        createIdentityEvent({
          actor: input.actor,
          ipAddress: input.ipAddress,
          occurredAt: requestTimestamp,
          organizationId: input.organizationId,
          payload: {
            apiKeyId,
            organizationId: input.organizationId,
            roleNames: input.roleNames,
            servicePrincipalId
          },
          requestId: input.requestId,
          sessionId: input.sessionId,
          source: dependencies.serviceName,
          subject: {
            id: apiKeyId,
            kind: "api_key",
            name: input.label
          },
          type: "identity.api_key.created"
        })
      );

      return {
        apiKey: {
          createdAt: requestTimestamp,
          expiresAt: input.expiresAt,
          id: apiKeyId,
          label: input.label,
          lastUsedAt: null,
          prefix: issuedApiKey.tokenPrefix,
          revokedAt: null,
          servicePrincipal: {
            id: servicePrincipalId,
            organizationId: input.organizationId,
            roleNames: input.roleNames
          }
        },
        token: issuedApiKey.token
      };
    },

    async listApiKeys(input: ListApiKeysInput): Promise<ListApiKeysResponse> {
      const apiKeys = await dependencies.repository.listApiKeysForUser(input.actor.id);

      return {
        apiKeys: apiKeys.map(mapApiKey)
      };
    },

    async logout(input: LogoutInput): Promise<LogoutResponse> {
      const requestTimestamp = now().toISOString();
      const changed = await dependencies.repository.revokeSession(input.sessionId, requestTimestamp, "logout");

      if (changed) {
        await dependencies.repository.appendEvent(
          createIdentityEvent({
            actor: input.actor,
            ipAddress: input.ipAddress,
            occurredAt: requestTimestamp,
            organizationId: null,
            payload: {
              reason: "logout",
              sessionId: input.sessionId
            },
            requestId: input.requestId,
            sessionId: input.sessionId,
            source: dependencies.serviceName,
            subject: {
              id: input.sessionId,
              kind: "session"
            },
            type: "session.revoked"
          })
        );
      }

      return {
        revoked: true,
        sessionId: input.sessionId
      };
    },

    async resolveAuthToken(token: string): Promise<IdentityResolveResult> {
      const resolution = await resolveCredential(token);

      if (!resolution) {
        return {
          actor: null,
          organizationId: null,
          sessionId: null
        };
      }

      return {
        actor: resolution.actor,
        organizationId: resolution.organizationId,
        sessionId: resolution.session?.id ?? null
      };
    },

    async resolveUser(userId: string): Promise<IdentityUserLookupResponse> {
      const user = await dependencies.repository.findUserById(userId);

      return {
        user: user ? mapUser(user) : null
      };
    },

    async resolveSession(token: string | null): Promise<ResolveSessionResponse> {
      if (!token) {
        return unauthenticatedSessionResponse();
      }

      const resolution = await resolveCredential(token);
      if (!resolution || resolution.kind !== "session" || resolution.actor.type !== "user" || !resolution.session) {
        return unauthenticatedSessionResponse();
      }

      return {
        authenticated: true,
        session: {
          actor: {
            id: resolution.actor.id,
            type: "user"
          },
          expiresAt: resolution.session.expiresAt,
          id: resolution.session.id,
          organizationId: resolution.organizationId
        },
        user: mapUser(resolution.session.user)
      };
    },

    async revokeApiKey(input: RevokeApiKeyInput): Promise<RevokeApiKeyResponse> {
      const existingApiKey = await dependencies.repository.findApiKeyByIdForOwner(input.apiKeyId, input.actor.id);

      if (!existingApiKey) {
        throw new SourceplaneHttpError(404, "not_found", "API key not found.", {
          apiKeyId: input.apiKeyId
        });
      }

      const requestTimestamp = now().toISOString();
      const changed = await dependencies.repository.revokeApiKeyAndServicePrincipal(input.apiKeyId, requestTimestamp);

      if (changed) {
        await dependencies.repository.appendEvent(
          createIdentityEvent({
            actor: input.actor,
            ipAddress: input.ipAddress,
            occurredAt: requestTimestamp,
            organizationId: existingApiKey.servicePrincipal.organizationId,
            payload: {
              apiKeyId: existingApiKey.id,
              servicePrincipalId: existingApiKey.servicePrincipal.id
            },
            requestId: input.requestId,
            sessionId: input.sessionId,
            source: dependencies.serviceName,
            subject: {
              id: existingApiKey.id,
              kind: "api_key",
              name: existingApiKey.label
            },
            type: "identity.api_key.revoked"
          })
        );
      }

      return {
        apiKeyId: existingApiKey.id,
        revoked: true
      };
    },

    async startLogin(input: StartLoginInput): Promise<LoginStartResponse> {
      const requestTimestamp = now().toISOString();
      const normalizedEmail = normalizeEmail(input.email);
      const challengeId = createId("chl");
      const codeResult = await identityCrypto.issueLoginCode();
      const expiresAt = addMinutes(now(), loginChallengeLifetimeMinutes).toISOString();

      await dependencies.repository.createLoginChallenge({
        codeHash: codeResult.codeHash,
        createdAt: requestTimestamp,
        deliveryMode: "email_code",
        email: input.email,
        expiresAt,
        id: challengeId,
        maxAttempts: maxLoginAttempts,
        normalizedEmail,
        requestedIp: input.ipAddress
      });

      const delivery = await dependencies.delivery.send({
        challengeId,
        code: codeResult.code,
        email: input.email,
        expiresAt
      });

      return {
        challengeId,
        delivery,
        expiresAt
      };
    }
  };

  async function resolveCredential(token: string): Promise<CredentialResolution | null> {
    const parsedToken = identityCrypto.parseCredentialToken(token);
    if (!parsedToken) {
      return null;
    }

    const requestTimestamp = now().toISOString();

    if (parsedToken.kind === "session") {
      const session = await dependencies.repository.findSessionById(parsedToken.recordId);
      if (!session || !isUsableSession(session, requestTimestamp)) {
        return null;
      }

      const secretMatches = await identityCrypto.matchesSessionSecret(parsedToken.secret, session.secretHash);
      if (!secretMatches) {
        return null;
      }

      await dependencies.repository.touchSession(session.id, requestTimestamp);

      return {
        actor: {
          id: session.user.id,
          type: "user"
        },
        kind: "session",
        organizationId: session.organizationId,
        session
      };
    }

    const apiKey = await dependencies.repository.findApiKeyById(parsedToken.recordId);
    if (!apiKey || !isUsableApiKey(apiKey, requestTimestamp)) {
      return null;
    }

    const secretMatches = await identityCrypto.matchesApiKeySecret(parsedToken.secret, apiKey.secretHash);
    if (!secretMatches) {
      return null;
    }

    await dependencies.repository.touchApiKey(apiKey.id, requestTimestamp);

    return {
      actor: {
        id: apiKey.servicePrincipal.id,
        type: "service_principal"
      },
      kind: "api_key",
      organizationId: apiKey.servicePrincipal.organizationId,
      session: null
    };
  }
}

function addDays(baseDate: Date, days: number): Date {
  return new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMinutes(baseDate: Date, minutes: number): Date {
  return new Date(baseDate.getTime() + minutes * 60 * 1000);
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function hasExpired(timestamp: string, referenceTimestamp: string): boolean {
  return Date.parse(timestamp) <= Date.parse(referenceTimestamp);
}

function invalidLoginError(): SourceplaneHttpError {
  return new SourceplaneHttpError(401, "unauthenticated", "The login code is invalid or expired.");
}

function isActiveLoginChallenge(
  challenge: { attemptCount: number; consumedAt: string | null; expiresAt: string; maxAttempts: number },
  referenceTimestamp: string
): boolean {
  return !challenge.consumedAt && challenge.attemptCount < challenge.maxAttempts && !hasExpired(challenge.expiresAt, referenceTimestamp);
}

function isUsableApiKey(apiKey: ApiKeyRecord, referenceTimestamp: string): boolean {
  if (apiKey.revokedAt || apiKey.servicePrincipal.revokedAt) {
    return false;
  }

  if (apiKey.expiresAt && hasExpired(apiKey.expiresAt, referenceTimestamp)) {
    return false;
  }

  return true;
}

function isUsableSession(session: SessionRecord, referenceTimestamp: string): boolean {
  return !session.revokedAt && !hasExpired(session.expiresAt, referenceTimestamp);
}

function mapApiKey(apiKey: ApiKeyRecord): CreateApiKeyResponse["apiKey"] {
  return {
    createdAt: apiKey.createdAt,
    expiresAt: apiKey.expiresAt,
    id: apiKey.id,
    label: apiKey.label,
    lastUsedAt: apiKey.lastUsedAt,
    prefix: apiKey.prefix,
    revokedAt: apiKey.revokedAt,
    servicePrincipal: {
      id: apiKey.servicePrincipal.id,
      organizationId: apiKey.servicePrincipal.organizationId,
      roleNames: apiKey.servicePrincipal.roleNames
    }
  };
}

function mapUser(user: UserRecord): IdentityUser {
  return {
    createdAt: user.createdAt,
    id: user.id,
    primaryEmail: user.primaryEmail
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function unauthenticatedSessionResponse(): ResolveSessionResponse {
  return {
    authenticated: false,
    session: null,
    user: null
  };
}