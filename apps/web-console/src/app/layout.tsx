import { useMemo } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

import {
  AppShell,
  Breadcrumbs,
  Button,
  Nav,
  Select,
  type BreadcrumbItem,
  type NavItem
} from "@sourceplane/ui";

import { useSession } from "./providers.js";
import { useOrganizations } from "../features/orgs/hooks.js";
import { useProject } from "../features/projects/hooks.js";
import { useResolveSession } from "../features/auth/hooks.js";
import { useLogout } from "../features/auth/hooks.js";

interface PathParams {
  orgId?: string;
  projectId?: string;
}

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, setToken, activeOrgId, setActiveOrgId } = useSession();
  const params = useParams() as PathParams;
  const orgsQuery = useOrganizations();
  const sessionQuery = useResolveSession();
  const logout = useLogout();

  const effectiveOrgId = params.orgId ?? activeOrgId ?? null;
  const projectQuery = useProject(effectiveOrgId, params.projectId ?? null);

  const navItems = useMemo<NavItem[]>(() => {
    if (!effectiveOrgId) {
      return [{ key: "orgs", label: "Organizations", to: "/orgs", isActive: location.pathname.startsWith("/orgs") }];
    }
    const base = `/orgs/${effectiveOrgId}`;
    return [
      { key: "projects", label: "Projects", to: `${base}/projects`, isActive: location.pathname.startsWith(`${base}/projects`) },
      { key: "members", label: "Members", to: `${base}/members`, isActive: location.pathname === `${base}/members` },
      { key: "settings", label: "Settings", to: `${base}/settings`, isActive: location.pathname === `${base}/settings` },
      { key: "components", label: "Components", to: `${base}/components`, isActive: location.pathname === `${base}/components`, badge: "soon" },
      { key: "resources", label: "Resources", to: `${base}/resources`, isActive: location.pathname === `${base}/resources`, badge: "soon" },
      { key: "config", label: "Config & Secrets", to: `${base}/config`, isActive: location.pathname === `${base}/config`, badge: "soon" },
      { key: "audit", label: "Audit", to: `${base}/audit`, isActive: location.pathname === `${base}/audit`, badge: "soon" },
      { key: "usage", label: "Usage", to: `${base}/usage`, isActive: location.pathname === `${base}/usage`, badge: "soon" },
      { key: "billing", label: "Billing", to: `${base}/billing`, isActive: location.pathname === `${base}/billing`, badge: "soon" }
    ];
  }, [effectiveOrgId, location.pathname]);

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [{ key: "home", label: "Sourceplane", to: "/orgs" }];
    if (!effectiveOrgId) return items;
    const orgName = orgsQuery.data?.find((o) => o.id === effectiveOrgId)?.name ?? "Organization";
    items.push({ key: "org", label: orgName, to: `/orgs/${effectiveOrgId}/projects` });
    if (params.projectId) {
      const projectName = projectQuery.data?.name ?? "Project";
      items.push({
        key: "project",
        label: projectName,
        to: `/orgs/${effectiveOrgId}/projects/${params.projectId}`
      });
    }
    return items;
  }, [effectiveOrgId, orgsQuery.data, params.projectId, projectQuery.data]);

  const handleSwitchOrg = (next: string) => {
    setActiveOrgId(next || null);
    if (next) navigate(`/orgs/${next}/projects`);
  };

  if (!token) {
    return <Outlet />;
  }

  return (
    <AppShell
      eyebrow="Sourceplane"
      title="Control plane"
      nav={
        <Nav
          items={navItems}
          onNavigate={navigate}
          header={
            <div>
              <strong>{sessionQuery.data?.user?.primaryEmail ?? "Operator"}</strong>
              <div className="sp-muted" style={{ fontSize: "0.8rem" }}>
                {effectiveOrgId ?? "no org selected"}
              </div>
            </div>
          }
          footer={
            <Button variant="ghost" onClick={() => logout.mutate(undefined, { onSettled: () => setToken(null) })}>
              Sign out
            </Button>
          }
        />
      }
      topBar={
        <div className="sp-row" style={{ width: "100%", justifyContent: "space-between" }}>
          <Breadcrumbs items={breadcrumbs} onNavigate={navigate} />
          <div className="sp-row">
            <label htmlFor="org-switcher" className="sp-muted" style={{ fontSize: "0.85rem" }}>
              Org
            </label>
            <Select
              id="org-switcher"
              value={effectiveOrgId ?? ""}
              onChange={(event) => handleSwitchOrg(event.target.value)}
              aria-label="Switch organization"
            >
              <option value="">Select…</option>
              {(orgsQuery.data ?? []).map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
            <Link to="/orgs/new">
              <Button variant="secondary">New org</Button>
            </Link>
          </div>
        </div>
      }
    >
      <Outlet />
    </AppShell>
  );
}

export { NavLink };
