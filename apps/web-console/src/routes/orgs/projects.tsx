import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button, EmptyState, FormField, Modal, SectionCard, Table, TextField, useToast } from "@sourceplane/ui";

import { useArchiveProject, useCreateProject, useProjects } from "../../features/projects/hooks.js";
import { describeError } from "../../lib/errors.js";

export function OrgProjectsRoute() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId ?? null;
  const projectsQuery = useProjects(orgId);
  const createProject = useCreateProject(orgId ?? "");
  const archiveProject = useArchiveProject(orgId ?? "");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (!orgId) return <p>Missing org id.</p>;

  const handleCreate = () => {
    createProject.mutate(
      { name },
      {
        onSuccess: (response) => {
          toast.push({ message: `Created project ${response.project.name}.`, variant: "success" });
          setOpen(false);
          setName("");
        },
        onError: (error) => toast.push({ ...describeError(error), variant: "error" })
      }
    );
  };

  return (
    <div className="sp-stack">
      <SectionCard title="Projects" action={<Button onClick={() => setOpen(true)}>New project</Button>}>
        {projectsQuery.isLoading ? (
          <p className="sp-muted">Loading projects…</p>
        ) : (projectsQuery.data ?? []).length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create a project to provision environments and resources."
            action={<Button onClick={() => setOpen(true)}>Create project</Button>}
          />
        ) : (
          <Table
            rowKey={(p) => p.id}
            columns={[
              {
                key: "name",
                header: "Name",
                render: (project) => (
                  <Link to={`/orgs/${orgId}/projects/${project.id}`}>{project.name}</Link>
                )
              },
              { key: "slug", header: "Slug", render: (project) => <code>{project.slug}</code> },
              {
                key: "status",
                header: "Status",
                render: (project) => (project.archivedAt ? "archived" : "active")
              },
              {
                key: "actions",
                header: "Actions",
                render: (project) => (
                  <Button
                    variant="ghost"
                    disabled={Boolean(project.archivedAt)}
                    onClick={() =>
                      archiveProject.mutate(project.id, {
                        onSuccess: () => toast.push({ message: `Archived ${project.name}.`, variant: "success" }),
                        onError: (error) => toast.push({ ...describeError(error), variant: "error" })
                      })
                    }
                  >
                    Archive
                  </Button>
                )
              }
            ]}
            rows={projectsQuery.data ?? []}
          />
        )}
      </SectionCard>

      <Modal
        open={open}
        title="New project"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={createProject.isPending} disabled={!name.trim()}>
              Create
            </Button>
          </>
        }
      >
        <FormField label="Project name" htmlFor="project-name" hint="A slug will be generated automatically.">
          <TextField id="project-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} required />
        </FormField>
      </Modal>
    </div>
  );
}
