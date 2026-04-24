import { useState } from "react";
import { useParams } from "react-router-dom";

import { Button, FormField, SectionCard, TextField, useToast } from "@sourceplane/ui";

import { useUpdateProject } from "../../features/projects/hooks.js";
import { describeError } from "../../lib/errors.js";

export function ProjectSettingsRoute() {
  const params = useParams<{ orgId: string; projectId: string }>();
  const update = useUpdateProject(params.orgId ?? "", params.projectId ?? "");
  const toast = useToast();
  const [name, setName] = useState("");

  if (!params.orgId || !params.projectId) return <p>Missing context.</p>;

  return (
    <SectionCard title="Project settings">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          update.mutate(
            { name },
            {
              onSuccess: () => toast.push({ message: "Project updated.", variant: "success" }),
              onError: (error) => toast.push({ ...describeError(error), variant: "error" })
            }
          );
        }}
      >
        <FormField label="Rename project" htmlFor="project-rename">
          <TextField id="project-rename" value={name} onChange={(event) => setName(event.target.value)} required />
        </FormField>
        <Button type="submit" loading={update.isPending} disabled={!name.trim()}>
          Save
        </Button>
      </form>
    </SectionCard>
  );
}
