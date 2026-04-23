# Identity

Status: Ready for implementation

Primary monorepo targets:

- `apps/identity-worker`
- optional domain package if the team prefers `packages/domain-identity`

Primary dependencies:

- `specs/contracts/api-guidelines.md`
- `specs/contracts/event-envelope.schema.yaml`
- `specs/contracts/tenancy-and-rbac.md`
- `specs/components/00-foundation-and-tooling.md`

Cloudflare primitives:

- Workers
- D1
- KV for derived session cache if needed
- Secrets Store for signing and encryption keys

## Intent

Own all facts about who a user is and how an actor proves identity to the platform.

## Scope

- user records
- auth identities
- sign-in and sign-out flows
- session issuance and validation
- API keys and service-principal credentials
- account bootstrap and profile basics

## Out Of Scope

- organizations and memberships
- authorization decisions
- billing customer state

## Hard Contracts To Honor

- Actor shapes from `specs/contracts/tenancy-and-rbac.md`
- Public API envelope and auth transport rules from `specs/contracts/api-guidelines.md`

## Required Capabilities

### Public/Internal Methods

- `createUser`
- `getUser`
- `startLogin`
- `completeLogin`
- `logout`
- `resolveSession`
- `listApiKeys`
- `createApiKey`
- `revokeApiKey`

### Minimum V1 Authentication Requirement

V1 must ship with at least one first-party sign-in path that is fully platform-owned on Cloudflare, such as email magic link or one-time code. Additional OAuth providers may be added through adapters, but hosted auth SaaS is not the control-plane source of truth.

### Recommended Public Route Surface

- `POST /v1/auth/login/start`
- `POST /v1/auth/login/complete`
- `GET /v1/auth/session`
- `POST /v1/auth/logout`
- `GET /v1/auth/api-keys`
- `POST /v1/auth/api-keys`
- `DELETE /v1/auth/api-keys/{apiKeyId}`

`login/start` and `login/complete` are the only auth mutations that may pass through the public edge without a pre-resolved actor. They still use the standard success and error envelopes.

Example request body for `POST /v1/auth/login/start`:

```json
{
	"email": "user@example.com"
}
```

Example success envelope for `POST /v1/auth/login/start`:

```json
{
	"data": {
		"challengeId": "chl_123",
		"delivery": {
			"mode": "local_debug",
			"emailHint": "u***@example.com",
			"code": "123456"
		},
		"expiresAt": "2026-04-23T12:05:00.000Z"
	},
	"meta": {
		"cursor": null,
		"requestId": "req_123"
	}
}
```

Example success envelope for `POST /v1/auth/login/complete`:

```json
{
	"data": {
		"session": {
			"actor": {
				"id": "usr_123",
				"type": "user"
			},
			"expiresAt": "2026-04-30T12:00:00.000Z",
			"id": "ses_123",
			"organizationId": null,
			"token": "sps_ses_123.secret",
			"tokenType": "bearer"
		},
		"user": {
			"createdAt": "2026-04-23T12:00:00.000Z",
			"id": "usr_123",
			"primaryEmail": "user@example.com"
		}
	},
	"meta": {
		"cursor": null,
		"requestId": "req_123"
	}
}
```

Example success envelope for `GET /v1/auth/api-keys`:

```json
{
	"data": {
		"apiKeys": [
			{
				"createdAt": "2026-04-23T12:00:00.000Z",
				"expiresAt": null,
				"id": "key_123",
				"label": "CI token",
				"lastUsedAt": null,
				"prefix": "spk_key_123",
				"revokedAt": null,
				"servicePrincipal": {
					"id": "spn_123",
					"organizationId": "org_123",
					"roleNames": ["builder"]
				}
			}
		]
	},
	"meta": {
		"cursor": null,
		"requestId": "req_123"
	}
}
```

### Events

This component must emit:

- `user.created`
- `session.created`
- `session.revoked`
- `api_key.created`
- `api_key.revoked`

## Data Ownership

This component owns records such as:

- users
- auth identities
- sessions
- verification tokens
- api keys
- service principals

## Agent Freedom

- The agent may choose opaque sessions, signed sessions, or a hybrid model.
- The agent may choose passwordless email, passkeys, or both for the initial first-party login method.
- The agent may use D1 directly or through a repository layer.

## Acceptance Criteria

- The edge Worker can resolve a session or API key to an acting subject.
- Sessions and keys can be revoked and stop working predictably.
- Secrets used for token signing or encryption are not stored in source control or plaintext tables.
- Identity behavior is independently testable without membership or billing logic.

## Extraction Seam

All consumers must rely on the identity contract, never on identity tables. This allows the identity system to move to a dedicated repo or external runtime later.
