import { Navigate, useParams } from "react-router-dom";

export function ProjectIndexRoute() {
  const params = useParams<{ orgId: string; projectId: string }>();
  if (!params.orgId || !params.projectId) return <p>Missing context.</p>;
  return <Navigate to={`/orgs/${params.orgId}/projects/${params.projectId}/environments`} replace />;
}
