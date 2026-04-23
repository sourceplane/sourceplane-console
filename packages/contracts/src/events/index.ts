import { z } from "zod";

import { assertWithSchema, isWithSchema } from "../internal/validation.js";

const nullableStringSchema = z.string().min(1).nullable();
const openObjectSchema = z.record(z.string(), z.unknown());

export const eventActorTypes = ["user", "service", "workflow", "system"] as const;

export type EventActorType = (typeof eventActorTypes)[number];

export const eventActorTypeSchema = z.enum(eventActorTypes);
export const eventActorSchema = z
  .object({
    type: eventActorTypeSchema,
    id: z.string().min(1),
    sessionId: nullableStringSchema.optional(),
    ip: nullableStringSchema.optional()
  })
  .strict();
export const eventTenantSchema = z
  .object({
    orgId: z.string().min(1),
    projectId: nullableStringSchema.optional(),
    environmentId: nullableStringSchema.optional()
  })
  .strict();
export const eventSubjectSchema = z
  .object({
    kind: z.string().min(1),
    id: z.string().min(1),
    name: nullableStringSchema.optional()
  })
  .strict();
export const eventTraceSchema = z
  .object({
    requestId: z.string().min(1),
    correlationId: nullableStringSchema.optional(),
    causationId: nullableStringSchema.optional(),
    idempotencyKey: nullableStringSchema.optional()
  })
  .strict();
export const eventAuditSchema = z
  .object({
    redact: z.array(z.string().min(1)).optional()
  })
  .strict();

export function createEventEnvelopeSchema<TPayloadSchema extends z.ZodTypeAny>(payloadSchema: TPayloadSchema) {
  return z
    .object({
      id: z.string().min(1),
      type: z.string().regex(/^[a-z0-9]+(\.[a-z0-9_]+)+$/),
      version: z.number().int().min(1),
      source: z.string().min(1),
      occurredAt: z.string().datetime({ offset: true }),
      actor: eventActorSchema,
      tenant: eventTenantSchema,
      subject: eventSubjectSchema,
      trace: eventTraceSchema,
      payload: payloadSchema,
      audit: eventAuditSchema.optional()
    })
    .strict();
}

export const eventEnvelopeSchema = createEventEnvelopeSchema(openObjectSchema);

export type EventActor = z.infer<typeof eventActorSchema>;
export type EventTenant = z.infer<typeof eventTenantSchema>;
export type EventSubject = z.infer<typeof eventSubjectSchema>;
export type EventTrace = z.infer<typeof eventTraceSchema>;
export type EventAudit = z.infer<typeof eventAuditSchema>;
export type SourceplaneEventEnvelope = z.infer<typeof eventEnvelopeSchema>;
export type EventEnvelope = SourceplaneEventEnvelope;

export function assertValidEventEnvelope(value: unknown): SourceplaneEventEnvelope {
  return assertWithSchema("SourceplaneEventEnvelope", eventEnvelopeSchema, value);
}

export function isEventEnvelope(value: unknown): value is SourceplaneEventEnvelope {
  return isWithSchema(eventEnvelopeSchema, value);
}