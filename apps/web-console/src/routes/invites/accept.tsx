import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import { Button, FormField, SectionCard, TextField, useToast } from "@sourceplane/ui";

import { useAcceptInvite } from "../../features/members/hooks.js";
import { useSession } from "../../app/providers.js";
import { describeError } from "../../lib/errors.js";

export function AcceptInviteRoute() {
  const params = useParams<{ inviteId: string }>();
  const [token, setTokenInput] = useState(new URLSearchParams(window.location.search).get("token") ?? "");
  const { token: sessionToken, setActiveOrgId } = useSession();
  const accept = useAcceptInvite();
  const toast = useToast();

  if (!params.inviteId) {
    return <p>Missing invite id.</p>;
  }

  if (!sessionToken) {
    return <Navigate to={`/login?next=${encodeURIComponent(`/invites/${params.inviteId}`)}`} replace />;
  }

  const handleAccept = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    accept.mutate(
      { inviteId: params.inviteId!, token },
      {
        onSuccess: (response) => {
          toast.push({ message: `Joined ${response.organization.name}.`, variant: "success" });
          setActiveOrgId(response.organization.id);
        },
        onError: (error) => toast.push({ ...describeError(error), variant: "error" })
      }
    );
  };

  if (accept.data) {
    return <Navigate to={`/orgs/${accept.data.organization.id}/projects`} replace />;
  }

  return (
    <main className="sp-shell">
      <div className="sp-shell__frame" style={{ maxWidth: 480 }}>
        <p className="sp-shell__eyebrow">Sourceplane</p>
        <h1 className="sp-shell__title">Accept invite</h1>
        <SectionCard title="Invitation token">
          <form onSubmit={handleAccept} noValidate>
            <FormField label="Invite token" htmlFor="invite-token" hint="Paste the token from your invite email or local-debug response.">
              <TextField id="invite-token" required value={token} onChange={(event) => setTokenInput(event.target.value)} />
            </FormField>
            <Button type="submit" loading={accept.isPending}>
              Accept invitation
            </Button>
          </form>
        </SectionCard>
      </div>
    </main>
  );
}
