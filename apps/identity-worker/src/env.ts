import type { SourceplaneWorkerEnv } from "@sourceplane/shared";

export interface IdentityWorkerEnv extends SourceplaneWorkerEnv {
  AUTH_EMAIL_API_TOKEN?: string;
  AUTH_EMAIL_API_URL?: string;
  AUTH_EMAIL_FROM?: string;
  AUTH_LOGIN_DELIVERY_MODE?: "email" | "local_debug";
  IDENTITY_DB: D1Database;
  IDENTITY_TOKEN_HASH_SECRET?: string;
}
