import { publicRouteGroups } from "@sourceplane/contracts";
import { AppShell, SectionCard, StatusPill } from "@sourceplane/ui";

const implementationLanes = [
  "API edge remains the single public contract boundary.",
  "Bounded-context workers can land independently without reshaping the repo.",
  "Component-driven forms and richer control-plane flows belong in later tasks."
];

export function App() {
  return (
    <AppShell eyebrow="Sourceplane" title="Cloudflare-first control plane scaffold">
      <div className="console-grid">
        <SectionCard title="Current Surface">
          <p className="console-copy">
            This web console is intentionally thin. It demonstrates the monorepo, shared UI package,
            and public-contract-first direction without inventing domain workflows ahead of the API.
          </p>
          <div className="console-status-row">
            <span>Bootstrap status</span>
            <StatusPill phase="ready" />
          </div>
        </SectionCard>

        <SectionCard title="Contract-Driven Lanes">
          <ul className="console-list">
            {implementationLanes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Public Route Groups">
          <div className="console-pill-grid">
            {publicRouteGroups.map((group) => (
              <span className="console-route-pill" key={group}>
                {group}
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Next Operator Flow">
          <ol className="console-sequence">
            <li>Create or select an organization.</li>
            <li>Choose a project and environment scope.</li>
            <li>Pick a component definition and submit resource spec inputs.</li>
            <li>Track reconciliation, audit history, and billing implications through the public API.</li>
          </ol>
        </SectionCard>
      </div>
    </AppShell>
  );
}
