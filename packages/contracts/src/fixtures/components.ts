import type { SourceplaneComponentManifest } from "../components/index.js";

export const validComponentManifestFixture: SourceplaneComponentManifest = {
  apiVersion: "sourceplane.io/v1alpha1",
  kind: "ComponentDefinition",
  metadata: {
    name: "cloudflare-d1",
    version: "1.0.0",
    displayName: "Cloudflare D1 Database",
    summary: "Creates and manages a D1 database resource.",
    owner: "sourceplane",
    category: "data",
    tags: ["database", "cloudflare"]
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
          secret: false
        }
      },
      {
        name: "size",
        type: "enum",
        required: true,
        default: "starter",
        enumValues: ["starter", "growth"],
        description: "Sizing hint for plan and quota checks.",
        ui: {
          control: "select",
          group: "basics",
          secret: false
        }
      }
    ],
    outputs: [
      {
        name: "bindingName",
        type: "string",
        description: "Worker binding name used by dependents."
      }
    ],
    dependencies: [],
    permissions: {
      cloudflare: {
        d1: ["create", "bind"]
      }
    },
    runtime: {
      mode: "workflow",
      handler: "provision-cloudflare-d1",
      statusMapping: {
        success: "ready",
        pending: "provisioning",
        failed: "failed"
      }
    },
    examples: [
      {
        name: "starter-db",
        spec: {
          name: "main-db",
          size: "starter"
        }
      }
    ]
  }
};

export const invalidComponentManifestFixture = {
  apiVersion: "sourceplane.io/v1alpha1",
  kind: "ComponentDefinition",
  metadata: {
    name: "Cloudflare D1",
    version: "1.0.0",
    displayName: "Cloudflare D1 Database",
    summary: "Creates and manages a D1 database resource."
  },
  spec: {
    resourceType: "database.instance",
    inputs: [],
    outputs: [],
    runtime: {
      mode: "async",
      handler: "provision-cloudflare-d1"
    }
  }
};