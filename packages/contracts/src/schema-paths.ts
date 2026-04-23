export const contractSchemaPaths = {
  componentManifest: "schemas/component-manifest.schema.yaml",
  eventEnvelope: "schemas/event-envelope.schema.yaml",
  resourceContract: "schemas/resource-contract.schema.yaml"
} as const;

export const contractSchemaNames = ["componentManifest", "eventEnvelope", "resourceContract"] as const;

export type ContractSchemaName = (typeof contractSchemaNames)[number];