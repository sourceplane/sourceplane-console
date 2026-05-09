import type { SourceplaneComponentManifest } from "../components/index.js";

export const validComponentManifestFixture: SourceplaneComponentManifest = {
  apiVersion: "sourceplane.io/v1alpha1",
  kind: "ComponentDefinition",
  metadata: {
    name: "supabase-postgres",
    version: "1.0.0",
    displayName: "Supabase Postgres Database",
    summary:
      "Creates and manages a Supabase Postgres database resource or schema.",
    owner: "sourceplane",
    category: "data",
    tags: ["database", "supabase", "postgres"],
  },
  spec: {
    resourceType: "database.instance",
    inputs: [
      {
        name: "name",
        type: "string",
        required: true,
        description: "Human-readable database name.",
        ui: {
          control: "text",
          group: "basics",
          secret: false,
        },
      },
      {
        name: "tier",
        type: "enum",
        required: true,
        default: "starter",
        enumValues: ["starter", "growth"],
        description: "Sizing hint for plan, quota, and connection-pool checks.",
        ui: {
          control: "select",
          group: "basics",
          secret: false,
        },
      },
      {
        name: "schemaName",
        type: "string",
        required: false,
        description:
          "Optional logical schema name when this resource is provisioned inside an existing Supabase database.",
        ui: {
          control: "text",
          group: "basics",
          secret: false,
        },
      },
    ],
    outputs: [
      {
        name: "hyperdriveBindingName",
        type: "string",
        description: "Hyperdrive binding name used by dependent Workers.",
      },
    ],
    dependencies: [],
    permissions: {
      cloudflare: {
        hyperdrive: ["bind"],
      },
      supabase: {
        postgres: ["create_schema", "migrate", "rotate_credentials"],
      },
    },
    runtime: {
      mode: "workflow",
      handler: "provision-supabase-postgres",
      statusMapping: {
        success: "ready",
        pending: "provisioning",
        failed: "failed",
      },
    },
    examples: [
      {
        name: "starter-db",
        spec: {
          name: "main-db",
          tier: "starter",
          schemaName: "app_main",
        },
      },
    ],
  },
};

export const invalidComponentManifestFixture = {
  apiVersion: "sourceplane.io/v1alpha1",
  kind: "ComponentDefinition",
  metadata: {
    name: "Supabase Postgres",
    version: "1.0.0",
    displayName: "Supabase Postgres Database",
    summary: "Creates and manages a Supabase Postgres database resource.",
  },
  spec: {
    resourceType: "database.instance",
    inputs: [],
    outputs: [],
    runtime: {
      mode: "async",
      handler: "provision-supabase-postgres",
    },
  },
};
