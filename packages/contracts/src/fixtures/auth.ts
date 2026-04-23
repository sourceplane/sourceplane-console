import type {
  AuthorizationRequest,
  AuthorizationResponse,
  IdentityResolveResult,
  ListApiKeysResponse,
  LoginCompleteResponse,
  LoginStartRequest
} from "../auth/index.js";

export const validAuthorizationRequestFixture: AuthorizationRequest = {
  subject: {
    type: "user",
    id: "usr_123"
  },
  action: "resource.create",
  resource: {
    kind: "project",
    id: "prj_123",
    orgId: "org_123",
    environmentId: null
  },
  context: {
    memberships: [
      {
        kind: "role_assignment",
        role: "admin",
        scope: {
          kind: "organization",
          orgId: "org_123"
        }
      }
    ],
    attributes: {
      source: "fixture"
    }
  }
};

export const validAuthorizationResponseFixture: AuthorizationResponse = {
  allow: true,
  reason: "org_admin",
  policyVersion: 1,
  derivedScope: {
    orgId: "org_123",
    projectId: "prj_123"
  }
};

export const invalidAuthorizationRequestFixture = {
  subject: {
    type: "service",
    id: "svc_123"
  },
  action: "resource.create",
  resource: {
    kind: "project",
    id: "prj_123",
    orgId: "org_123"
  },
  context: {
    memberships: [],
    attributes: {}
  }
};

export const invalidAuthorizationResponseFixture = {
  allow: true,
  reason: "org_admin",
  policyVersion: 0
};

export const validIdentityResolveResultFixture: IdentityResolveResult = {
  actor: {
    id: "usr_123",
    type: "user"
  },
  organizationId: null,
  sessionId: "ses_123"
};

export const invalidIdentityResolveResultFixture = {
  actor: {
    id: "svc_123",
    type: "service"
  },
  organizationId: null,
  sessionId: "ses_123"
};

export const validLoginStartRequestFixture: LoginStartRequest = {
  email: "user@example.com"
};

export const invalidLoginStartRequestFixture = {
  email: "not-an-email-address"
};

export const validLoginCompleteResponseFixture: LoginCompleteResponse = {
  session: {
    actor: {
      id: "usr_123",
      type: "user"
    },
    expiresAt: "2026-04-23T12:05:00.000Z",
    id: "ses_123",
    organizationId: null,
    token: "sps_ses_123.secret",
    tokenType: "bearer"
  },
  user: {
    createdAt: "2026-04-23T12:00:00.000Z",
    id: "usr_123",
    primaryEmail: "user@example.com"
  }
};

export const invalidLoginCompleteResponseFixture = {
  session: {
    actor: {
      id: "usr_123",
      type: "user"
    },
    expiresAt: "2026-04-23T12:05:00.000Z",
    id: "ses_123",
    organizationId: null,
    token: "sps_ses_123.secret",
    tokenType: "cookie"
  },
  user: {
    createdAt: "2026-04-23T12:00:00.000Z",
    id: "usr_123",
    primaryEmail: "user@example.com"
  }
};

export const validListApiKeysResponseFixture: ListApiKeysResponse = {
  apiKeys: [
    {
      createdAt: "2026-04-23T12:00:00.000Z",
      expiresAt: null,
      id: "key_123",
      label: "CI token",
      lastUsedAt: null,
      prefix: "spk_key_123",
      revokedAt: null,
      servicePrincipal: {
        id: "spn_123",
        organizationId: "org_123",
        roleNames: ["builder"]
      }
    }
  ]
};

export const invalidListApiKeysResponseFixture = {
  apiKeys: [
    {
      createdAt: "2026-04-23T12:00:00.000Z",
      expiresAt: null,
      id: "key_123",
      label: "CI token",
      lastUsedAt: null,
      prefix: "spk_key_123",
      revokedAt: null,
      servicePrincipal: {
        id: "spn_123",
        organizationId: "org_123",
        roleNames: []
      }
    }
  ]
};