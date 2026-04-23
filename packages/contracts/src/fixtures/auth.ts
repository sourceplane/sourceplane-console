import type { AuthorizationRequest, AuthorizationResponse } from "../auth/index.js";

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
    memberships: [],
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