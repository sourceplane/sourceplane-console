import type { WorkerServiceBinding, SourceplaneWorkerEnv } from "@sourceplane/shared";

export interface MembershipWorkerEnv extends SourceplaneWorkerEnv {
  IDENTITY?: WorkerServiceBinding;
  MEMBERSHIP_DB: D1Database;
  MEMBERSHIP_TOKEN_HASH_SECRET: string;
}
