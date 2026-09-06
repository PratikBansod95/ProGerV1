import { notFound } from "next/navigation";
import { fetchProjectDetail } from "@/lib/data/queries";
import { ProjectOverviewClient } from "@/components/projects/project-overview-client";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await fetchProjectDetail(id);

  if (!project) notFound();

  return (
    <ProjectOverviewClient
      project={project}
      metrics={project.metrics}
      members={project.members}
      currentUser={project.currentUser}
    />
  );
}
