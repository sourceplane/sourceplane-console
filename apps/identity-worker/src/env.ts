import type { SourceplaneWorkerEnv } from "@sourceplane/shared";

export interface IdentityWorkerEnv extends SourceplaneWorkerEnv {
  AUTH_EMAIL_API_TOKEN?: string;
  AUTH_EMAIL_API_URL?: string;
  AUTH_EMAIL_FROM?: string;
  AUTH_LOGIN_DELIVERY_MODE?: "email" | "local_debug";
  /**
   * D1 database binding. Used for local development and tests.
   * In production, IDENTITY_HYPERDRIVE takes precedence when present.
   */
  IDENTITY_DB: D1Database;
  /**
   * Cloudflare Hyperdrive binding pointing at the Supabase Postgres database
   * (`sourceplane-db`). When this binding is present the Worker uses the
   * Postgres repository adapter instead of D1.
   */
  IDENTITY_HYPERDRIVE?: Hyperdrive;
  IDENTITY_TOKEN_HASH_SECRET?: string;
}
