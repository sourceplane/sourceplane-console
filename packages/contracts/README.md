# @sourceplane/contracts

Shared contract scaffold for Sourceplane.

What lives here now:

- shared route, role, error-code, and stage constants
- contract envelope types used by the scaffolded apps and packages
- materialized schema files copied from `specs/contracts/`
- contract tests that verify the packaged schemas still match the normative specs and validate their embedded examples

What Task 2 should add:

- richer generated validators
- more complete domain-level contract types
- any publish/version workflow beyond workspace use
