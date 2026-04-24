import { describe, expect, it } from "vitest";

import type { AuthorizationRequest } from "@sourceplane/contracts";

import { createPolicyEngine } from "../src/domain/engine.js";

function createAuthorizationRequest(overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest {
  return {
    subject: {
      id: "usr_123",
      type: "user"
    },
    action: "resource.read",
    resource: {
      kind: "resource",
      id: "res_123",
      orgId: "org_123",
      projectId: "prj_123",
      environmentId: "env_123"
    },
    context: {
      memberships: [
        {
          kind: "role_assignment",
          role: "viewer",
          scope: {
            kind: "organization",
            orgId: "org_123"
          }
        }
      ],
      attributes: {}
    },
    ...overrides
  };
}

describe("policy engine", () => {
  it("evaluates a deterministic authorization matrix", () => {
    const engine = createPolicyEngine();
    const cases: Array<{
      expectedAllow: boolean;
      expectedReason: string;
      request: AuthorizationRequest;
    }> = [
      {
        expectedAllow: true,
        expectedReason: "allow.role.owner",
        request: createAuthorizationRequest({
          action: "resource.delete",
          context: {
            memberships: [
              {
                kind: "role_assignment",
                role: "owner",
                scope: {
                  kind: "organization",
                  orgId: "org_123"
                }
              }
            ],
            attributes: {}
          }
        })
      },
      {
        expectedAllow: true,
        expectedReason: "allow.role.admin",
        request: createAuthorizationRequest({
          action: "organization.update",
          resource: {
            kind: "organization",
            id: "org_123",
            orgId: "org_123"
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
            attributes: {}
          }
        })
      },
      {
        expectedAllow: false,
        expectedReason: "deny.action_not_permitted",
        request: createAuthorizationRequest({
          action: "billing.update",
          context: {
            memberships: [
              {
                kind: "role_assignment",
                role: "builder",
                scope: {
                  kind: "organization",
                  orgId: "org_123"
                }
              }
            ],
            attributes: {}
          }
        })
      },
      {
        expectedAllow: true,
        expectedReason: "allow.role.viewer",
        request: createAuthorizationRequest()
      },
      {
        expectedAllow: true,
        expectedReason: "allow.role.billing_admin",
        request: createAuthorizationRequest({
          action: "billing.read",
          resource: {
            kind: "organization",
            id: "org_123",
            orgId: "org_123"
          },
          context: {
            memberships: [
              {
                kind: "role_assignment",
                role: "billing_admin",
                scope: {
                  kind: "organization",
                  orgId: "org_123"
                }
              }
            ],
            attributes: {}
          }
        })
      },
      {
        expectedAllow: true,
        expectedReason: "allow.role.project_admin",
        request: createAuthorizationRequest({
          action: "environment.delete",
          resource: {
            kind: "environment",
            id: "env_123",
            orgId: "org_123",
            projectId: "prj_123",
            environmentId: "env_123"
          },
          context: {
            memberships: [
              {
                kind: "role_assignment",
                role: "project_admin",
                scope: {
                  kind: "project",
                  orgId: "org_123",
                  projectId: "prj_123"
                }
              }
            ],
            attributes: {}
          }
        })
      },
      {
        expectedAllow: false,
        expectedReason: "deny.no_matching_membership",
        request: createAuthorizationRequest({
          action: "project.create",
          resource: {
            kind: "project",
            id: "org_123",
            orgId: "org_123"
          },
          context: {
            memberships: [
              {
                kind: "role_assignment",
                role: "project_builder",
                scope: {
                  kind: "project",
                  orgId: "org_123",
                  projectId: "prj_123"
                }
              }
            ],
            attributes: {}
          }
        })
      },
      {
        expectedAllow: false,
        expectedReason: "deny.action_not_permitted",
        request: createAuthorizationRequest({
          action: "resource.update",
          context: {
            memberships: [
              {
                kind: "role_assignment",
                role: "project_viewer",
                scope: {
                  kind: "project",
                  orgId: "org_123",
                  projectId: "prj_123"
                }
              }
            ],
            attributes: {}
          }
        })
      },
      {
        expectedAllow: false,
        expectedReason: "deny.subject_type_requires_override",
        request: createAuthorizationRequest({
          subject: {
            id: "wrk_123",
            type: "workflow"
          },
          context: {
            memberships: [],
            attributes: {}
          }
        })
      }
    ];

    for (const testCase of cases) {
      expect(engine.authorize(testCase.request)).toMatchObject({
        allow: testCase.expectedAllow,
        reason: testCase.expectedReason,
        policyVersion: 1
      });
    }
  });

  it("applies explicit overrides before default subject-type denial", () => {
    const engine = createPolicyEngine({
      overrides: [
        {
          actionPatterns: ["deployment.read"],
          effect: "allow",
          reason: "allow.override.workflow_deployment_read",
          scope: {
            orgId: "org_123",
            projectId: "prj_123"
          },
          subjectTypes: ["workflow"]
        }
      ]
    });

    const decision = engine.authorize(
      createAuthorizationRequest({
        action: "deployment.read",
        subject: {
          id: "wrk_123",
          type: "workflow"
        },
        resource: {
          kind: "project",
          id: "prj_123",
          orgId: "org_123",
          projectId: "prj_123"
        },
        context: {
          memberships: [],
          attributes: {}
        }
      })
    );

    expect(decision).toEqual({
      allow: true,
      reason: "allow.override.workflow_deployment_read",
      policyVersion: 1,
      derivedScope: {
        orgId: "org_123",
        projectId: "prj_123"
      }
    });
  });
});