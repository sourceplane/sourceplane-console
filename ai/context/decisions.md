# Decisions

## 2026-05-10 - Use `specs/` As Active Spec Corpus

This checkout has no `spec/v2/` or `spec/` tree. The normative product and architecture docs live under `specs/`, so orchestrator task prompts will reference `specs/` until the repo layout changes.

## 2026-05-10 - First Migration Step Is Identity Persistence

Identity is the best first bounded persistence migration target because it owns login, sessions, API keys, service principals, and token hashing. A production Postgres adapter pattern here can be reused by membership and projects without disturbing the full tenant flow in one PR.

## 2026-05-10 - Use Existing Supabase/Hyperdrive Path

The Supabase database already exists and Cloudflare Hyperdrive is already configured for it as `sourceplane-db`. Task 0001 should use that binding/resource for the identity Postgres path and must not invent a second primary database binding.

## 2026-05-10 - Verify Cloudflare Resource Creation Directly

Agents have authenticated `wrangler` and `gh` access. Whenever a task creates or updates Cloudflare resources, the implementer must verify the resource exists with `wrangler` or the Cloudflare API and the verifier must independently inspect the resulting resource state.

## 2026-05-10 - Always Run Local Orun Plan And Run

Every implementation and verification task must run `/Users/irinelinson/.local/bin/kiox -- orun plan --changed` and `/Users/irinelinson/.local/bin/kiox -- orun run --changed` locally. If no jobs are planned, record the no-op result instead of skipping the run silently.

## 2026-05-10 - Keep D1 As Local/Test Compatibility For Now

D1 is no longer the production source-of-truth target for starter domain state, but the current tests and local flows are green. Task 0001 should keep the D1 repository path usable for tests and local development while adding the production Postgres/Hyperdrive path.
