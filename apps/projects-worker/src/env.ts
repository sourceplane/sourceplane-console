import type { SourceplaneWorkerEnv } from "@sourceplane/shared";

export interface ProjectsWorkerEnv extends SourceplaneWorkerEnv {
  PROJECTS_DB: D1Database;
}
