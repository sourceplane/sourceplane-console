# @sourceplane/web-console

Operator-facing web scaffold that stays on the public API contract boundary.

Current scope:

- Vite + React app shell for local development
- shared UI package consumption
- Wrangler wrapper for asset hosting and deploys

The UI remains a client of `api-edge`; it should not import internal Worker code or bypass the public API.
