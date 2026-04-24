import { environmentLifecycleStateSchema, type SourceplaneEventEnvelope } from "@sourceplane/contracts";

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
} from "./repository.js";

interface ProjectRow {
  archived_at: string | null;
  created_at: string;
  id: string;
  name: string;
  organization_id: string;
  slug: string;
  updated_at: string;
}

interface EnvironmentRow {
  archived_at: string | null;
  created_at: string;
  id: string;
  lifecycle_state: string;
  name: string;
  organization_id: string;
  project_id: string;
  slug: string;
  updated_at: string;
}

export class D1ProjectsRepository implements ProjectsRepository {
  constructor(private readonly database: D1Database) {}

  async archiveEnvironment(input: ArchiveEnvironmentInput): Promise<EnvironmentRecord | null> {
    return withTransaction(this.database, async () => {
      const update = await this.database
        .prepare(
          `UPDATE environments
           SET lifecycle_state = 'archived', archived_at = ?, updated_at = ?
           WHERE id = ? AND organization_id = ? AND archived_at IS NULL`
        )
        .bind(input.archivedAt, input.archivedAt, input.environmentId, input.organizationId)
        .run();

      if (getChanges(update) === 0) {
        return null;
      }

      await appendEvents(this.database, [input.event]);

      return this.findEnvironmentById(input.organizationId, input.environmentId);
    });
  }

  async archiveProject(input: ArchiveProjectInput): Promise<ProjectRecord | null> {
    return withTransaction(this.database, async () => {
      const update = await this.database
        .prepare(
          `UPDATE projects
           SET archived_at = ?, updated_at = ?
           WHERE id = ? AND organization_id = ? AND archived_at IS NULL`
        )
        .bind(input.archivedAt, input.archivedAt, input.projectId, input.organizationId)
        .run();

      if (getChanges(update) === 0) {
        return null;
      }

      await this.database
        .prepare(
          `UPDATE environments
           SET lifecycle_state = 'archived', archived_at = ?, updated_at = ?
           WHERE project_id = ? AND archived_at IS NULL`
        )
        .bind(input.environmentArchivedAt, input.environmentArchivedAt, input.projectId)
        .run();

      await appendEvents(this.database, input.events);

      return this.findProjectById(input.organizationId, input.projectId);
    });
  }

  async createEnvironment(input: CreateEnvironmentInput): Promise<void> {
    await withTransaction(this.database, async () => {
      await this.database
        .prepare(
          `INSERT INTO environments (
             id, organization_id, project_id, name, slug, lifecycle_state, created_at, updated_at, archived_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          input.environment.id,
          input.environment.organizationId,
          input.environment.projectId,
          input.environment.name,
          input.environment.slug,
          input.environment.lifecycleState,
          input.environment.createdAt,
          input.environment.updatedAt,
          input.environment.archivedAt
        )
        .run();

      await appendEvents(this.database, [input.event]);
    });
  }

  async createProjectWithEnvironments(input: CreateProjectWithEnvironmentsInput): Promise<void> {
    await withTransaction(this.database, async () => {
      await this.database
        .prepare(
          `INSERT INTO projects (
             id, organization_id, name, slug, created_at, updated_at, archived_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          input.project.id,
          input.project.organizationId,
          input.project.name,
          input.project.slug,
          input.project.createdAt,
          input.project.updatedAt,
          input.project.archivedAt
        )
        .run();

      for (const environment of input.environments) {
        await this.database
          .prepare(
            `INSERT INTO environments (
               id, organization_id, project_id, name, slug, lifecycle_state, created_at, updated_at, archived_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            environment.id,
            environment.organizationId,
            environment.projectId,
            environment.name,
            environment.slug,
            environment.lifecycleState,
            environment.createdAt,
            environment.updatedAt,
            environment.archivedAt
          )
          .run();
      }

      await appendEvents(this.database, input.events);
    });
  }

  async findEnvironmentById(organizationId: string, environmentId: string): Promise<EnvironmentRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT id, organization_id, project_id, name, slug, lifecycle_state, created_at, updated_at, archived_at
         FROM environments
         WHERE organization_id = ? AND id = ?`
      )
      .bind(organizationId, environmentId)
      .first<EnvironmentRow>();

    return row ? mapEnvironmentRow(row) : null;
  }

  async findEnvironmentBySlug(projectId: string, slug: string): Promise<EnvironmentRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT id, organization_id, project_id, name, slug, lifecycle_state, created_at, updated_at, archived_at
         FROM environments
         WHERE project_id = ? AND slug = ?`
      )
      .bind(projectId, slug)
      .first<EnvironmentRow>();

    return row ? mapEnvironmentRow(row) : null;
  }

  async findProjectById(organizationId: string, projectId: string): Promise<ProjectRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT id, organization_id, name, slug, created_at, updated_at, archived_at
         FROM projects
         WHERE organization_id = ? AND id = ?`
      )
      .bind(organizationId, projectId)
      .first<ProjectRow>();

    return row ? mapProjectRow(row) : null;
  }

  async findProjectBySlug(organizationId: string, slug: string): Promise<ProjectRecord | null> {
    const row = await this.database
      .prepare(
        `SELECT id, organization_id, name, slug, created_at, updated_at, archived_at
         FROM projects
         WHERE organization_id = ? AND slug = ?`
      )
      .bind(organizationId, slug)
      .first<ProjectRow>();

    return row ? mapProjectRow(row) : null;
  }

  async listEnvironmentsForProject(organizationId: string, projectId: string): Promise<EnvironmentRecord[]> {
    const result = await this.database
      .prepare(
        `SELECT id, organization_id, project_id, name, slug, lifecycle_state, created_at, updated_at, archived_at
         FROM environments
         WHERE organization_id = ? AND project_id = ?
         ORDER BY created_at ASC, id ASC`
      )
      .bind(organizationId, projectId)
      .all<EnvironmentRow>();

    return result.results.map(mapEnvironmentRow);
  }

  async listProjectsForOrganization(organizationId: string): Promise<ProjectRecord[]> {
    const result = await this.database
      .prepare(
        `SELECT id, organization_id, name, slug, created_at, updated_at, archived_at
         FROM projects
         WHERE organization_id = ?
         ORDER BY LOWER(name) ASC, id ASC`
      )
      .bind(organizationId)
      .all<ProjectRow>();

    return result.results.map(mapProjectRow);
  }

  async updateEnvironment(input: UpdateEnvironmentInput): Promise<EnvironmentRecord | null> {
    return withTransaction(this.database, async () => {
      const update = await this.database
        .prepare(
          `UPDATE environments
           SET name = ?, slug = ?, updated_at = ?
           WHERE id = ? AND organization_id = ? AND project_id = ? AND archived_at IS NULL`
        )
        .bind(input.name, input.slug, input.updatedAt, input.environmentId, input.organizationId, input.projectId)
        .run();

      if (getChanges(update) === 0) {
        return null;
      }

      await appendEvents(this.database, [input.event]);

      return this.findEnvironmentById(input.organizationId, input.environmentId);
    });
  }

  async updateProject(input: UpdateProjectInput): Promise<ProjectRecord | null> {
    return withTransaction(this.database, async () => {
      const update = await this.database
        .prepare(
          `UPDATE projects
           SET name = ?, slug = ?, updated_at = ?
           WHERE id = ? AND organization_id = ? AND archived_at IS NULL`
        )
        .bind(input.name, input.slug, input.updatedAt, input.projectId, input.organizationId)
        .run();

      if (getChanges(update) === 0) {
        return null;
      }

      await appendEvents(this.database, [input.event]);

      return this.findProjectById(input.organizationId, input.projectId);
    });
  }
}

async function appendEvents(database: D1Database, events: readonly SourceplaneEventEnvelope[]): Promise<void> {
  for (const event of events) {
    await database
      .prepare(
        `INSERT INTO projects_event_outbox (id, event_type, envelope_json, occurred_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(event.id, event.type, JSON.stringify(event), event.occurredAt)
      .run();
  }
}

function getChanges(result: unknown): number {
  if (!result || typeof result !== "object") {
    return 0;
  }

  if (
    "meta" in result &&
    result.meta &&
    typeof result.meta === "object" &&
    "changes" in result.meta &&
    typeof result.meta.changes === "number"
  ) {
    return result.meta.changes;
  }

  if ("changes" in result && typeof result.changes === "number") {
    return result.changes;
  }

  return 0;
}

function mapProjectRow(row: ProjectRow): ProjectRecord {
  return {
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    id: row.id,
    name: row.name,
    organizationId: row.organization_id,
    slug: row.slug,
    updatedAt: row.updated_at
  };
}

function mapEnvironmentRow(row: EnvironmentRow): EnvironmentRecord {
  return {
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    id: row.id,
    lifecycleState: environmentLifecycleStateSchema.parse(row.lifecycle_state),
    name: row.name,
    organizationId: row.organization_id,
    projectId: row.project_id,
    slug: row.slug,
    updatedAt: row.updated_at
  };
}

async function withTransaction<T>(database: D1Database, callback: () => Promise<T>): Promise<T> {
  await database.exec("BEGIN IMMEDIATE");

  try {
    const result = await callback();
    await database.exec("COMMIT");

    return result;
  } catch (error) {
    try {
      await database.exec("ROLLBACK");
    } catch {
      // Ignore rollback failures so the original error is preserved.
    }

    throw error;
  }
}
