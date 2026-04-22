# CI And Deploy Skeleton

The workflow files under `.github/workflows/` are the active CI and deploy skeletons.

- `ci.yml`: install, lint, typecheck, unit tests, and contract tests for pull requests and main pushes
- `deploy.yml`: targeted deploy skeleton that resolves changed deployable apps and invokes their local `deploy` scripts

The deploy workflow is intentionally conservative. It expects Wrangler credentials through repository secrets and keeps environment selection explicit.
