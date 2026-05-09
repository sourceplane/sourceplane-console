# Open Risks

## Future Tactonic Provisioning Contract Still Needs Naming

The Supabase database and `sourceplane-db` Hyperdrive path already exist, but the repo still does not define the future Tactonic component name or Terraform module contract for managing that infrastructure as code. Do not invent those names without user confirmation.

## D1 Production Drift

Identity, membership, and projects currently use D1-backed repositories and Wrangler D1 bindings. This conflicts with the current primary database direction for production source-of-truth state.

## Later Modules Still Placeholder

Config, events/audit, metering, billing, notifications, webhooks, admin/support, resources, and runtime are not yet implemented as full bounded contexts. Do not start these before the tenant-core persistence direction is stable.

## CI Plan Can Be Empty On Docs-Only Changes

The latest main CI success had an empty Orun changed-plan execute matrix. All tasks must still run local `orun plan --changed` and `orun run --changed`; component-touching implementation PRs must verify that the plan produces the expected component jobs.
