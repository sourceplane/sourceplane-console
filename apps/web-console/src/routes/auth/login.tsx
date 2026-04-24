import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button, FormField, SectionCard, TextField, useToast } from "@sourceplane/ui";

import { useLoginComplete, useLoginStart } from "../../features/auth/hooks.js";
import { useSession } from "../../app/providers.js";
import { describeError } from "../../lib/errors.js";

export function LoginRoute() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const loginStart = useLoginStart();
  const loginComplete = useLoginComplete();
  const { setToken } = useSession();
  const toast = useToast();
  const navigate = useNavigate();

  const handleStart = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginStart.mutate(email, {
      onSuccess: (response) => {
        setChallengeId(response.challengeId);
        if (response.delivery.mode === "local_debug") {
          setDebugCode(response.delivery.code);
          setCode(response.delivery.code);
          toast.push({ message: "Local debug code surfaced.", detail: response.delivery.code, variant: "info" });
        } else {
          toast.push({ message: "Check your email for the login code.", detail: response.delivery.emailHint, variant: "info" });
        }
      },
      onError: (error) => toast.push({ ...describeError(error), variant: "error" })
    });
  };

  const handleComplete = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challengeId) return;
    loginComplete.mutate(
      { challengeId, code },
      {
        onSuccess: (response) => {
          setToken(response.session.token);
          toast.push({ message: "Signed in.", variant: "success" });
          navigate("/orgs", { replace: true });
        },
        onError: (error) => toast.push({ ...describeError(error), variant: "error" })
      }
    );
  };

  return (
    <main className="sp-shell">
      <div className="sp-shell__frame" style={{ maxWidth: 480 }}>
        <p className="sp-shell__eyebrow">Sourceplane</p>
        <h1 className="sp-shell__title">Sign in</h1>
        <SectionCard title={challengeId ? "Enter your code" : "Request a magic link"}>
          {!challengeId ? (
            <form onSubmit={handleStart} noValidate>
              <FormField label="Email" htmlFor="login-email">
                <TextField
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </FormField>
              <Button type="submit" loading={loginStart.isPending}>
                Send code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleComplete} noValidate>
              <FormField
                label="One-time code"
                htmlFor="login-code"
                hint={debugCode ? `Local debug code: ${debugCode}` : "We sent a code to your email."}
              >
                <TextField
                  id="login-code"
                  name="code"
                  inputMode="numeric"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </FormField>
              <div className="sp-row">
                <Button type="submit" loading={loginComplete.isPending}>
                  Verify
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setChallengeId(null);
                    setDebugCode(null);
                    setCode("");
                  }}
                >
                  Use a different email
                </Button>
              </div>
            </form>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
