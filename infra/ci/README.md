# CI And Deploy Skeleton

The workflow files under `.github/workflows/` are the active CI and deploy skeletons.

- `ci.yml`: install, lint, typecheck, unit tests, and contract tests for pull requests and main pushes
- `deploy.yml`: targeted deploy skeleton that resolves changed deployable apps, builds the selected workspace graph, and invokes the local `deploy` scripts

The deploy workflow is intentionally conservative. It expects Wrangler credentials through repository secrets and keeps environment selection explicit.

- Pushes to `main` resolve changed apps from the push diff.
- Manual `workspace=auto` runs resolve changed apps from the selected ref against the repository default branch, or against the selected commit's parent when the ref is already on the default branch.
- Workspace deploy scripts require an explicit `--env preview|production` argument so local defaults are never promoted by accident.
