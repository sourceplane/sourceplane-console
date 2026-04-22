import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

import { contractSchemaPaths, type ContractSchemaName } from "@sourceplane/contracts";

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

function readYamlFile<TValue = unknown>(filePath: string): TValue {
  return YAML.parse(readFileSync(filePath, "utf8")) as TValue;
}

function assertSchemaExample(schema: Record<string, unknown>): void {
  const validator = new Ajv2020.default({ allErrors: true, strict: false });
  addFormats(validator);

  const validate = validator.compile(schema);
  const isValid = validate(schema.example);

  if (!isValid) {
    throw new Error(JSON.stringify(validate.errors ?? [], null, 2));
  }
}

describe("packaged contract schemas", () => {
  const schemaNames = Object.keys(contractSchemaPaths) as ContractSchemaName[];

  for (const schemaName of schemaNames) {
    it(`keeps ${schemaName} aligned with specs/contracts`, () => {
      const packagedSchemaPath = resolve(workspaceRoot, "packages", "contracts", contractSchemaPaths[schemaName]);
      const specSchemaPath = resolve(
        workspaceRoot,
        "specs",
        "contracts",
        contractSchemaPaths[schemaName].split("/").at(-1) ?? ""
      );

      expect(readFileSync(packagedSchemaPath, "utf8")).toBe(readFileSync(specSchemaPath, "utf8"));

      const packagedSchema = readYamlFile<Record<string, unknown>>(packagedSchemaPath);
      expect(() => assertSchemaExample(packagedSchema)).not.toThrow();
    });
  }
});
