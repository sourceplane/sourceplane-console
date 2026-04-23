import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  apiErrorEnvelopeSchema,
  authorizationRequestSchema,
  authorizationResponseSchema,
  componentManifestSchema,
  contractSchemaNames,
  contractSchemaPaths,
  createApiSuccessEnvelopeSchema,
  identityResolveResultSchema,
  invalidIdentityResolveResultFixture,
  invalidListApiKeysResponseFixture,
  invalidLoginCompleteResponseFixture,
  invalidLoginStartRequestFixture,
  eventEnvelopeSchema,
  invalidApiErrorFixture,
  invalidApiSuccessFixture,
  invalidAuthorizationRequestFixture,
  invalidAuthorizationResponseFixture,
  invalidComponentManifestFixture,
  invalidEventEnvelopeFixture,
  invalidResourceFixture,
  listApiKeysResponseSchema,
  loginCompleteResponseSchema,
  loginStartRequestSchema,
  loginStartResponseSchema,
  resourceContractSchema,
  validApiErrorFixture,
  validApiSuccessFixture,
  validAuthorizationRequestFixture,
  validAuthorizationResponseFixture,
  validComponentManifestFixture,
  validEventEnvelopeFixture,
  validIdentityResolveResultFixture,
  validListApiKeysResponseFixture,
  validLoginCompleteResponseFixture,
  validLoginStartRequestFixture,
  validResourceFixture
} from "../src/index.js";
import { loadPackagedContractSchema, readPackagedContractSchemaText } from "../src/node.js";
import type { ContractSchemaName } from "../src/schema-paths.js";

const workspaceRoot = resolve(import.meta.dirname, "..", "..", "..");
const require = createRequire(import.meta.url);

type ValidatorLike = {
  compile(schema: Record<string, unknown>): {
    (value: unknown): boolean;
    errors?: unknown[];
  };
};

type AjvConstructor = new (options?: Record<string, unknown>) => ValidatorLike;

const Ajv2020 = require("ajv/dist/2020") as { default: AjvConstructor };
const addFormats = require("ajv-formats") as (validator: ValidatorLike) => void;

const anyObjectSchema = z.record(z.string(), z.unknown());
const apiSuccessEnvelopeSchema = createApiSuccessEnvelopeSchema(anyObjectSchema);
const schemaValidators: Record<ContractSchemaName, z.ZodTypeAny> = {
  componentManifest: componentManifestSchema,
  eventEnvelope: eventEnvelopeSchema,
  resourceContract: resourceContractSchema
};

function assertSchemaExample(schema: Record<string, unknown>): void {
  const validator = new Ajv2020.default({ allErrors: true, strict: false });
  addFormats(validator);

  const validate = validator.compile(schema);
  const isValid = validate(schema.example);

  if (!isValid) {
    throw new Error(JSON.stringify(validate.errors ?? [], null, 2));
  }
}

function extractJsonCodeBlocks(filePath: string): unknown[] {
  const fileContents = readFileSync(filePath, "utf8");
  const matches = fileContents.matchAll(/```json\s*([\s\S]*?)```/g);

  return Array.from(matches, (match) => {
    const parsedValue: unknown = JSON.parse(match[1]?.trim() ?? "null");

    return parsedValue;
  });
}

function extractIssuePaths(error: z.ZodError): string[] {
  return error.issues.map((issue) => formatIssuePath(issue.path));
}

function formatIssuePath(path: (number | string)[]): string {
  if (path.length === 0) {
    return "$";
  }

  return path.reduce<string>((formattedPath, segment) => {
    if (typeof segment === "number") {
      return `${formattedPath}[${segment}]`;
    }

    return `${formattedPath}.${segment}`;
  }, "$");
}

describe("packaged contract schemas", () => {
  for (const schemaName of contractSchemaNames) {
    it(`keeps ${schemaName} aligned with specs/contracts`, () => {
      const specFileName = contractSchemaPaths[schemaName].split("/").at(-1);
      const specSchemaPath = resolve(workspaceRoot, "specs", "contracts", specFileName ?? "");
      const packagedSchema = loadPackagedContractSchema<{ example?: unknown }>(schemaName);

      expect(readPackagedContractSchemaText(schemaName)).toBe(readFileSync(specSchemaPath, "utf8"));
      expect(packagedSchema.example).toBeDefined();
      expect(() => assertSchemaExample(packagedSchema)).not.toThrow();
      expect(schemaValidators[schemaName].safeParse(packagedSchema.example).success).toBe(true);
    });
  }
});

describe("exported fixtures", () => {
  it("accepts valid fixtures", () => {
    expect(apiSuccessEnvelopeSchema.parse(validApiSuccessFixture)).toEqual(validApiSuccessFixture);
    expect(apiErrorEnvelopeSchema.parse(validApiErrorFixture)).toEqual(validApiErrorFixture);
    expect(authorizationRequestSchema.parse(validAuthorizationRequestFixture)).toEqual(validAuthorizationRequestFixture);
    expect(authorizationResponseSchema.parse(validAuthorizationResponseFixture)).toEqual(validAuthorizationResponseFixture);
    expect(identityResolveResultSchema.parse(validIdentityResolveResultFixture)).toEqual(validIdentityResolveResultFixture);
    expect(loginStartRequestSchema.parse(validLoginStartRequestFixture)).toEqual(validLoginStartRequestFixture);
    expect(loginCompleteResponseSchema.parse(validLoginCompleteResponseFixture)).toEqual(validLoginCompleteResponseFixture);
    expect(listApiKeysResponseSchema.parse(validListApiKeysResponseFixture)).toEqual(validListApiKeysResponseFixture);
    expect(eventEnvelopeSchema.parse(validEventEnvelopeFixture)).toEqual(validEventEnvelopeFixture);
    expect(resourceContractSchema.parse(validResourceFixture)).toEqual(validResourceFixture);
    expect(componentManifestSchema.parse(validComponentManifestFixture)).toEqual(validComponentManifestFixture);
  });

  it("rejects invalid fixtures at predictable paths", () => {
    const invalidCases = [
      {
        expectedPath: "$.meta.requestId",
        schema: apiSuccessEnvelopeSchema,
        value: invalidApiSuccessFixture
      },
      {
        expectedPath: "$.error.code",
        schema: apiErrorEnvelopeSchema,
        value: invalidApiErrorFixture
      },
      {
        expectedPath: "$.subject.type",
        schema: authorizationRequestSchema,
        value: invalidAuthorizationRequestFixture
      },
      {
        expectedPath: "$.policyVersion",
        schema: authorizationResponseSchema,
        value: invalidAuthorizationResponseFixture
      },
      {
        expectedPath: "$.actor.type",
        schema: identityResolveResultSchema,
        value: invalidIdentityResolveResultFixture
      },
      {
        expectedPath: "$.email",
        schema: loginStartRequestSchema,
        value: invalidLoginStartRequestFixture
      },
      {
        expectedPath: "$.session.tokenType",
        schema: loginCompleteResponseSchema,
        value: invalidLoginCompleteResponseFixture
      },
      {
        expectedPath: "$.apiKeys[0].servicePrincipal.roleNames",
        schema: listApiKeysResponseSchema,
        value: invalidListApiKeysResponseFixture
      },
      {
        expectedPath: "$.actor.type",
        schema: eventEnvelopeSchema,
        value: invalidEventEnvelopeFixture
      },
      {
        expectedPath: "$.status.phase",
        schema: resourceContractSchema,
        value: invalidResourceFixture
      },
      {
        expectedPath: "$.metadata.name",
        schema: componentManifestSchema,
        value: invalidComponentManifestFixture
      }
    ] as const;

    for (const invalidCase of invalidCases) {
      const result = invalidCase.schema.safeParse(invalidCase.value);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(extractIssuePaths(result.error)).toContain(invalidCase.expectedPath);
      }
    }
  });
});

describe("normative spec examples", () => {
  it("keeps the API guideline examples valid", () => {
    const [successExample, errorExample] = extractJsonCodeBlocks(
      resolve(workspaceRoot, "specs", "contracts", "api-guidelines.md")
    );

    expect(apiSuccessEnvelopeSchema.safeParse(successExample).success).toBe(true);
    expect(apiErrorEnvelopeSchema.safeParse(errorExample).success).toBe(true);
  });

  it("keeps the tenancy and RBAC examples valid", () => {
    const [requestExample, responseExample] = extractJsonCodeBlocks(
      resolve(workspaceRoot, "specs", "contracts", "tenancy-and-rbac.md")
    );

    expect(authorizationRequestSchema.safeParse(requestExample).success).toBe(true);
    expect(authorizationResponseSchema.safeParse(responseExample).success).toBe(true);
  });

  it("keeps the identity public route examples valid", () => {
    const identityExamples = extractJsonCodeBlocks(resolve(workspaceRoot, "specs", "components", "02-identity.md"));
    const [loginStartRequestExample, loginStartResponseExample, loginCompleteResponseExample, listApiKeysResponseExample] =
      identityExamples;

    expect(loginStartRequestSchema.safeParse(loginStartRequestExample).success).toBe(true);
    expect(createApiSuccessEnvelopeSchema(loginStartResponseSchema).safeParse(loginStartResponseExample).success).toBe(true);
    expect(createApiSuccessEnvelopeSchema(loginCompleteResponseSchema).safeParse(loginCompleteResponseExample).success).toBe(true);
    expect(createApiSuccessEnvelopeSchema(listApiKeysResponseSchema).safeParse(listApiKeysResponseExample).success).toBe(true);
  });
});
