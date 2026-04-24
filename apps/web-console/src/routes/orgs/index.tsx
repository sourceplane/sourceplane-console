import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button, EmptyState, FormField, Modal, SectionCard, Table, TextField, useToast } from "@sourceplane/ui";

import { useCreateOrganization, useOrganizations } from "../../features/orgs/hooks.js";
import { useSession } from "../../app/providers.js";
import { describeError } from "../../lib/errors.js";

export function OrgsIndexRoute() {
  const orgsQuery = useOrganizations();
  const createOrg = useCreateOrganization();
  const { setActiveOrgId } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const handleCreate = () => {
    createOrg.mutate(
      { name },
      {
        onSuccess: (response) => {
          toast.push({ message: `Created ${response.organization.name}.`, variant: "success" });
          setActiveOrgId(response.organization.id);
          setOpen(false);
          setName("");
          navigate(`/orgs/${response.organization.id}/projects`);
        },
        onError: (error) => toast.push({ ...describeError(error), variant: "error" })
      }
    );
  };

  return (
    <div className="sp-stack">
      <SectionCard title="Your organizations" action={<Button onClick={() => setOpen(true)}>New organization</Button>}>
        {orgsQuery.isLoading ? (
          <p className="sp-muted">Loading…</p>
        ) : orgsQuery.error ? (
          <p className="sp-muted">Could not load organizations: {describeError(orgsQuery.error).message}</p>
        ) : (orgsQuery.data ?? []).length === 0 ? (
          <EmptyState
            title="You have no organizations yet"
            description="Create one to start provisioning projects and environments."
            action={<Button onClick={() => setOpen(true)}>Create organization</Button>}
          />
        ) : (
          <Table
            rowKey={(o) => o.id}
            columns={[
              {
                key: "name",
                header: "Name",
                render: (org) => (
                  <Link to={`/orgs/${org.id}/projects`} onClick={() => setActiveOrgId(org.id)}>
                    {org.name}
                  </Link>
                )
              },
              { key: "slug", header: "Slug", render: (org) => <code>{org.slug}</code> },
              { key: "role", header: "Role", render: (org) => org.role }
            ]}
            rows={orgsQuery.data ?? []}
          />
        )}
      </SectionCard>

      <Modal
        open={open}
        title="New organization"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={createOrg.isPending} disabled={!name.trim()}>
              Create
            </Button>
          </>
        }
      >
        <FormField label="Organization name" htmlFor="org-name" hint="A slug will be generated automatically.">
          <TextField id="org-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} required />
        </FormField>
      </Modal>
    </div>
  );
}
