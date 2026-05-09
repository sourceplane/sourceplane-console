import type { SourceplaneWorkerEnv } from "@sourceplane/shared";

export interface IdentityWorkerEnv extends SourceplaneWorkerEnv {
  AUTH_EMAIL_API_TOKEN?: string;
  AUTH_EMAIL_API_URL?: string;
  AUTH_EMAIL_FROM?: string;
  AUTH_LOGIN_DELIVERY_MODE?: "email" | "local_debug";
  /**
   * D1 database binding used for local development and the test suite.
   * Required for non-production environments when IDENTITY_HYPERDRIVE is absent.
   */
  IDENTITY_DB: D1Database;
  /**
   * Cloudflare Hyperdrive binding that provides a Postgres connectionString to
   * the Supabase production database. When present, the worker prefers the
   * Postgres repository path over D1. The binding name must be configured in
   * wrangler.jsonc for the target environment; see README.md for details.
   *
   * Expected binding name: IDENTITY_HYPERDRIVE
   */
  IDENTITY_HYPERDRIVE?: Hyperdrive;
  IDENTITY_TOKEN_HASH_SECRET?: string;
}
