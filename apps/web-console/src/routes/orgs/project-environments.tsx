import { useState } from "react";
import { useParams } from "react-router-dom";

import { Button, EmptyState, FormField, Modal, SectionCard, Table, TextField, useToast } from "@sourceplane/ui";

import { useArchiveEnvironment, useCreateEnvironment, useEnvironments } from "../../features/environments/hooks.js";
import { describeError } from "../../lib/errors.js";

export function ProjectEnvironmentsRoute() {
  const params = useParams<{ orgId: string; projectId: string }>();
  const orgId = params.orgId ?? null;
  const projectId = params.projectId ?? null;
  const envQuery = useEnvironments(orgId, projectId);
  const createEnv = useCreateEnvironment(orgId ?? "", projectId ?? "");
  const archiveEnv = useArchiveEnvironment(orgId ?? "", projectId ?? "");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (!orgId || !projectId) return <p>Missing context.</p>;

  const handleCreate = () => {
    createEnv.mutate(
      { name },
      {
        onSuccess: (response) => {
          toast.push({ message: `Created environment ${response.environment.name}.`, variant: "success" });
          setOpen(false);
          setName("");
        },
        onError: (error) => toast.push({ ...describeError(error), variant: "error" })
      }
    );
  };

  return (
    <div className="sp-stack">
      <SectionCard title="Environments" action={<Button onClick={() => setOpen(true)}>New environment</Button>}>
        {envQuery.isLoading ? (
          <p className="sp-muted">Loading environments…</p>
        ) : (envQuery.data ?? []).length === 0 ? (
          <EmptyState
            title="No environments yet"
            description="A development environment is created automatically with each project."
          />
        ) : (
          <Table
            rowKey={(e) => e.id}
            columns={[
              { key: "name", header: "Name", render: (env) => env.name },
              { key: "slug", header: "Slug", render: (env) => <code>{env.slug}</code> },
              { key: "lifecycle", header: "Lifecycle", render: (env) => env.lifecycleState },
              {
                key: "actions",
                header: "Actions",
                render: (env) => (
                  <Button
                    variant="ghost"
                    disabled={env.lifecycleState === "archived"}
                    onClick={() =>
                      archiveEnv.mutate(env.id, {
                        onSuccess: () => toast.push({ message: `Archived ${env.name}.`, variant: "success" }),
                        onError: (error) => toast.push({ ...describeError(error), variant: "error" })
                      })
                    }
                  >
                    Archive
                  </Button>
                )
              }
            ]}
            rows={envQuery.data ?? []}
          />
        )}
      </SectionCard>

      <Modal
        open={open}
        title="New environment"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={createEnv.isPending} disabled={!name.trim()}>
              Create
            </Button>
          </>
        }
      >
        <FormField label="Environment name" htmlFor="env-name" hint="Slug is auto-generated; common values are staging, qa, production.">
          <TextField id="env-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} required />
        </FormField>
      </Modal>
    </div>
  );
}
