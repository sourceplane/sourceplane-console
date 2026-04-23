import type { SourceplaneResourceContract } from "../resources/index.js";

export const validResourceFixture: SourceplaneResourceContract = {
  apiVersion: "sourceplane.io/v1alpha1",
  kind: "Resource",
  metadata: {
    id: "res_123",
    resourceType: "database.instance",
    orgId: "org_123",
    projectId: "prj_123",
    environmentId: "env_prod",
    name: "main-db",
    labels: {
      tier: "core"
    },
    annotations: {},
    componentRef: {
      name: "cloudflare-d1",
      version: "1.0.0"
    },
    generation: 2,
    createdAt: "2026-04-22T12:00:00Z",
    updatedAt: "2026-04-22T12:05:00Z",
    deletedAt: null
  },
  spec: {
    size: "starter",
    regionHint: "auto"
  },
  status: {
    phase: "ready",
    observedGeneration: 2,
    conditions: [
      {
        type: "Ready",
        status: "true",
        reason: "Provisioned",
        message: "D1 database bound successfully.",
        updatedAt: "2026-04-22T12:05:00Z"
      }
    ],
    outputs: {
      bindingName: "MAIN_DB"
    },
    lastDeploymentId: "dep_123",
    failure: null
  },
  relationships: []
};

export const invalidResourceFixture = {
  apiVersion: "sourceplane.io/v1alpha1",
  kind: "Resource",
  metadata: {
    id: "res_123",
    resourceType: "database.instance",
    orgId: "org_123",
    projectId: "prj_123",
    environmentId: "env_prod",
    name: "main-db",
    generation: 2,
    createdAt: "2026-04-22T12:00:00Z",
    updatedAt: "2026-04-22T12:05:00Z"
  },
  spec: {
    size: "starter"
  },
  status: {
    phase: "queued",
    observedGeneration: 2,
    conditions: []
  }
};