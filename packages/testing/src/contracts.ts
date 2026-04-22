import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import YAML from "yaml";

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

export function readYamlFile<TValue = unknown>(filePath: string): TValue {
  return YAML.parse(readFileSync(filePath, "utf8")) as TValue;
}

export function assertSchemaExample(schema: Record<string, unknown>): void {
  const example = schema.example;
  if (!example) {
    throw new Error("Schema is missing an example payload.");
  }

  const validator = new Ajv2020.default({ allErrors: true, strict: false });
  addFormats(validator);

  const validate = validator.compile(schema);
  const isValid = validate(example);

  if (!isValid) {
    throw new Error(JSON.stringify(validate.errors ?? [], null, 2));
  }
}
