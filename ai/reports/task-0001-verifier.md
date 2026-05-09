# task-0001-verifier

## Result: PASS

---

## Checks

### 1. PR #33 Inspection

| Item | Finding |
|---|---|
| PR title | `feat(identity): add Postgres/Hyperdrive repository adapter with D1 fallback` |
| State | Open, MERGEABLE |
| Base branch | `main` |
| Head branch | `task-0001-identity-postgres-adapter` |
| Head SHA | `586f228e62aa715414d9ee36614bfc548a9a7016` (matches orchestrator-recorded SHA) |
| Reviews / comments | None outstanding; no blocking reviews |
| PR #31 | Confirmed superseded. Different branch (`feat/task-0001-identity-postgres-adapter`), different Postgres migration path, still open. Not merged. |

### 2. PgIdentityRepository Contract Validation

All 15 `IdentityRepository` methods are implemented in `PgIdentityRepository`:
`appendEvent`, `consumeLoginChallenge`, `createApiKey`, `createLoginChallenge`,
`createServicePrincipal`, `createSession`, `ensureUser`, `findApiKeyById`,
`findApiKeyByIdForOwner`, `findLoginChallengeById`, `findSessionById`, `findUserById`,
`incrementLoginChallengeAttempt`, `listApiKeysForUser`, `revokeApiKeyAndServicePrincipal`,
`revokeSession`, `touchApiKey`, `touchSession`.

TypeScript `implements IdentityRepository` enforces this at compile time — typecheck passes.

**SQL encapsulation**: All SQL is private to `pg-identity-repository.ts`. No SQL leaks into `app.ts` or `service.ts`.

**Parameterized queries**: All queries use postgres.js tagged template literals (`this.sql\`…\``), which are inherently parameterized. No string concatenation found.

**Public API shapes**: No route handler or contract type was changed.

**Timestamp normalization**: `toIsoString()` / `toIsoStringOrNull()` normalize Postgres `Date` objects back to ISO strings, preserving the `IdentityRepository` contract across both adapters.

**Token/secret semantics**: `secretHash`, `tokenPrefix`, `codeHash`, `visible_prefix` are stored and returned unchanged. No hash-secret behavior was altered.

### 3. Migration Validation

Postgres migration `migrations/pg/0001_initial.sql` vs D1 `migrations/0001_initial.sql`:

| Entity | D1 | Postgres | Match |
|---|---|---|---|
| `users` | TEXT PK, UNIQUE normalized_email | TEXT PK, UNIQUE normalized_email, TIMESTAMPTZ dates | ✓ |
| `login_challenges` | TEXT timestamps | TIMESTAMPTZ timestamps | ✓ |
| `sessions` | FK to users | REFERENCES identity.users(id) | ✓ |
| `service_principals` | FK to users | REFERENCES identity.users(id) | ✓ |
| `api_keys` | UNIQUE service_principal_id, UNIQUE visible_prefix | UNIQUE service_principal_id, UNIQUE visible_prefix | ✓ |
| `identity_event_outbox` | TEXT occurred_at | TIMESTAMPTZ occurred_at | ✓ |
| Indexes | All covered | All equivalent indexes present | ✓ |

**Schema namespace**: All Postgres tables are in the `identity` schema. No cross-context foreign keys. `organization_id` on sessions and service_principals is stored as TEXT (no FK to a membership table).

**No cross-context FKs**: Verified. `organization_id` is a plain TEXT column in both sessions and service_principals.

### 4. Transaction Boundaries

| Mutation | Atomicity |
|---|---|
| `ensureUser` | Wrapped in `sql.begin()` transaction — INSERT + SELECT are atomic |
| `revokeApiKeyAndServicePrincipal` | Wrapped in `sql.begin()` transaction — SELECT + UPDATE api_keys + UPDATE service_principals are atomic |
| `appendEvent` (outbox write) | Single INSERT, no transaction. Event-outbox write is independent from business mutations (callers invoke `appendEvent` separately after domain operations). |

**Outbox atomicity gap**: `appendEvent` is called separately from domain mutations in the service layer, meaning an event can be lost if the service crashes between the domain write and the outbox write. This is the same pattern as the D1 adapter — the current `IdentityRepository` contract does not offer a combined "mutation + append-event" operation. Since the D1 path has the same gap and a combined atomic operation would require a redesign of the service contract, this is recorded as a known follow-up risk rather than a blocker for this PR.

### 5. Runtime Selection and Production Safety

| Scenario | Behavior |
|---|---|
| `IDENTITY_HYPERDRIVE` present | `PgIdentityRepository` constructed with Hyperdrive connection string |
| `IDENTITY_HYPERDRIVE` absent, non-production | `D1IdentityRepository` constructed with `env.IDENTITY_DB` |
| `IDENTITY_HYPERDRIVE` absent, `ENVIRONMENT=production` | `SourceplaneHttpError(500, "internal_error", …)` thrown before service is created, caught by the outer try/catch, returned as 500 |

`resolveIdentityRepository` in `app.ts:113–130` implements this correctly. The service construction (including repository resolution) happens inside the `try/catch` at `app.ts:38`, so the hard-fail 500 path is properly handled.

**No credentials committed**: Verified. No raw Supabase connection strings, passwords, or secrets in any committed file. `wrangler.jsonc` contains only the Hyperdrive ID (not a connection string). `README.md` explicitly instructs against committing raw connection strings.

### 6. Cloudflare Hyperdrive Independent Inspection

`wrangler hyperdrive list` output (verified independently):

```
id                               | name           | user     | host                                | port | scheme     | database
d9c62c4acf934dd7bb82f63ed02db564 | sourceplane-db | postgres | db.kfgwglxvxoiisoakkndm.supabase.co | 5432 | PostgreSQL | postgres
```

The ID `d9c62c4acf934dd7bb82f63ed02db564` matches the ID in `wrangler.jsonc` for both `preview` and `production` environments. The Hyperdrive name is `sourceplane-db` as expected. No secrets are exposed.

### 7. GitHub CI Inspection (run `25610205197`)

| Job | Result |
|---|---|
| Orun Plan | ✓ Pass (6s) — produced 3 jobs for sourceplane-identity-worker |
| sourceplane-identity-worker · staging · Verify deploy cloudflare worker turbo | ✓ Pass (46s) — typecheck ✓, build-worker ✓, deploy skipped (not production branch) |
| sourceplane-identity-worker · dev · Verify deploy cloudflare worker turbo | ✓ Pass (48s) |
| sourceplane-identity-worker · production · Verify deploy cloudflare worker turbo | ✓ Pass (42s) |

CI executed `orun plan` and all three per-environment `orun run` jobs. All passed. Deploy step was correctly skipped on PR (not a production branch push).

### 8. Local Gates

| Gate | Result |
|---|---|
| `npm exec --yes pnpm@10.7.1 -- lint` | ✓ Pass (12/12 tasks, fully cached) |
| `npm exec --yes pnpm@10.7.1 -- typecheck` | ✓ Pass (12/12 tasks, fully cached) |
| `npm exec --yes pnpm@10.7.1 -- test` | ✓ Pass (24/24 tasks, all tests green) |
| `npm exec --yes pnpm@10.7.1 -- build` | ✓ Pass (12/12 tasks, fully cached) |
| `wrangler deploy --dry-run` (local env) | ✓ Pass — bundle compiles, D1 binding shown |
| `/Users/irinelinson/.local/bin/kiox -- orun plan --changed` | ✓ Pass — 1 component × 3 envs → 3 jobs |
| `/Users/irinelinson/.local/bin/kiox -- orun run --changed` | ✗ 1 of 3 jobs failed (`dev/verify-deploy-cloudflare-worker-turbo`); 2 passed |

**orun run failure analysis**: The `dev` job fails at `deploy-worker` with "Build failed with 7 errors" from wrangler running inside the orun-isolated workspace under node 25.6.1 (local), while the component spec requires node 22. The same `wrangler deploy --dry-run` passes in the normal workspace under node 22. CI (which uses the correct node version) passes all jobs. This is a pre-existing local runner environment issue unrelated to this PR — confirmed by the implementer who verified the same failure on the clean baseline.

### 9. `.gitignore` Duplicate Entry

The diff shows `.orun/runs/` added twice to `.gitignore`. This is cosmetically unclean but functionally harmless; the duplicate comment and entry cause no behavioral difference. Recorded as a minor cleanup item, not a blocker.

---

## Issues

| Issue | Severity | Disposition |
|---|---|---|
| Live Postgres execution tests absent | Gap | Acceptable follow-up. No network access in CI; offline adapter coverage is the strongest available. Recorded in implementer report. |
| Postgres migration not applied to Supabase | Gap | Acceptable follow-up. The schema file is correct and ready. A separate migration-apply task is needed before production traffic. |
| `appendEvent` not atomic with domain mutations | Known risk | Same behavior as D1 adapter. Redesigning the repository contract to combine domain + outbox writes is a follow-up task, not a blocker for establishing the seam. |
| `preview` env retains D1 binding alongside Hyperdrive | Minor | Hyperdrive takes precedence; D1 binding is unused in preview. Can be cleaned up after migration is applied and verified. Implementer noted this. |
| `.gitignore` duplicate entry | Cosmetic | Harmless. Can be cleaned up in any future commit. |
| orun `dev` local runner fails | Pre-existing | Node version mismatch in local orun runner (node 25.6.1 vs required 22). Confirmed pre-existing, unrelated to this PR. CI passes. |

---

## Risk Notes

- **Migration apply prerequisite**: `migrations/pg/0001_initial.sql` must be manually applied to the Supabase database before identity-worker in preview/production can serve traffic. Until applied, any request that touches the repository will fail at the database level (table-not-found errors from Postgres). The Pg migration apply step is a hard dependency for the next task.
- **Outbox reliability**: The event outbox is not transactionally coupled to domain writes. A future task should either introduce a combined repository operation or accept eventual-delivery semantics and document that decision explicitly.
- **Node version in local orun runner**: The local orun runner uses node 25.6.1 while components require node 22. This should be fixed as a separate infrastructure task to keep local `orun run` reliable.

---

## Spec Proposals

None. The implementation is consistent with the active `specs/` corpus. No new spec proposals required.

---

## Recommended Next Move

1. **Apply Postgres migration**: Run `migrations/pg/0001_initial.sql` against the Supabase database (using Supabase dashboard credentials, not committed) before any preview or production traffic is sent to the Postgres path.
2. **Membership migration (task-0002)**: Repeat the accepted Postgres adapter pattern for `apps/membership-worker`.
3. **Projects migration (task-0003)**: Same for `apps/projects-worker`.
4. **Outbox atomicity**: Design a combined domain-write + outbox-write repository operation to close the event-loss window. Consider a spec update or proposal.
5. **Postgres live integration tests**: Wire a Docker Postgres or Supabase test database for repository-level integration tests.
6. **Fix local orun node version**: Align the local orun runner's node version with component specs to restore reliable local `orun run` results.
