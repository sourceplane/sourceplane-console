import type { EnvironmentLifecycleState, SourceplaneEventEnvelope } from "@sourceplane/contracts";

export interface ProjectRecord {
  archivedAt: string | null;
  createdAt: string;
  id: string;
  name: string;
  organizationId: string;
  slug: string;
  updatedAt: string;
}

export interface EnvironmentRecord {
  archivedAt: string | null;
  createdAt: string;
  id: string;
  lifecycleState: EnvironmentLifecycleState;
  name: string;
  organizationId: string;
  projectId: string;
  slug: string;
  updatedAt: string;
}

export interface CreateProjectWithEnvironmentsInput {
  environments: readonly EnvironmentRecord[];
  events: readonly SourceplaneEventEnvelope[];
  project: ProjectRecord;
}

export interface UpdateProjectInput {
  event: SourceplaneEventEnvelope;
  name: string;
  organizationId: string;
  projectId: string;
  slug: string;
  updatedAt: string;
}

export interface ArchiveProjectInput {
  archivedAt: string;
  environmentArchivedAt: string;
  events: readonly SourceplaneEventEnvelope[];
  organizationId: string;
  projectId: string;
}

export interface CreateEnvironmentInput {
  environment: EnvironmentRecord;
  event: SourceplaneEventEnvelope;
}

export interface UpdateEnvironmentInput {
  environmentId: string;
  event: SourceplaneEventEnvelope;
  name: string;
  organizationId: string;
  projectId: string;
  slug: string;
  updatedAt: string;
}

export interface ArchiveEnvironmentInput {
  archivedAt: string;
  environmentId: string;
  event: SourceplaneEventEnvelope;
  organizationId: string;
}

export interface ProjectsRepository {
  archiveEnvironment(input: ArchiveEnvironmentInput): Promise<EnvironmentRecord | null>;
  archiveProject(input: ArchiveProjectInput): Promise<ProjectRecord | null>;
  createEnvironment(input: CreateEnvironmentInput): Promise<void>;
  createProjectWithEnvironments(input: CreateProjectWithEnvironmentsInput): Promise<void>;
  findEnvironmentById(organizationId: string, environmentId: string): Promise<EnvironmentRecord | null>;
  findEnvironmentBySlug(projectId: string, slug: string): Promise<EnvironmentRecord | null>;
  findProjectById(organizationId: string, projectId: string): Promise<ProjectRecord | null>;
  findProjectBySlug(organizationId: string, slug: string): Promise<ProjectRecord | null>;
  listEnvironmentsForProject(organizationId: string, projectId: string): Promise<EnvironmentRecord[]>;
  listProjectsForOrganization(organizationId: string): Promise<ProjectRecord[]>;
  updateEnvironment(input: UpdateEnvironmentInput): Promise<EnvironmentRecord | null>;
  updateProject(input: UpdateProjectInput): Promise<ProjectRecord | null>;
}
