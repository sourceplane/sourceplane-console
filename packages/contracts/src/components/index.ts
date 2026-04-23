import { z } from "zod";

import { assertWithSchema, isWithSchema } from "../internal/validation.js";

const nullableStringSchema = z.string().min(1).nullable();
const nullableStringArraySchema = z.array(z.string().min(1)).nullable();
const openObjectSchema = z.record(z.string(), z.unknown());

export const componentManifestApiVersion = "sourceplane.io/v1alpha1" as const;
export const componentDefinitionKind = "ComponentDefinition" as const;
export const componentInputTypes = ["string", "number", "boolean", "enum", "object", "array", "secret"] as const;
export const componentRuntimeModes = ["sync", "workflow"] as const;

export type ComponentInputType = (typeof componentInputTypes)[number];
export type ComponentRuntimeMode = (typeof componentRuntimeModes)[number];

export const componentInputTypeSchema = z.enum(componentInputTypes);
export const componentRuntimeModeSchema = z.enum(componentRuntimeModes);
export const componentMetadataSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9-]+$/),
    version: z.string().min(1),
    displayName: z.string().min(1),
    summary: z.string().min(1),
    owner: nullableStringSchema.optional(),
    category: nullableStringSchema.optional(),
    tags: z.array(z.string().min(1)).optional()
  })
  .strict();
export const componentInputUiSchema = z
  .object({
    control: z.string().min(1).optional(),
    group: nullableStringSchema.optional(),
    secret: z.boolean().nullable().optional()
  })
  .strict();
export const componentInputSchema = z
  .object({
    name: z.string().min(1),
    type: componentInputTypeSchema,
    required: z.boolean(),
    default: z.unknown().optional(),
    description: nullableStringSchema.optional(),
    enumValues: nullableStringArraySchema.optional(),
    ui: componentInputUiSchema.nullable().optional()
  })
  .strict();
export const componentOutputSchema = z
  .object({
    name: z.string().min(1),
    type: z.string().min(1),
    description: nullableStringSchema.optional()
  })
  .strict();
export const componentDependencySchema = z
  .object({
    resourceType: z.string().min(1),
    required: z.boolean().optional()
  })
  .strict();
export const componentPermissionsSchema = z
  .object({
    cloudflare: z
      .object({})
      .catchall(z.array(z.string().min(1)))
      .optional()
  })
  .strict();
export const componentRuntimeSchema = z
  .object({
    mode: componentRuntimeModeSchema,
    handler: z.string().min(1),
    statusMapping: z.record(z.string(), z.string().min(1)).nullable().optional()
  })
  .strict();
export const componentSpecSchema = z
  .object({
    resourceType: z.string().min(1),
    inputs: z.array(componentInputSchema),
    outputs: z.array(componentOutputSchema),
    dependencies: z.array(componentDependencySchema).optional(),
    permissions: componentPermissionsSchema.optional(),
    runtime: componentRuntimeSchema,
    examples: z.array(openObjectSchema).optional()
  })
  .strict();
export const componentManifestSchema = z
  .object({
    apiVersion: z.literal(componentManifestApiVersion),
    kind: z.literal(componentDefinitionKind),
    metadata: componentMetadataSchema,
    spec: componentSpecSchema
  })
  .strict();

export type ComponentMetadata = z.infer<typeof componentMetadataSchema>;
export type ComponentInput = z.infer<typeof componentInputSchema>;
export type ComponentOutput = z.infer<typeof componentOutputSchema>;
export type ComponentDependency = z.infer<typeof componentDependencySchema>;
export type ComponentPermissions = z.infer<typeof componentPermissionsSchema>;
export type ComponentRuntime = z.infer<typeof componentRuntimeSchema>;
export type ComponentSpec = z.infer<typeof componentSpecSchema>;
export type SourceplaneComponentManifest = z.infer<typeof componentManifestSchema>;
export type ComponentManifest = SourceplaneComponentManifest;

export function assertValidComponentManifest(value: unknown): SourceplaneComponentManifest {
  return assertWithSchema("SourceplaneComponentManifest", componentManifestSchema, value);
}

export function isComponentManifest(value: unknown): value is SourceplaneComponentManifest {
  return isWithSchema(componentManifestSchema, value);
}