import type { PropsWithChildren } from "react";

import type { ResourcePhase } from "@sourceplane/contracts";

const phaseColors: Record<ResourcePhase, string> = {
  degraded: "#c46210",
  deleted: "#6d7485",
  deleting: "#a23e48",
  draft: "#6d7485",
  failed: "#a23e48",
  pending: "#d08c00",
  provisioning: "#0f766e",
  ready: "#1f7a1f"
};

export function AppShell({ children, eyebrow, title }: PropsWithChildren<{ eyebrow: string; title: string }>) {
  return (
    <main className="sp-shell">
      <div className="sp-shell__frame">
        <p className="sp-shell__eyebrow">{eyebrow}</p>
        <h1 className="sp-shell__title">{title}</h1>
        <div className="sp-shell__content">{children}</div>
      </div>
    </main>
  );
}

export function SectionCard({ children, title }: PropsWithChildren<{ title: string }>) {
  return (
    <section className="sp-card">
      <h2 className="sp-card__title">{title}</h2>
      {children}
    </section>
  );
}

export function StatusPill({ phase }: { phase: ResourcePhase }) {
  return (
    <span className="sp-pill" style={{ backgroundColor: phaseColors[phase] }}>
      {phase}
    </span>
  );
}
