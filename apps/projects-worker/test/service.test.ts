/* eslint-disable @typescript-eslint/require-await */
import { describe, expect, it } from "vitest";

import { createProjectsService } from "../src/domain/service.js";
import type {
  ArchiveEnvironmentInput,
  ArchiveProjectInput,
  CreateEnvironmentInput,
  CreateProjectWithEnvironmentsInput,
  EnvironmentRecord,
  ProjectRecord,
  ProjectsRepository,
  UpdateEnvironmentInput,
  UpdateProjectInput
} from "../src/domain/repository.js";

class InMemoryProjectsRepository implements ProjectsRepository {
  private readonly projects = new Map<string, ProjectRecord>();
  private readonly environments = new Map<string, EnvironmentRecord>();
  public readonly events: { type: string; payload: unknown }[] = [];

  async archiveEnvironment(input: ArchiveEnvironmentInput): Promise<EnvironmentRecord | null> {
    const env = this.environments.get(input.environmentId);
    if (!env || env.organizationId !== input.organizationId || env.archivedAt) {
      return null;
    }
    const updated: EnvironmentRecord = {
      ...env,
      archivedAt: input.archivedAt,
      lifecycleState: "archived",
      updatedAt: input.archivedAt
    };
    this.environments.set(env.id, updated);
    this.recordEvent(input.event);
    return updated;
  }

  async archiveProject(input: ArchiveProjectInput): Promise<ProjectRecord | null> {
    const project = this.projects.get(input.projectId);
    if (!project || project.organizationId !== input.organizationId || project.archivedAt) {
      return null;
    }
    const updated: ProjectRecord = { ...project, archivedAt: input.archivedAt, updatedAt: input.archivedAt };
    this.projects.set(project.id, updated);
    for (const env of this.environments.values()) {
      if (env.projectId === project.id && !env.archivedAt) {
        this.environments.set(env.id, {
          ...env,
          archivedAt: input.environmentArchivedAt,
          lifecycleState: "archived",
          updatedAt: input.environmentArchivedAt
        });
      }
    }
    for (const event of input.events) this.recordEvent(event);
    return updated;
  }

  async createEnvironment(input: CreateEnvironmentInput): Promise<void> {
    this.environments.set(input.environment.id, input.environment);
    this.recordEvent(input.event);
  }

  async createProjectWithEnvironments(input: CreateProjectWithEnvironmentsInput): Promise<void> {
    this.projects.set(input.project.id, input.project);
    for (const env of input.environments) {
      this.environments.set(env.id, env);
    }
    for (const event of input.events) this.recordEvent(event);
  }

  async findEnvironmentById(organizationId: string, environmentId: string): Promise<EnvironmentRecord | null> {
    const env = this.environments.get(environmentId);
    return env && env.organizationId === organizationId ? env : null;
  }

  async findEnvironmentBySlug(projectId: string, slug: string): Promise<EnvironmentRecord | null> {
    for (const env of this.environments.values()) {
      if (env.projectId === projectId && env.slug === slug) {
        return env;
      }
    }
    return null;
  }

  async findProjectById(organizationId: string, projectId: string): Promise<ProjectRecord | null> {
    const project = this.projects.get(projectId);
    return project && project.organizationId === organizationId ? project : null;
  }

  async findProjectBySlug(organizationId: string, slug: string): Promise<ProjectRecord | null> {
    for (const p of this.projects.values()) {
      if (p.organizationId === organizationId && p.slug === slug) {
        return p;
      }
    }
    return null;
  }

  async listEnvironmentsForProject(organizationId: string, projectId: string): Promise<EnvironmentRecord[]> {
    return Array.from(this.environments.values()).filter(
      (env) => env.organizationId === organizationId && env.projectId === projectId
    );
  }

  async listProjectsForOrganization(organizationId: string): Promise<ProjectRecord[]> {
    return Array.from(this.projects.values()).filter((p) => p.organizationId === organizationId);
  }

  async updateEnvironment(input: UpdateEnvironmentInput): Promise<EnvironmentRecord | null> {
    const env = this.environments.get(input.environmentId);
    if (!env || env.organizationId !== input.organizationId || env.archivedAt) {
      return null;
    }
    const updated: EnvironmentRecord = {
      ...env,
      name: input.name,
      slug: input.slug,
      updatedAt: input.updatedAt
    };
    this.environments.set(env.id, updated);
    this.recordEvent(input.event);
    return updated;
  }

  async updateProject(input: UpdateProjectInput): Promise<ProjectRecord | null> {
    const project = this.projects.get(input.projectId);
    if (!project || project.organizationId !== input.organizationId || project.archivedAt) {
      return null;
    }
    const updated: ProjectRecord = {
      ...project,
      name: input.name,
      slug: input.slug,
      updatedAt: input.updatedAt
    };
    this.projects.set(project.id, updated);
    this.recordEvent(input.event);
    return updated;
  }

  private recordEvent(event: { type: string; payload: unknown }): void {
    this.events.push({ payload: event.payload, type: event.type });
  }
}

const baseMetadata = {
  idempotencyKey: null,
  ipAddress: null,
  requestId: "req_test",
  sessionId: "ses_test",
  traceparent: null
};

const ownerActor = { id: "usr_owner", type: "user" } as const;

function makeService(): { repo: InMemoryProjectsRepository; service: ReturnType<typeof createProjectsService> } {
  const repo = new InMemoryProjectsRepository();
  const service = createProjectsService({
    now: () => new Date("2026-04-24T10:00:00.000Z"),
    repository: repo,
    serviceName: "projects-worker"
  });
  return { repo, service };
}

describe("ProjectsService", () => {
  it("creates a project and bootstraps a default environment", async () => {
    const { repo, service } = makeService();

    const result = await service.createProject({
      ...baseMetadata,
      actor: ownerActor,
      name: "Acme API",
      organizationId: "org_1"
    });

    expect(result.project.slug).toBe("acme-api");
    expect(result.project.organizationId).toBe("org_1");
    expect(result.project.archivedAt).toBeNull();
    expect(result.environments).toHaveLength(1);
    expect(result.environments[0]?.slug).toBe("development");
    expect(result.environments[0]?.lifecycleState).toBe("active");

    expect(repo.events.map((e) => e.type)).toEqual(["project.created", "environment.created"]);
  });

  it("rejects duplicate project slug per organization but allows the same slug in another org", async () => {
    const { service } = makeService();
    await service.createProject({ ...baseMetadata, actor: ownerActor, name: "Apollo", organizationId: "org_1" });

    await expect(
      service.createProject({ ...baseMetadata, actor: ownerActor, name: "apollo", organizationId: "org_1" })
    ).rejects.toMatchObject({ status: 409 });

    const otherOrg = await service.createProject({
      ...baseMetadata,
      actor: ownerActor,
      name: "Apollo",
      organizationId: "org_2"
    });
    expect(otherOrg.project.slug).toBe("apollo");
  });

  it("supports adding multiple environments per project and rejects duplicate slugs", async () => {
    const { service } = makeService();
    const created = await service.createProject({
      ...baseMetadata,
      actor: ownerActor,
      name: "Apollo",
      organizationId: "org_1"
    });

    const staging = await service.createEnvironment({
      ...baseMetadata,
      actor: ownerActor,
      name: "Staging",
      organizationId: "org_1",
      projectId: created.project.id
    });
    expect(staging.environment.slug).toBe("staging");

    await expect(
      service.createEnvironment({
        ...baseMetadata,
        actor: ownerActor,
        name: "Staging",
        organizationId: "org_1",
        projectId: created.project.id
      })
    ).rejects.toMatchObject({ status: 409 });

    const list = await service.listEnvironments({ organizationId: "org_1", projectId: created.project.id });
    expect(list.environments.map((e) => e.slug)).toEqual(["development", "staging"]);
  });

  it("does not return projects from another organization", async () => {
    const { service } = makeService();
    const created = await service.createProject({
      ...baseMetadata,
      actor: ownerActor,
      name: "Apollo",
      organizationId: "org_1"
    });

    await expect(service.getProject({ organizationId: "org_2", projectId: created.project.id })).rejects.toMatchObject({
      status: 404
    });
  });

  it("archives a project softly and prevents further environment creation", async () => {
    const { service } = makeService();
    const created = await service.createProject({
      ...baseMetadata,
      actor: ownerActor,
      name: "Apollo",
      organizationId: "org_1"
    });

    const archived = await service.archiveProject({
      ...baseMetadata,
      actor: ownerActor,
      organizationId: "org_1",
      projectId: created.project.id
    });
    expect(archived.project.archivedAt).not.toBeNull();

    await expect(
      service.createEnvironment({
        ...baseMetadata,
        actor: ownerActor,
        name: "Staging",
        organizationId: "org_1",
        projectId: created.project.id
      })
    ).rejects.toMatchObject({ status: 412 });
  });

  it("archives an environment softly and rejects updates after archival", async () => {
    const { service } = makeService();
    const created = await service.createProject({
      ...baseMetadata,
      actor: ownerActor,
      name: "Apollo",
      organizationId: "org_1"
    });
    const envId = created.environments[0]!.id;

    const archived = await service.archiveEnvironment({
      ...baseMetadata,
      actor: ownerActor,
      environmentId: envId,
      organizationId: "org_1"
    });
    expect(archived.environment.lifecycleState).toBe("archived");
    expect(archived.environment.archivedAt).not.toBeNull();

    await expect(
      service.updateEnvironment({
        ...baseMetadata,
        actor: ownerActor,
        environmentId: envId,
        name: "renamed",
        organizationId: "org_1"
      })
    ).rejects.toMatchObject({ status: 412 });
  });

  it("supports lookup endpoints used by other bounded contexts", async () => {
    const { service } = makeService();
    const created = await service.createProject({
      ...baseMetadata,
      actor: ownerActor,
      name: "Apollo",
      organizationId: "org_1"
    });

    const projectLookup = await service.lookupProject({
      organizationId: "org_1",
      projectId: created.project.id
    });
    expect(projectLookup.project?.id).toBe(created.project.id);

    const wrongOrg = await service.lookupProject({
      organizationId: "org_2",
      projectId: created.project.id
    });
    expect(wrongOrg.project).toBeNull();

    const envLookup = await service.lookupEnvironment({
      environmentId: created.environments[0]!.id,
      organizationId: "org_1",
      projectId: created.project.id
    });
    expect(envLookup.environment?.id).toBe(created.environments[0]!.id);

    const envWrongProject = await service.lookupEnvironment({
      environmentId: created.environments[0]!.id,
      organizationId: "org_1",
      projectId: "prj_other"
    });
    expect(envWrongProject.environment).toBeNull();
  });
});
