# Sourceplane SaaS

This repository now contains the Sourceplane monorepo scaffold and the original spec pack. The implementation remains spec-led: later tasks should treat the files under `specs/` as normative and add behavior without collapsing the extraction seams defined in the constitution.

## What Exists Today

- `pnpm` workspace monorepo with `turbo`
- shared TypeScript, ESLint, Prettier, testing, and Cloudflare scaffolding
- runnable `apps/api-edge` Worker scaffold
- runnable `apps/web-console` Vite + React scaffold with Wrangler deployment wrapper
- initial workspace packages for contracts, shared utilities, testing, SDK, CLI, and UI
- CI and targeted deploy workflow skeletons

## Quick Start

1. Install dependencies: `npm exec --yes pnpm@10.7.1 -- install`
2. Start the main dev surfaces: `npm exec --yes pnpm@10.7.1 -- dev`
3. Run quality gates:
	- `npm exec --yes pnpm@10.7.1 -- lint`
	- `npm exec --yes pnpm@10.7.1 -- typecheck`
	- `npm exec --yes pnpm@10.7.1 -- test`
	- `npm exec --yes pnpm@10.7.1 -- contract:test`

## Workspace Layout

- `apps/`: deployable Cloudflare apps and placeholder bounded-context folders
- `packages/`: shared contracts, SDK, CLI, UI, testing utilities, and generic helpers
- `tooling/`: reusable lint, tsconfig, and repo scripts
- `infra/`: Cloudflare environment notes and CI/deploy skeletons
- `specs/`: constitutional, repo, contract, and component specs

## Read Order

1. `specs/constitution.md`
2. `specs/repo.md`
3. `specs/contracts/*`
4. `specs/components/00-foundation-and-tooling.md`
5. `specs/components/01-edge-api.md`
6. `specs/components/12-web-console.md`
7. `specs/components/13-cli-and-sdk.md`
8. `specs/schedule.md`

## Current Assumptions

- The schema sources of truth live under `specs/contracts/`; `packages/contracts` materializes those files for workspace consumers.
- Secrets stay in Wrangler and Cloudflare Secrets Store flows. No committed `.env` files are part of this scaffold.
- Later agents should add domain behavior in the bounded-context app folders, not in `packages/shared`.

## Remaining Contract Work

Task 2 should deepen `packages/contracts` by adding richer generated validators, stronger domain contract types, and any publishing workflow required beyond the current scaffold.
