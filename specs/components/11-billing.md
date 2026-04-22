# Billing

Status: Ready for implementation

Primary monorepo targets:

- `apps/billing-worker`

Primary dependencies:

- `specs/contracts/event-envelope.schema.yaml`
- `specs/components/04-organizations-membership.md`
- `specs/components/10-metering.md`
- `specs/components/03-policy-authorization.md`

Cloudflare primitives:

- Workers
- D1
- Queues
- Secrets Store for provider credentials

## Intent

Own plans, subscriptions, entitlements, invoice state, and payment-provider integration behind a platform contract.

## Scope

- plan catalog
- subscription lifecycle
- entitlement calculation
- invoice and payment state mirror
- provider webhook handling

## Out Of Scope

- raw usage aggregation
- general-purpose notification rendering
- org membership management

## Hard Contracts To Honor

- Event envelope in `specs/contracts/event-envelope.schema.yaml`
- Metering-first dependency rule in `specs/components/10-metering.md`

## Required Capabilities

### Public/Internal Methods

- `listPlans`
- `createSubscription`
- `changeSubscription`
- `cancelSubscription`
- `getBillingSummary`
- `getEntitlements`
- `handleProviderWebhook`

### Events

- `subscription.created`
- `subscription.updated`
- `subscription.canceled`
- `invoice.generated`
- `payment.failed`
- `entitlements.updated`

### Billing Rules

- Billing must consume normalized metering outputs, not raw domain events.
- Entitlements must be queryable by policy and product surfaces.
- Provider-specific fields must stay behind an adapter or mapping layer.

## Data Ownership

This component owns:

- plans
- subscriptions
- entitlements
- invoices
- payment events mirrored into platform state

## Agent Freedom

- The agent may start with manual plans plus a provider adapter seam if payment integration is staged.
- Stripe or another payment provider may be used, but the billing Worker remains the system contract.
- Billing portal redirects are acceptable if represented through the public API.

## Acceptance Criteria

- Plan state and entitlements can be queried from the public API.
- Usage-backed billing inputs come only from metering outputs.
- Changing a subscription updates entitlement checks without hardcoded UI branching.

## Extraction Seam

The billing Worker is the platform contract. The payment processor is an adapter behind it, not the source of truth for product entitlement decisions.
