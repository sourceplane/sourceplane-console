# policy-worker

Cloudflare Worker bounded context for authorization decisions.

Implemented against `specs/components/03-policy-authorization.md` and the shared tenancy and RBAC contracts.

Current V1 behavior:

- exposes `GET /healthz`
- exposes `GET /internal/ping`
- exposes `POST /internal/authorize`
- evaluates deterministic deny-by-default RBAC using request-supplied membership facts
- keeps role maps and optional overrides inside the policy domain with no cross-domain table reads
