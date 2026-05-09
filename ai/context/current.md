# Current Context

Last refreshed: 2026-05-10 IST

## Repo State

- Repository: `sourceplane/sourceplane-console`
- Default branch: `main`
- Open PRs: none found with `gh pr list --state open`
- Most recent main CI run inspected: `25608908540`, success for `Orun Plan`; execute matrix was skipped because the changed plan was empty.
- Local worktree was clean before this orchestrator output.

## Implemented Surface

- Root `pnpm`/`turbo` workspace, shared TypeScript tooling, Cloudflare Worker and web console scaffolding are present.
- `apps/api-edge` is the public API facade with route groups, auth resolution, idempotency enforcement, CORS, policy checks, and downstream service binding clients.
- `apps/identity-worker` implements first-party login, sessions, API keys, and service principals.
- `apps/membership-worker` implements organizations, members, invitations, role assignment facts, and membership lookups for policy.
- `apps/projects-worker` implements projects and environments with the `orgId + projectId` isolation pattern.
- `apps/policy-worker` implements deterministic RBAC policy checks.
- `apps/web-console`, `packages/sdk`, and `packages/cli` have baseline client surfaces; several later product modules still show placeholder or minimal behavior.

## Spec Reality

- `specs/` is the active normative spec corpus in this checkout.
- `specs/product-overview.md`, `specs/domain-model.md`, and `specs/repo.md` now require Supabase Postgres as the primary source of truth for starter domain state, reached from Workers through Hyperdrive at repository-adapter boundaries.
- The Supabase database exists and Cloudflare Hyperdrive is configured for it as `sourceplane-db`.
- Cloudflare account ID is `f9270f828799775bebf9315248fdf717`; GitHub Actions has the Cloudflare API credential for CI/deploy workflows.
- Current identity, membership, and projects implementations still use D1 repositories and D1 migrations. Tests use a local in-memory D1 helper.

## Verified Gates

- `npm exec --yes pnpm@10.7.1 -- lint` passed.
- `npm exec --yes pnpm@10.7.1 -- typecheck` passed.
- `npm exec --yes pnpm@10.7.1 -- test` passed.
- `npm exec --yes pnpm@10.7.1 -- build` passed.
- `/Users/irinelinson/.local/bin/kiox -- orun plan --changed` passed and returned `0 components x 3 envs -> 0 jobs` on the clean tree.

## Planning Summary

The highest leverage next move is to migrate the persistence boundary toward the normative Supabase/Postgres model without breaking the working tenant-core flows. The first bounded task should establish the pattern on identity only, using the existing `sourceplane-db` Hyperdrive path and verifying any Cloudflare resource state with `wrangler`.
