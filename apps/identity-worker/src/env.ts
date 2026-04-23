import type { SourceplaneWorkerEnv } from "@sourceplane/shared";

export interface IdentityWorkerEnv extends SourceplaneWorkerEnv {
  AUTH_EMAIL_API_TOKEN?: string;
  AUTH_EMAIL_API_URL?: string;
  AUTH_EMAIL_FROM?: string;
  IDENTITY_DB: D1Database;
  IDENTITY_TOKEN_HASH_SECRET: string;
}