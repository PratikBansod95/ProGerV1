import { notFound } from "next/navigation";
import { fetchProjectDetail } from "@/lib/data/queries";
import { TasksViewClient } from "@/components/tasks/tasks-view-client";

export default async function ProjectTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ highlight?: string }>;
}) {
  const { id } = await params;
  const { highlight } = await searchParams;
  const project = await fetchProjectDetail(id);

  if (!project) notFound();

  return (
    <TasksViewClient
      project={project}
      tasks={project.tasks}
      members={project.members}
      currentUser={project.currentUser}
      highlightTaskId={highlight}
    />
  );
}
