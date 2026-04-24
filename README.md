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

## Console-Driven Walkthrough

Once the dev surfaces are running you can drive the live public API end-to-end
from the browser without any extra fixtures:

1. Open http://127.0.0.1:4173 (web console served by Vite).
2. Enter any email at `/login`. The identity worker is in local-debug mode and
   surfaces the one-time code in the response, which the console autofills.
3. Verify the code → you land on `/orgs`. Create an organization.
4. From the new org, open **Members** → invite a second email; the local-debug
   acceptance token is shown in the success card. Copy it.
5. Sign out, sign in as the invited email, paste the token into the
   `/invites/:inviteId?token=…` form (or just visit the deep link the org owner
   shares with you).
6. Switch to **Projects**, create a project — a `development` environment is
   provisioned automatically. Add a `staging` env from the project view.
7. Try the placeholder routes (Components, Resources, Config, Audit, Usage,
   Billing). They surface explicit "coming soon" cards pointing at the spec
   markdown for the future task that will fill them in.

Every request is dispatched through `@sourceplane/sdk` against `apps/api-edge`,
exercising the same code path that the CLI and downstream automation will use.

Hosted verification surfaces:

- Preview workers.dev:
  `https://sourceplane-web-console-preview.rahulvarghesepullely.workers.dev/login`
- Preview custom domains:
  `https://console.sourceplane.ai/login` and `https://www.console.sourceplane.ai/login`

Preview is also configured for debug-code login delivery, so the one-time code is
shown in the UI there as well while the external email provider is still pending.

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
