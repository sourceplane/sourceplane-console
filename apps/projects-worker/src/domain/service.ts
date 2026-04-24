import {
  defaultEnvironmentBootstrap,
  type ArchiveEnvironmentResponse,
  type ArchiveProjectResponse,
  type CreateEnvironmentResponse,
  type CreateProjectResponse,
  type Environment,
  type EnvironmentLookupRequest,
  type EnvironmentLookupResponse,
  type GetEnvironmentResponse,
  type GetProjectResponse,
  type ListEnvironmentsResponse,
  type ListProjectsResponse,
  type Project,
  type ProjectLookupRequest,
  type ProjectLookupResponse,
  type RbacActor,
  type SourceplaneEventEnvelope,
  type UpdateEnvironmentResponse,
  type UpdateProjectResponse
} from "@sourceplane/contracts";
import { SourceplaneHttpError } from "@sourceplane/shared";

import { createProjectsEvent } from "./events.js";
import type {
  EnvironmentRecord,
  ProjectRecord,
  ProjectsRepository
} from "./repository.js";
import { isValidSlug, normalizeSlug, slugifyDisplayName } from "./slug.js";

export interface RequestMetadata {
  idempotencyKey: string | null;
  ipAddress: string | null;
  requestId: string;
  sessionId: string | null;
  traceparent: string | null;
}

type AnyActor = RbacActor;

export interface CreateProjectInput extends RequestMetadata {
  actor: AnyActor;
  name: string;
  organizationId: string;
  slug?: string;
}

export interface ListProjectsInput {
  organizationId: string;
}

export interface GetProjectInput {
  organizationId: string;
  projectId: string;
}

export interface UpdateProjectInput extends RequestMetadata {
  actor: AnyActor;
  name?: string;
  organizationId: string;
  projectId: string;
  slug?: string;
}

export interface ArchiveProjectInput extends RequestMetadata {
  actor: AnyActor;
  organizationId: string;
  projectId: string;
}

export interface ListEnvironmentsInput {
  organizationId: string;
  projectId: string;
}

export interface CreateEnvironmentInput extends RequestMetadata {
  actor: AnyActor;
  name: string;
  organizationId: string;
  projectId: string;
  slug?: string;
}

export interface GetEnvironmentInput {
  environmentId: string;
  organizationId: string;
}

export interface UpdateEnvironmentInput extends RequestMetadata {
  actor: AnyActor;
  environmentId: string;
  name?: string;
  organizationId: string;
  slug?: string;
}

export interface ArchiveEnvironmentInput extends RequestMetadata {
  actor: AnyActor;
  environmentId: string;
  organizationId: string;
}

export interface ProjectsService {
  archiveEnvironment(input: ArchiveEnvironmentInput): Promise<ArchiveEnvironmentResponse>;
  archiveProject(input: ArchiveProjectInput): Promise<ArchiveProjectResponse>;
  createEnvironment(input: CreateEnvironmentInput): Promise<CreateEnvironmentResponse>;
  createProject(input: CreateProjectInput): Promise<CreateProjectResponse>;
  getEnvironment(input: GetEnvironmentInput): Promise<GetEnvironmentResponse>;
  getProject(input: GetProjectInput): Promise<GetProjectResponse>;
  listEnvironments(input: ListEnvironmentsInput): Promise<ListEnvironmentsResponse>;
  listProjects(input: ListProjectsInput): Promise<ListProjectsResponse>;
  lookupEnvironment(input: EnvironmentLookupRequest): Promise<EnvironmentLookupResponse>;
  lookupProject(input: ProjectLookupRequest): Promise<ProjectLookupResponse>;
  updateEnvironment(input: UpdateEnvironmentInput): Promise<UpdateEnvironmentResponse>;
  updateProject(input: UpdateProjectInput): Promise<UpdateProjectResponse>;
}

export interface ProjectsServiceDependencies {
  now?: () => Date;
  repository: ProjectsRepository;
  serviceName: string;
}

export function createProjectsService(dependencies: ProjectsServiceDependencies): ProjectsService {
  const now = dependencies.now ?? (() => new Date());
  const { repository, serviceName } = dependencies;

  async function loadActiveProject(organizationId: string, projectId: string): Promise<ProjectRecord> {
    const project = await repository.findProjectById(organizationId, projectId);

    if (!project) {
      throw new SourceplaneHttpError(404, "not_found", "The requested project was not found.", {
        projectId
      });
    }

    return project;
  }

  return {
    async archiveEnvironment(input: ArchiveEnvironmentInput): Promise<ArchiveEnvironmentResponse> {
      const existing = await repository.findEnvironmentById(input.organizationId, input.environmentId);

      if (!existing) {
        throw new SourceplaneHttpError(404, "not_found", "The requested environment was not found.", {
          environmentId: input.environmentId
        });
      }

      if (existing.archivedAt) {
        return { environment: toEnvironment(existing) };
      }

      const archivedAt = now().toISOString();
      const event = createProjectsEvent({
        actor: input.actor,
        environmentId: existing.id,
        idempotencyKey: input.idempotencyKey,
        ipAddress: input.ipAddress,
        occurredAt: archivedAt,
        organizationId: input.organizationId,
        payload: {
          environmentId: existing.id,
          projectId: existing.projectId
        },
        projectId: existing.projectId,
        requestId: input.requestId,
        sessionId: input.sessionId,
        source: serviceName,
        subject: { id: existing.id, kind: "environment", name: existing.name },
        type: "environment.archived"
      });

      const archived = await repository.archiveEnvironment({
        archivedAt,
        environmentId: existing.id,
        event,
        organizationId: input.organizationId
      });

      if (!archived) {
        throw new SourceplaneHttpError(409, "conflict", "The environment could not be archived.", {
          environmentId: input.environmentId
        });
      }

      return { environment: toEnvironment(archived) };
    },

    async archiveProject(input: ArchiveProjectInput): Promise<ArchiveProjectResponse> {
      const existing = await repository.findProjectById(input.organizationId, input.projectId);

      if (!existing) {
        throw new SourceplaneHttpError(404, "not_found", "The requested project was not found.", {
          projectId: input.projectId
        });
      }

      if (existing.archivedAt) {
        return { project: toProject(existing) };
      }

      const archivedAt = now().toISOString();
      const liveEnvironments = await repository.listEnvironmentsForProject(input.organizationId, existing.id);
      const events: SourceplaneEventEnvelope[] = [];

      for (const environment of liveEnvironments) {
        if (environment.archivedAt) {
          continue;
        }

        events.push(
          createProjectsEvent({
            actor: input.actor,
            environmentId: environment.id,
            idempotencyKey: input.idempotencyKey,
            ipAddress: input.ipAddress,
            occurredAt: archivedAt,
            organizationId: input.organizationId,
            payload: {
              environmentId: environment.id,
              projectId: environment.projectId,
              reason: "project_archived"
            },
            projectId: environment.projectId,
            requestId: input.requestId,
            sessionId: input.sessionId,
            source: serviceName,
            subject: { id: environment.id, kind: "environment", name: environment.name },
            type: "environment.archived"
          })
        );
      }

      events.push(
        createProjectsEvent({
          actor: input.actor,
          idempotencyKey: input.idempotencyKey,
          ipAddress: input.ipAddress,
          occurredAt: archivedAt,
          organizationId: input.organizationId,
          payload: {
            projectId: existing.id
          },
          projectId: existing.id,
          requestId: input.requestId,
          sessionId: input.sessionId,
          source: serviceName,
          subject: { id: existing.id, kind: "project", name: existing.name },
          type: "project.archived"
        })
      );

      const archived = await repository.archiveProject({
        archivedAt,
        environmentArchivedAt: archivedAt,
        events,
        organizationId: input.organizationId,
        projectId: existing.id
      });

      if (!archived) {
        throw new SourceplaneHttpError(409, "conflict", "The project could not be archived.", {
          projectId: input.projectId
        });
      }

      return { project: toProject(archived) };
    },

    async createEnvironment(input: CreateEnvironmentInput): Promise<CreateEnvironmentResponse> {
      const project = await loadActiveProject(input.organizationId, input.projectId);

      if (project.archivedAt) {
        throw new SourceplaneHttpError(412, "precondition_failed", "Cannot create environments on an archived project.", {
          projectId: project.id
        });
      }

      const slug = resolveSlug(input.slug, input.name, "environment");
      const existing = await repository.findEnvironmentBySlug(project.id, slug);
      if (existing) {
        throw new SourceplaneHttpError(409, "conflict", "An environment with this slug already exists in this project.", {
          slug
        });
      }

      const occurredAt = now().toISOString();
      const environment: EnvironmentRecord = {
        archivedAt: null,
        createdAt: occurredAt,
        id: createEnvironmentId(),
        lifecycleState: "active",
        name: input.name.trim(),
        organizationId: input.organizationId,
        projectId: project.id,
        slug,
        updatedAt: occurredAt
      };
      const event = createProjectsEvent({
        actor: input.actor,
        environmentId: environment.id,
        idempotencyKey: input.idempotencyKey,
        ipAddress: input.ipAddress,
        occurredAt,
        organizationId: input.organizationId,
        payload: {
          environmentId: environment.id,
          name: environment.name,
          projectId: project.id,
          slug: environment.slug
        },
        projectId: project.id,
        requestId: input.requestId,
        sessionId: input.sessionId,
        source: serviceName,
        subject: { id: environment.id, kind: "environment", name: environment.name },
        type: "environment.created"
      });

      await repository.createEnvironment({ environment, event });

      return { environment: toEnvironment(environment) };
    },

    async createProject(input: CreateProjectInput): Promise<CreateProjectResponse> {
      const slug = resolveSlug(input.slug, input.name, "project");
      const existing = await repository.findProjectBySlug(input.organizationId, slug);
      if (existing) {
        throw new SourceplaneHttpError(409, "conflict", "A project with this slug already exists in this organization.", {
          slug
        });
      }

      const occurredAt = now().toISOString();
      const project: ProjectRecord = {
        archivedAt: null,
        createdAt: occurredAt,
        id: createProjectId(),
        name: input.name.trim(),
        organizationId: input.organizationId,
        slug,
        updatedAt: occurredAt
      };

      const bootstrapEnvironment: EnvironmentRecord = {
        archivedAt: null,
        createdAt: occurredAt,
        id: createEnvironmentId(),
        lifecycleState: "active",
        name: defaultEnvironmentBootstrap.name,
        organizationId: input.organizationId,
        projectId: project.id,
        slug: defaultEnvironmentBootstrap.slug,
        updatedAt: occurredAt
      };

      const projectEvent = createProjectsEvent({
        actor: input.actor,
        idempotencyKey: input.idempotencyKey,
        ipAddress: input.ipAddress,
        occurredAt,
        organizationId: input.organizationId,
        payload: {
          name: project.name,
          projectId: project.id,
          slug: project.slug
        },
        projectId: project.id,
        requestId: input.requestId,
        sessionId: input.sessionId,
        source: serviceName,
        subject: { id: project.id, kind: "project", name: project.name },
        type: "project.created"
      });

      const environmentEvent = createProjectsEvent({
        actor: input.actor,
        environmentId: bootstrapEnvironment.id,
        idempotencyKey: input.idempotencyKey,
        ipAddress: input.ipAddress,
        occurredAt,
        organizationId: input.organizationId,
        payload: {
          bootstrap: true,
          environmentId: bootstrapEnvironment.id,
          name: bootstrapEnvironment.name,
          projectId: project.id,
          slug: bootstrapEnvironment.slug
        },
        projectId: project.id,
        requestId: input.requestId,
        sessionId: input.sessionId,
        source: serviceName,
        subject: { id: bootstrapEnvironment.id, kind: "environment", name: bootstrapEnvironment.name },
        type: "environment.created"
      });

      await repository.createProjectWithEnvironments({
        environments: [bootstrapEnvironment],
        events: [projectEvent, environmentEvent],
        project
      });

      return {
        environments: [toEnvironment(bootstrapEnvironment)],
        project: toProject(project)
      };
    },

    async getEnvironment(input: GetEnvironmentInput): Promise<GetEnvironmentResponse> {
      const environment = await repository.findEnvironmentById(input.organizationId, input.environmentId);

      if (!environment) {
        throw new SourceplaneHttpError(404, "not_found", "The requested environment was not found.", {
          environmentId: input.environmentId
        });
      }

      return { environment: toEnvironment(environment) };
    },

    async getProject(input: GetProjectInput): Promise<GetProjectResponse> {
      const project = await loadActiveProject(input.organizationId, input.projectId);

      return { project: toProject(project) };
    },

    async listEnvironments(input: ListEnvironmentsInput): Promise<ListEnvironmentsResponse> {
      const project = await loadActiveProject(input.organizationId, input.projectId);
      const environments = await repository.listEnvironmentsForProject(input.organizationId, project.id);

      return { environments: environments.map(toEnvironment) };
    },

    async listProjects(input: ListProjectsInput): Promise<ListProjectsResponse> {
      const projects = await repository.listProjectsForOrganization(input.organizationId);

      return { projects: projects.map(toProject) };
    },

    async lookupEnvironment(input: EnvironmentLookupRequest): Promise<EnvironmentLookupResponse> {
      const environment = await repository.findEnvironmentById(input.organizationId, input.environmentId);
      if (!environment) {
        return { environment: null };
      }

      if (input.projectId && environment.projectId !== input.projectId) {
        return { environment: null };
      }

      return { environment: toEnvironment(environment) };
    },

    async lookupProject(input: ProjectLookupRequest): Promise<ProjectLookupResponse> {
      const project = await repository.findProjectById(input.organizationId, input.projectId);

      return { project: project ? toProject(project) : null };
    },

    async updateEnvironment(input: UpdateEnvironmentInput): Promise<UpdateEnvironmentResponse> {
      const existing = await repository.findEnvironmentById(input.organizationId, input.environmentId);
      if (!existing) {
        throw new SourceplaneHttpError(404, "not_found", "The requested environment was not found.", {
          environmentId: input.environmentId
        });
      }

      if (existing.archivedAt) {
        throw new SourceplaneHttpError(412, "precondition_failed", "Cannot update an archived environment.", {
          environmentId: existing.id
        });
      }

      const project = await loadActiveProject(input.organizationId, existing.projectId);
      if (project.archivedAt) {
        throw new SourceplaneHttpError(412, "precondition_failed", "Cannot update environments under an archived project.", {
          projectId: project.id
        });
      }

      const nextName = (input.name ?? existing.name).trim();
      const nextSlug = input.slug ? normalizeSlug(input.slug) : existing.slug;

      if (nextSlug !== existing.slug) {
        if (!isValidSlug(nextSlug)) {
          throw new SourceplaneHttpError(400, "validation_failed", "The provided slug is not a valid environment slug.", {
            slug: nextSlug
          });
        }
        const slugClash = await repository.findEnvironmentBySlug(existing.projectId, nextSlug);
        if (slugClash && slugClash.id !== existing.id) {
          throw new SourceplaneHttpError(409, "conflict", "An environment with this slug already exists in this project.", {
            slug: nextSlug
          });
        }
      }

      const updatedAt = now().toISOString();
      const event = createProjectsEvent({
        actor: input.actor,
        environmentId: existing.id,
        idempotencyKey: input.idempotencyKey,
        ipAddress: input.ipAddress,
        occurredAt: updatedAt,
        organizationId: input.organizationId,
        payload: {
          environmentId: existing.id,
          name: nextName,
          projectId: existing.projectId,
          slug: nextSlug
        },
        projectId: existing.projectId,
        requestId: input.requestId,
        sessionId: input.sessionId,
        source: serviceName,
        subject: { id: existing.id, kind: "environment", name: nextName },
        type: "environment.updated"
      });

      const updated = await repository.updateEnvironment({
        environmentId: existing.id,
        event,
        name: nextName,
        organizationId: input.organizationId,
        projectId: existing.projectId,
        slug: nextSlug,
        updatedAt
      });

      if (!updated) {
        throw new SourceplaneHttpError(409, "conflict", "The environment could not be updated.", {
          environmentId: existing.id
        });
      }

      return { environment: toEnvironment(updated) };
    },

    async updateProject(input: UpdateProjectInput): Promise<UpdateProjectResponse> {
      const existing = await loadActiveProject(input.organizationId, input.projectId);

      if (existing.archivedAt) {
        throw new SourceplaneHttpError(412, "precondition_failed", "Cannot update an archived project.", {
          projectId: existing.id
        });
      }

      const nextName = (input.name ?? existing.name).trim();
      const nextSlug = input.slug ? normalizeSlug(input.slug) : existing.slug;

      if (nextSlug !== existing.slug) {
        if (!isValidSlug(nextSlug)) {
          throw new SourceplaneHttpError(400, "validation_failed", "The provided slug is not a valid project slug.", {
            slug: nextSlug
          });
        }
        const clash = await repository.findProjectBySlug(input.organizationId, nextSlug);
        if (clash && clash.id !== existing.id) {
          throw new SourceplaneHttpError(409, "conflict", "A project with this slug already exists in this organization.", {
            slug: nextSlug
          });
        }
      }

      const updatedAt = now().toISOString();
      const event = createProjectsEvent({
        actor: input.actor,
        idempotencyKey: input.idempotencyKey,
        ipAddress: input.ipAddress,
        occurredAt: updatedAt,
        organizationId: input.organizationId,
        payload: {
          name: nextName,
          projectId: existing.id,
          slug: nextSlug
        },
        projectId: existing.id,
        requestId: input.requestId,
        sessionId: input.sessionId,
        source: serviceName,
        subject: { id: existing.id, kind: "project", name: nextName },
        type: "project.updated"
      });

      const updated = await repository.updateProject({
        event,
        name: nextName,
        organizationId: input.organizationId,
        projectId: existing.id,
        slug: nextSlug,
        updatedAt
      });

      if (!updated) {
        throw new SourceplaneHttpError(409, "conflict", "The project could not be updated.", {
          projectId: existing.id
        });
      }

      return { project: toProject(updated) };
    }
  };
}

function resolveSlug(provided: string | undefined, name: string, kind: "environment" | "project"): string {
  if (provided !== undefined) {
    const normalized = normalizeSlug(provided);
    if (!isValidSlug(normalized)) {
      throw new SourceplaneHttpError(400, "validation_failed", `The provided slug is not a valid ${kind} slug.`, {
        slug: normalized
      });
    }
    return normalized;
  }

  const derived = slugifyDisplayName(name);
  if (!isValidSlug(derived)) {
    throw new SourceplaneHttpError(400, "validation_failed", `Could not derive a valid ${kind} slug from the provided name.`, {
      name
    });
  }

  return derived;
}

function createProjectId(): string {
  return `prj_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function createEnvironmentId(): string {
  return `env_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

function toProject(record: ProjectRecord): Project {
  return {
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    id: record.id,
    name: record.name,
    organizationId: record.organizationId,
    slug: record.slug,
    updatedAt: record.updatedAt
  };
}

function toEnvironment(record: EnvironmentRecord): Environment {
  return {
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    id: record.id,
    lifecycleState: record.lifecycleState,
    name: record.name,
    organizationId: record.organizationId,
    projectId: record.projectId,
    slug: record.slug,
    updatedAt: record.updatedAt
  };
}
