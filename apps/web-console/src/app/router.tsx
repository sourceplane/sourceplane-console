import { Navigate, Outlet, createBrowserRouter, useLocation } from "react-router-dom";

import { useSession } from "./providers.js";
import { AppLayout } from "./layout.js";
import { LoginRoute } from "../routes/auth/login.js";
import { AcceptInviteRoute } from "../routes/invites/accept.js";
import { OrgsIndexRoute } from "../routes/orgs/index.js";
import { OrgMembersRoute } from "../routes/orgs/members.js";
import { OrgProjectsRoute } from "../routes/orgs/projects.js";
import { OrgSettingsRoute } from "../routes/orgs/settings.js";
import { ProjectIndexRoute } from "../routes/orgs/project-index.js";
import { ProjectEnvironmentsRoute } from "../routes/orgs/project-environments.js";
import { ProjectSettingsRoute } from "../routes/orgs/project-settings.js";
import {
  AuditPlaceholder,
  BillingPlaceholder,
  ComponentsPlaceholder,
  ConfigPlaceholder,
  ResourcesPlaceholder,
  UsagePlaceholder
} from "../routes/placeholders/index.js";

function RequireAuth() {
  const { token } = useSession();
  const location = useLocation();
  if (!token) {
    const search = new URLSearchParams({ next: `${location.pathname}${location.search}` }).toString();
    return <Navigate to={`/login?${search}`} replace />;
  }
  return <Outlet />;
}

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  { path: "/login", element: <LoginRoute /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <Navigate to="/orgs" replace /> },
          { path: "/orgs", element: <OrgsIndexRoute /> },
          { path: "/orgs/new", element: <OrgsIndexRoute /> },
          { path: "/invites/:inviteId", element: <AcceptInviteRoute /> },
          { path: "/orgs/:orgId", element: <Navigate to="projects" replace /> },
          { path: "/orgs/:orgId/projects", element: <OrgProjectsRoute /> },
          { path: "/orgs/:orgId/members", element: <OrgMembersRoute /> },
          { path: "/orgs/:orgId/settings", element: <OrgSettingsRoute /> },
          { path: "/orgs/:orgId/components", element: <ComponentsPlaceholder /> },
          { path: "/orgs/:orgId/resources", element: <ResourcesPlaceholder /> },
          { path: "/orgs/:orgId/config", element: <ConfigPlaceholder /> },
          { path: "/orgs/:orgId/audit", element: <AuditPlaceholder /> },
          { path: "/orgs/:orgId/usage", element: <UsagePlaceholder /> },
          { path: "/orgs/:orgId/billing", element: <BillingPlaceholder /> },
          { path: "/orgs/:orgId/projects/:projectId", element: <ProjectIndexRoute /> },
          {
            path: "/orgs/:orgId/projects/:projectId/environments",
            element: <ProjectEnvironmentsRoute />
          },
          { path: "/orgs/:orgId/projects/:projectId/settings", element: <ProjectSettingsRoute /> },
          { path: "*", element: <Navigate to="/orgs" replace /> }
        ]
      }
    ]
  }
]);
