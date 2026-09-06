import { requireRole } from "@/lib/auth/session";
import { fetchProjectsForHub } from "@/lib/data/queries";
import { getAllUsers } from "@/lib/actions/projects";
import { ProjectHubClient } from "@/components/projects/project-hub-client";

export default async function HubPage() {
  await requireRole(["admin", "pm"]);

  const [projects, users] = await Promise.all([
    fetchProjectsForHub(),
    getAllUsers(),
  ]);

  return <ProjectHubClient projects={projects} users={users} />;
}
