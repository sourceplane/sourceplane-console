import { useState } from "react";
import { useParams } from "react-router-dom";

import { Button, FormField, SectionCard, TextField, useToast } from "@sourceplane/ui";

import { useUpdateOrganization } from "../../features/orgs/hooks.js";
import { describeError } from "../../lib/errors.js";

export function OrgSettingsRoute() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId ?? "";
  const update = useUpdateOrganization(orgId);
  const toast = useToast();
  const [name, setName] = useState("");

  if (!orgId) return <p>Missing org id.</p>;

  return (
    <div className="sp-stack">
      <SectionCard title="Organization settings">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            update.mutate(
              { name },
              {
                onSuccess: () => toast.push({ message: "Organization updated.", variant: "success" }),
                onError: (error) => toast.push({ ...describeError(error), variant: "error" })
              }
            );
          }}
        >
          <FormField label="Rename organization" htmlFor="org-rename" hint="Update the organization display name.">
            <TextField id="org-rename" value={name} onChange={(event) => setName(event.target.value)} required />
          </FormField>
          <Button type="submit" loading={update.isPending} disabled={!name.trim()}>
            Save
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
