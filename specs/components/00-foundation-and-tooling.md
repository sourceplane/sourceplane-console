# Foundation And Tooling

Status: Ready for implementation

Primary monorepo targets:

- repo root
- `tooling/*`
- `infra/*`
- initial scaffolds under `apps/*` and `packages/*`

Primary dependencies:

- `specs/constitution.md`
- `specs/repo.md`

## Intent

Bootstrap a production-grade Cloudflare monorepo that all later bounded contexts can safely build on without reworking the workspace layout.

## Scope

- `pnpm` workspace setup
- task runner setup
- TypeScript base config
- linting, formatting, testing, and typechecking setup
- Worker and Pages app scaffolds
- shared environment typing
- local development scripts
- CI pipeline skeleton
- deployment pipeline skeleton
- contract-test harness wired to `packages/contracts`

## Out Of Scope

- domain business logic
- product UI implementation
- payment-provider integration

## Hard Contracts To Honor

- The repo shape in `specs/repo.md`
- The constitutional rule that bounded contexts must remain extractable

## Required Capabilities

### Workspace

- Root scripts for `dev`, `build`, `test`, `lint`, `typecheck`, and `deploy`.
- Per-app scripts for local Cloudflare development and deployment.
- Shared tsconfig and eslint configs that can be extended, not copied.

### Testing

- Unit test harness for packages and Workers.
- Contract tests that load schemas from `packages/contracts`.
- A minimal integration-test pattern for Worker-to-Worker service bindings.

### Environment Management

- Typed env bindings for Workers.
- Clear separation between local, preview, and production configuration.
- Secrets must be referenced through Wrangler and Secrets Store conventions, not `.env` files committed to git.

### CI

- Run lint, typecheck, unit tests, and contract tests on every PR.
- Support targeted deploys by changed app/package when possible.

## Agent Freedom

- The agent may choose `turbo`, `nx`, or a simpler task graph if it still supports selective execution well.
- The agent may choose `vitest` or another TypeScript-friendly test runner if Worker support is solid.
- The agent may choose exact folder helpers and codegen scripts as long as the repo shape remains compatible with `specs/repo.md`.

## Acceptance Criteria

- A fresh clone can install, typecheck, lint, and run tests.
- At least one Worker and one Pages app scaffold run locally.
- `packages/contracts` can publish shared validators/types to other packages.
- New bounded contexts can be added without editing unrelated app internals.

## Extraction Seam

This component must avoid hidden global assumptions. Later extractions should be able to move an app plus a small set of packages without rebuilding the entire workspace model.
