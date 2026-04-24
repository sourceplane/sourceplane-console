import { eventEnvelopeSchema, type RbacActor, type SourceplaneEventEnvelope } from "@sourceplane/contracts";

interface MembershipEventInput<TPayload extends Record<string, unknown>> {
  actor: RbacActor;
  idempotencyKey: string | null;
  ipAddress: string | null;
  occurredAt: string;
  organizationId: string;
  payload: TPayload;
  requestId: string;
  sessionId: string | null;
  source: string;
  subject: {
    id: string;
    kind: string;
    name?: string | null;
  };
  type: string;
}

export function createMembershipEvent<TPayload extends Record<string, unknown>>(
  input: MembershipEventInput<TPayload>
): SourceplaneEventEnvelope {
  return eventEnvelopeSchema.parse({
    actor: {
      id: input.actor.id,
      ip: input.ipAddress,
      sessionId: input.sessionId,
      type: mapEventActorType(input.actor.type)
    },
    occurredAt: input.occurredAt,
    payload: input.payload,
    source: input.source,
    subject: {
      id: input.subject.id,
      kind: input.subject.kind,
      name: input.subject.name ?? null
    },
    tenant: {
      environmentId: null,
      orgId: input.organizationId,
      projectId: null
    },
    trace: {
      causationId: null,
      correlationId: null,
      idempotencyKey: input.idempotencyKey,
      requestId: input.requestId
    },
    type: input.type,
    version: 1,
    id: createEventId()
  });
}

function createEventId(): string {
  return `evt_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function mapEventActorType(actorType: RbacActor["type"]): "service" | "system" | "user" | "workflow" {
  if (actorType === "service_principal") {
    return "service";
  }

  return actorType;
}
