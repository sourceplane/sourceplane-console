import { z } from "zod";

import { assertWithSchema, isWithSchema } from "../internal/validation.js";

export const sourceplaneStages = ["local", "preview", "production"] as const;

export type DeploymentEnvironment = (typeof sourceplaneStages)[number];

export const publicRouteGroups = [
  "/v1/auth",
  "/v1/organizations",
  "/v1/projects",
  "/v1/environments",
  "/v1/resources",
  "/v1/components",
  "/v1/config",
  "/v1/deployments",
  "/v1/audit",
  "/v1/usage",
  "/v1/billing"
] as const;

export type PublicRouteGroup = (typeof publicRouteGroups)[number];

export const sourceplaneErrorCodes = [
  "bad_request",
  "unauthenticated",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "validation_failed",
  "precondition_failed",
  "unsupported",
  "internal_error"
] as const;

export type SourceplaneErrorCode = (typeof sourceplaneErrorCodes)[number];

export const idempotencyHeaderName = "Idempotency-Key" as const;
export const requestIdHeaderName = "x-sourceplane-request-id" as const;
export const traceparentHeaderName = "traceparent" as const;
export const internalActorTypeHeaderName = "x-sourceplane-actor-type" as const;
export const internalActorIdHeaderName = "x-sourceplane-actor-id" as const;
export const internalSessionIdHeaderName = "x-sourceplane-session-id" as const;
export const internalOrgIdHeaderName = "x-sourceplane-org-id" as const;
export const internalProjectIdHeaderName = "x-sourceplane-project-id" as const;
export const internalEnvironmentIdHeaderName = "x-sourceplane-environment-id" as const;
export const internalResourceIdHeaderName = "x-sourceplane-resource-id" as const;
export const idempotencyRequiredMethods = ["POST"] as const;

export type IdempotencyRequiredMethod = (typeof idempotencyRequiredMethods)[number];

export const sourceplaneErrorCodeSchema = z.enum(sourceplaneErrorCodes);
export const publicRouteGroupSchema = z.enum(publicRouteGroups);
export const paginationMetaSchema = z
  .object({
    cursor: z.string().min(1).nullable()
  })
  .strict();
export const apiResponseMetaSchema = paginationMetaSchema
  .extend({
    requestId: z.string().min(1)
  })
  .strict();
export const apiErrorDetailsSchema = z.record(z.string(), z.unknown());
export const apiErrorBodySchema = z
  .object({
    code: sourceplaneErrorCodeSchema,
    message: z.string().min(1),
    details: apiErrorDetailsSchema,
    requestId: z.string().min(1)
  })
  .strict();
export const apiErrorEnvelopeSchema = z
  .object({
    error: apiErrorBodySchema
  })
  .strict();
export const idempotencyScopeSchema = z
  .object({
    actorId: z.string().min(1),
    route: z.string().min(1)
  })
  .strict();

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type ApiResponseMeta = z.infer<typeof apiResponseMetaSchema>;
export type ApiMeta = ApiResponseMeta;
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
export type IdempotencyScope = z.infer<typeof idempotencyScopeSchema>;

export interface ApiSuccessEnvelope<TData> {
  data: TData;
  meta: ApiResponseMeta;
}

export function createApiSuccessEnvelopeSchema<TDataSchema extends z.ZodTypeAny>(
  dataSchema: TDataSchema
): z.ZodType<ApiSuccessEnvelope<z.output<TDataSchema>>> {
  return z
    .object({
      data: dataSchema,
      meta: apiResponseMetaSchema
    })
    .strict() as z.ZodType<ApiSuccessEnvelope<z.output<TDataSchema>>>;
}

export function createSuccessResponse<TData>(
  data: TData,
  options: {
    cursor?: string | null;
    requestId: string;
  }
): ApiSuccessEnvelope<TData> {
  return {
    data,
    meta: {
      cursor: options.cursor ?? null,
      requestId: options.requestId
    }
  };
}

export function createErrorResponse(options: {
  code: SourceplaneErrorCode;
  details?: Record<string, unknown>;
  message: string;
  requestId: string;
}): ApiErrorEnvelope {
  return {
    error: {
      code: options.code,
      details: options.details ?? {},
      message: options.message,
      requestId: options.requestId
    }
  };
}

export function createIdempotencyScopeKey(scope: IdempotencyScope): string {
  return `${scope.actorId}::${scope.route}`;
}

export function assertValidApiErrorEnvelope(value: unknown): ApiErrorEnvelope {
  return assertWithSchema("ApiErrorEnvelope", apiErrorEnvelopeSchema, value);
}

export function assertValidApiSuccessEnvelope<TDataSchema extends z.ZodTypeAny>(
  value: unknown,
  dataSchema: TDataSchema
): ApiSuccessEnvelope<z.output<TDataSchema>> {
  return assertWithSchema("ApiSuccessEnvelope", createApiSuccessEnvelopeSchema(dataSchema), value);
}

export function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  return isWithSchema(apiErrorEnvelopeSchema, value);
}

export function isApiSuccessEnvelope<TDataSchema extends z.ZodTypeAny>(
  value: unknown,
  dataSchema: TDataSchema
): value is ApiSuccessEnvelope<z.output<TDataSchema>> {
  return isWithSchema(createApiSuccessEnvelopeSchema(dataSchema), value);
}