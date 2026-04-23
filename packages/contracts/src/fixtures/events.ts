import type { SourceplaneEventEnvelope } from "../events/index.js";

export const validEventEnvelopeFixture: SourceplaneEventEnvelope = {
  id: "evt_fixture_123",
  type: "project.created",
  version: 1,
  source: "projects-worker",
  occurredAt: "2026-04-22T12:00:00Z",
  actor: {
    type: "user",
    id: "usr_123",
    sessionId: "ses_123",
    ip: "203.0.113.10"
  },
  tenant: {
    orgId: "org_123",
    projectId: "prj_123",
    environmentId: null
  },
  subject: {
    kind: "project",
    id: "prj_123",
    name: "Acme API"
  },
  trace: {
    requestId: "req_123",
    correlationId: "cor_123",
    causationId: null,
    idempotencyKey: "idem_123"
  },
  payload: {
    projectId: "prj_123",
    name: "Acme API"
  }
};

export const invalidEventEnvelopeFixture = {
  id: "evt_fixture_123",
  type: "project.created",
  version: 1,
  source: "projects-worker",
  occurredAt: "2026-04-22T12:00:00Z",
  actor: {
    type: "service_principal",
    id: "svc_123"
  },
  tenant: {
    orgId: "org_123"
  },
  subject: {
    kind: "project",
    id: "prj_123"
  },
  trace: {
    requestId: "req_123"
  },
  payload: {
    projectId: "prj_123"
  }
};