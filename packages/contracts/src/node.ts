import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import { contractSchemaPaths, type ContractSchemaName } from "./schema-paths.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function resolveContractSchemaPath(name: ContractSchemaName): string {
  return resolve(packageRoot, contractSchemaPaths[name]);
}

export function readPackagedContractSchemaText(name: ContractSchemaName): string {
  return readFileSync(resolveContractSchemaPath(name), "utf8");
}

export function loadPackagedContractSchema<TSchema extends Record<string, unknown> = Record<string, unknown>>(
  name: ContractSchemaName
): TSchema {
  return YAML.parse(readPackagedContractSchemaText(name)) as TSchema;
}
