# @sourceplane/contracts

Shared Sourceplane contracts for API envelopes, tenancy and RBAC, events, resources, and component manifests.

This package is the contract-first source of truth that downstream Workers, the CLI, the SDK, and UI packages should import instead of re-declaring shared shapes.

## Stable Surface

These exports are intended for downstream use and should change additively whenever possible:

- Root entrypoint `@sourceplane/contracts` for the common contract surface.
- Subpath entrypoints:
	- `@sourceplane/contracts/api`
	- `@sourceplane/contracts/auth`
	- `@sourceplane/contracts/events`
	- `@sourceplane/contracts/resources`
	- `@sourceplane/contracts/components`
	- `@sourceplane/contracts/fixtures`
	- `@sourceplane/contracts/node`
- Shared semantic constants such as error codes, actor types, role names, resource phases, route groups, and environment names.
- Zod validators and TypeScript types for:
	- API success and error envelopes
	- pagination and idempotency conventions
	- tenancy scopes and authorization request and response payloads
	- event envelopes
	- resource contracts
	- component manifests
- Raw schema files under `schemas/`, plus Node-only helpers for loading the packaged YAML schemas.

## Internal Surface

The following are internal implementation details and should not be imported by downstream code:

- files under `src/internal/`
- test helpers under `test/`
- any file path that is not exported from `package.json`

Fixtures are exported for tests, smoke checks, and examples, but they are illustrative data rather than production defaults.

## Usage

Use the root or subpath entrypoints depending on how narrow you want the import surface to be.

```ts
import { createSuccessResponse, sourceplaneErrorCodes } from "@sourceplane/contracts";
import { authorizationRequestSchema } from "@sourceplane/contracts/auth";
import { eventEnvelopeSchema } from "@sourceplane/contracts/events";
```

Use the Node-only entrypoint when you need direct access to the packaged YAML schemas for codegen, documentation tooling, or schema-level validation:

```ts
import { loadPackagedContractSchema, resolveContractSchemaPath } from "@sourceplane/contracts/node";

const schema = loadPackagedContractSchema("eventEnvelope");
const schemaPath = resolveContractSchemaPath("eventEnvelope");
```

## Stability And Versioning

- The contract package follows the repository constitution: shared contracts must not drift silently from the normative docs under `specs/`.
- Changes should be additive unless the spec pack explicitly documents a breaking change.
- Contract tests verify both the embedded schema examples and the fenced examples in the Markdown specs.

## Known Spec Ambiguity

The tenancy spec uses `service_principal` as a canonical actor type, while the event envelope schema currently uses `service`. This package preserves both spellings as separate contract concepts instead of collapsing them.

## Adding New Contracts Safely

1. Update the relevant spec under `specs/` first.
2. Materialize the shared type and validator in this package.
3. Add valid and invalid fixtures.
4. Extend the contract tests to cover the new shape and any examples.
5. Keep new exports additive where possible so downstream packages can adopt them incrementally.
