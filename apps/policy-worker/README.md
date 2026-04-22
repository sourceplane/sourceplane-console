# policy-worker

Placeholder bounded-context folder reserved for the policy and authorization Worker.

Implement against `specs/components/03-policy-authorization.md` and the shared tenancy and RBAC contracts. Keep persistence and policy evaluation local to this component.
# policy-worker

Reserved bounded-context folder for policy evaluation and authorization decisions. Keep the stable seam at the policy contract; do not couple this worker to transport-only edge logic.
