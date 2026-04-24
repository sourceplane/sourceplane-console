import { EmptyState, SectionCard } from "@sourceplane/ui";

interface PlaceholderProps {
  title: string;
  description: string;
  taskNumber: number;
  spec: string;
}

export function Placeholder({ title, description, taskNumber, spec }: PlaceholderProps) {
  return (
    <SectionCard title={title}>
      <EmptyState
        title={`${title} — coming soon`}
        description={`${description} Planned for Task ${String(taskNumber)}.`}
        reference={{
          label: spec,
          href: `https://github.com/sourceplane/sourceplane-console/blob/main/specs/components/${spec}`
        }}
      />
    </SectionCard>
  );
}

export function ComponentsPlaceholder() {
  return (
    <Placeholder
      title="Components catalog"
      description="Browse component manifests and inputs once the components/resources workers ship."
      taskNumber={6}
      spec="06-resources-and-component-registry.md"
    />
  );
}

export function ResourcesPlaceholder() {
  return (
    <Placeholder
      title="Resources"
      description="Provision and inspect resources rendered from component manifests."
      taskNumber={6}
      spec="06-resources-and-component-registry.md"
    />
  );
}

export function ConfigPlaceholder() {
  return (
    <Placeholder
      title="Config & secrets"
      description="Manage layered configuration and secret metadata across environments."
      taskNumber={9}
      spec="09-config-and-secrets.md"
    />
  );
}

export function AuditPlaceholder() {
  return (
    <Placeholder
      title="Audit"
      description="Stream audit log events emitted by every bounded-context worker."
      taskNumber={11}
      spec="11-events-and-audit.md"
    />
  );
}

export function UsagePlaceholder() {
  return (
    <Placeholder
      title="Usage"
      description="Aggregate metering totals once the metering worker is live."
      taskNumber={13}
      spec="13-metering-and-usage.md"
    />
  );
}

export function BillingPlaceholder() {
  return (
    <Placeholder
      title="Billing"
      description="View invoices and plan summaries once the billing worker is live."
      taskNumber={14}
      spec="14-billing-and-plans.md"
    />
  );
}
