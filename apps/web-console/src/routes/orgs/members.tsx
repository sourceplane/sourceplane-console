import { useState } from "react";
import { useParams } from "react-router-dom";

import { organizationRoles, type OrganizationRole } from "@sourceplane/contracts";
import {
  Button,
  EmptyState,
  FormField,
  Modal,
  RoleBadge,
  SectionCard,
  Select,
  Table,
  TextField,
  useToast
} from "@sourceplane/ui";

import { useCreateInvite, useMembers, useRemoveMember, useUpdateMemberRole } from "../../features/members/hooks.js";
import { describeError } from "../../lib/errors.js";

export function OrgMembersRoute() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId ?? null;
  const membersQuery = useMembers(orgId);
  const createInvite = useCreateInvite(orgId ?? "");
  const updateRole = useUpdateMemberRole(orgId ?? "");
  const removeMember = useRemoveMember(orgId ?? "");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>("viewer");
  const [debugToken, setDebugToken] = useState<string | null>(null);

  if (!orgId) return <p>Missing org id.</p>;

  const handleInvite = () => {
    createInvite.mutate(
      { email, role },
      {
        onSuccess: (response) => {
          if (response.delivery.mode === "local_debug") {
            setDebugToken(response.delivery.acceptToken);
            toast.push({
              message: "Invite created (local debug).",
              detail: `Token: ${response.delivery.acceptToken}`,
              variant: "info"
            });
          } else {
            toast.push({ message: "Invite emailed.", detail: response.delivery.emailHint, variant: "success" });
          }
          setEmail("");
        },
        onError: (error) => toast.push({ ...describeError(error), variant: "error" })
      }
    );
  };

  return (
    <div className="sp-stack">
      <SectionCard title="Members" action={<Button onClick={() => setOpen(true)}>Invite member</Button>}>
        {membersQuery.isLoading ? (
          <p className="sp-muted">Loading members…</p>
        ) : (membersQuery.data ?? []).length === 0 ? (
          <EmptyState title="No members yet" description="Invite teammates to collaborate." />
        ) : (
          <Table
            rowKey={(m) => m.id}
            columns={[
              { key: "user", header: "User", render: (member) => <code>{member.userId}</code> },
              { key: "role", header: "Role", render: (member) => <RoleBadge role={member.role} /> },
              {
                key: "actions",
                header: "Actions",
                render: (member) => (
                  <div className="sp-row">
                    <Select
                      aria-label={`Change role for ${member.userId}`}
                      value={member.role}
                      onChange={(event) =>
                        updateRole.mutate(
                          { memberId: member.id, role: event.target.value as OrganizationRole },
                          {
                            onSuccess: () => toast.push({ message: "Role updated.", variant: "success" }),
                            onError: (error) => toast.push({ ...describeError(error), variant: "error" })
                          }
                        )
                      }
                    >
                      {organizationRoles.map((value) => (
                        <option key={value} value={value}>
                          {value.replace("_", " ")}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="danger"
                      onClick={() =>
                        removeMember.mutate(member.id, {
                          onSuccess: () => toast.push({ message: "Member removed.", variant: "success" }),
                          onError: (error) => toast.push({ ...describeError(error), variant: "error" })
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                )
              }
            ]}
            rows={membersQuery.data ?? []}
          />
        )}
      </SectionCard>

      {debugToken ? (
        <SectionCard title="Latest invite token (local debug)">
          <p className="sp-muted">Share this with your invitee for them to accept the invitation:</p>
          <code style={{ wordBreak: "break-all" }}>{debugToken}</code>
        </SectionCard>
      ) : null}

      <Modal
        open={open}
        title="Invite member"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleInvite();
                setOpen(false);
              }}
              loading={createInvite.isPending}
              disabled={!email.trim()}
            >
              Send invite
            </Button>
          </>
        }
      >
        <FormField label="Email" htmlFor="invite-email">
          <TextField
            id="invite-email"
            type="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </FormField>
        <FormField label="Role" htmlFor="invite-role">
          <Select id="invite-role" value={role} onChange={(event) => setRole(event.target.value as OrganizationRole)}>
            {organizationRoles.map((value) => (
              <option key={value} value={value}>
                {value.replace("_", " ")}
              </option>
            ))}
          </Select>
        </FormField>
      </Modal>
    </div>
  );
}
