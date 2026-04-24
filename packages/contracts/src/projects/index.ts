import { z } from "zod";

import { assertWithSchema, isWithSchema } from "../internal/validation.js";

const identifierSchema = z.string().min(1);
const isoDatetimeSchema = z.string().datetime({ offset: true });
const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const displayNameSchema = z.string().trim().min(1).max(120);

export const environmentLifecycleStates = ["active", "archived"] as const;

export type EnvironmentLifecycleState = (typeof environmentLifecycleStates)[number];

export const environmentLifecycleStateSchema = z.enum(environmentLifecycleStates);

export const projectSchema = z
  .object({
    archivedAt: isoDatetimeSchema.nullable(),
    createdAt: isoDatetimeSchema,
    id: identifierSchema,
    name: displayNameSchema,
    organizationId: identifierSchema,
    slug: slugSchema,
    updatedAt: isoDatetimeSchema
  })
  .strict();

export const environmentSchema = z
  .object({
    archivedAt: isoDatetimeSchema.nullable(),
    createdAt: isoDatetimeSchema,
    id: identifierSchema,
    lifecycleState: environmentLifecycleStateSchema,
    name: displayNameSchema,
    organizationId: identifierSchema,
    projectId: identifierSchema,
    slug: slugSchema,
    updatedAt: isoDatetimeSchema
  })
  .strict();

export const createProjectRequestSchema = z
  .object({
    name: displayNameSchema,
    slug: slugSchema.optional()
  })
  .strict();

export const createProjectResponseSchema = z
  .object({
    environments: z.array(environmentSchema),
    project: projectSchema
  })
  .strict();

export const listProjectsResponseSchema = z
  .object({
    projects: z.array(projectSchema)
  })
  .strict();

export const getProjectResponseSchema = z
  .object({
    project: projectSchema
  })
  .strict();

export const updateProjectRequestSchema = z
  .object({
    name: displayNameSchema.optional(),
    slug: slugSchema.optional()
  })
  .strict()
  .refine((value) => value.name !== undefined || value.slug !== undefined, {
    message: "At least one updatable field must be provided.",
    path: ["name"]
  });

export const updateProjectResponseSchema = getProjectResponseSchema;

export const archiveProjectResponseSchema = z
  .object({
    project: projectSchema
  })
  .strict();

export const createEnvironmentRequestSchema = z
  .object({
    name: displayNameSchema,
    slug: slugSchema.optional()
  })
  .strict();

export const createEnvironmentResponseSchema = z
  .object({
    environment: environmentSchema
  })
  .strict();

export const listEnvironmentsResponseSchema = z
  .object({
    environments: z.array(environmentSchema)
  })
  .strict();

export const getEnvironmentResponseSchema = z
  .object({
    environment: environmentSchema
  })
  .strict();

export const updateEnvironmentRequestSchema = z
  .object({
    name: displayNameSchema.optional(),
    slug: slugSchema.optional()
  })
  .strict()
  .refine((value) => value.name !== undefined || value.slug !== undefined, {
    message: "At least one updatable field must be provided.",
    path: ["name"]
  });

export const updateEnvironmentResponseSchema = getEnvironmentResponseSchema;

export const archiveEnvironmentResponseSchema = z
  .object({
    environment: environmentSchema
  })
  .strict();

export const projectLookupRequestSchema = z
  .object({
    organizationId: identifierSchema,
    projectId: identifierSchema
  })
  .strict();

export const projectLookupResponseSchema = z
  .object({
    project: projectSchema.nullable()
  })
  .strict();

export const environmentLookupRequestSchema = z
  .object({
    environmentId: identifierSchema,
    organizationId: identifierSchema,
    projectId: identifierSchema.optional()
  })
  .strict();

export const environmentLookupResponseSchema = z
  .object({
    environment: environmentSchema.nullable()
  })
  .strict();

export const defaultEnvironmentBootstrap = {
  name: "Development",
  slug: "development"
} as const;

export type Project = z.infer<typeof projectSchema>;
export type Environment = z.infer<typeof environmentSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type CreateProjectResponse = z.infer<typeof createProjectResponseSchema>;
export type ListProjectsResponse = z.infer<typeof listProjectsResponseSchema>;
export type GetProjectResponse = z.infer<typeof getProjectResponseSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
export type UpdateProjectResponse = z.infer<typeof updateProjectResponseSchema>;
export type ArchiveProjectResponse = z.infer<typeof archiveProjectResponseSchema>;
export type CreateEnvironmentRequest = z.infer<typeof createEnvironmentRequestSchema>;
export type CreateEnvironmentResponse = z.infer<typeof createEnvironmentResponseSchema>;
export type ListEnvironmentsResponse = z.infer<typeof listEnvironmentsResponseSchema>;
export type GetEnvironmentResponse = z.infer<typeof getEnvironmentResponseSchema>;
export type UpdateEnvironmentRequest = z.infer<typeof updateEnvironmentRequestSchema>;
export type UpdateEnvironmentResponse = z.infer<typeof updateEnvironmentResponseSchema>;
export type ArchiveEnvironmentResponse = z.infer<typeof archiveEnvironmentResponseSchema>;
export type ProjectLookupRequest = z.infer<typeof projectLookupRequestSchema>;
export type ProjectLookupResponse = z.infer<typeof projectLookupResponseSchema>;
export type EnvironmentLookupRequest = z.infer<typeof environmentLookupRequestSchema>;
export type EnvironmentLookupResponse = z.infer<typeof environmentLookupResponseSchema>;

export function assertValidProject(value: unknown): Project {
  return assertWithSchema("Project", projectSchema, value);
}

export function assertValidEnvironment(value: unknown): Environment {
  return assertWithSchema("Environment", environmentSchema, value);
}

export function isProject(value: unknown): value is Project {
  return isWithSchema(projectSchema, value);
}

export function isEnvironment(value: unknown): value is Environment {
  return isWithSchema(environmentSchema, value);
}
