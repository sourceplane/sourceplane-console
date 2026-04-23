import { z } from "zod";

import { assertWithSchema, isWithSchema } from "../internal/validation.js";

const nullableStringSchema = z.string().min(1).nullable();
const stringMapSchema = z.record(z.string(), z.string());
const openObjectSchema = z.record(z.string(), z.unknown());

export const resourceApiVersion = "sourceplane.io/v1alpha1" as const;
export const resourceKind = "Resource" as const;
export const resourcePhases = [
  "draft",
  "pending",
  "provisioning",
  "ready",
  "degraded",
  "failed",
  "deleting",
  "deleted"
] as const;
export const resourceConditionStatuses = ["true", "false", "unknown"] as const;

export type ResourcePhase = (typeof resourcePhases)[number];
export type ResourceConditionStatus = (typeof resourceConditionStatuses)[number];

export const resourcePhaseSchema = z.enum(resourcePhases);
export const resourceConditionStatusSchema = z.enum(resourceConditionStatuses);
export const resourceComponentRefSchema = z
  .object({
    name: z.string().min(1).optional(),
    version: z.string().min(1).optional()
  })
  .strict();
export const resourceMetadataSchema = z
  .object({
    id: z.string().min(1),
    resourceType: z.string().min(1),
    orgId: z.string().min(1),
    projectId: z.string().min(1),
    environmentId: z.string().min(1),
    name: z.string().min(1),
    labels: stringMapSchema.optional(),
    annotations: stringMapSchema.optional(),
    componentRef: resourceComponentRefSchema.nullable().optional(),
    generation: z.number().int().min(1),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    deletedAt: nullableStringSchema.optional()
  })
  .strict();
export const resourceConditionSchema = z
  .object({
    type: z.string().min(1),
    status: resourceConditionStatusSchema,
    reason: nullableStringSchema.optional(),
    message: nullableStringSchema.optional(),
    updatedAt: z.string().datetime({ offset: true })
  })
  .strict();
export const resourceFailureSchema = z
  .object({
    code: z.string().min(1).optional(),
    message: z.string().min(1).optional(),
    retriable: z.boolean().optional()
  })
  .strict();
export const resourceStatusSchema = z
  .object({
    phase: resourcePhaseSchema,
    observedGeneration: z.number().int().min(0),
    conditions: z.array(resourceConditionSchema),
    outputs: openObjectSchema.optional(),
    lastDeploymentId: nullableStringSchema.optional(),
    failure: resourceFailureSchema.nullable().optional()
  })
  .strict();
export const resourceRelationshipSchema = z
  .object({
    type: z.string().min(1),
    targetId: z.string().min(1),
    required: z.boolean().optional()
  })
  .strict();

export function createResourceContractSchema<
  TSpecSchema extends z.ZodTypeAny,
  TOutputsSchema extends z.ZodTypeAny = typeof openObjectSchema
>(specSchema: TSpecSchema, outputsSchema?: TOutputsSchema) {
  const resolvedOutputsSchema = (outputsSchema ?? openObjectSchema) as z.ZodTypeAny;

  return z
    .object({
      apiVersion: z.literal(resourceApiVersion),
      kind: z.literal(resourceKind),
      metadata: resourceMetadataSchema,
      spec: specSchema,
      status: resourceStatusSchema
        .extend({
          outputs: resolvedOutputsSchema.optional()
        })
        .strict(),
      relationships: z.array(resourceRelationshipSchema).optional()
    })
    .strict();
}

export const resourceContractSchema = createResourceContractSchema(openObjectSchema);

export type ResourceMetadata = z.infer<typeof resourceMetadataSchema>;
export type ResourceCondition = z.infer<typeof resourceConditionSchema>;
export type ResourceFailure = z.infer<typeof resourceFailureSchema>;
export type ResourceStatus = z.infer<typeof resourceStatusSchema>;
export type ResourceRelationship = z.infer<typeof resourceRelationshipSchema>;
export type SourceplaneResource = z.infer<typeof resourceContractSchema>;
export type SourceplaneResourceContract = SourceplaneResource;

export function assertValidResourceContract(value: unknown): SourceplaneResourceContract {
  return assertWithSchema("SourceplaneResource", resourceContractSchema, value);
}

export function isResourceContract(value: unknown): value is SourceplaneResourceContract {
  return isWithSchema(resourceContractSchema, value);
}