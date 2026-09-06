import {
  computeDaysRemaining,
  computePercentComplete,
  computeProjectHealth,
  computeRiskFlags,
  getNextDeadline,
} from "@/lib/health/compute";
import type { Project, ProjectMember, ProjectMetrics, Task } from "@/types/database";

export function buildProjectMetrics(
  project: Project,
  tasks: Task[]
): ProjectMetrics {
  const activeTasks = tasks.filter((t) => t.status !== "done");
  return {
    health: computeProjectHealth(tasks),
    percentComplete: computePercentComplete(tasks),
    daysRemaining: computeDaysRemaining(project.end_date),
    openCount: tasks.filter(
      (t) => t.status === "todo" || t.status === "in_progress"
    ).length,
    blockedCount: tasks.filter((t) => t.status === "blocked").length,
    doneCount: tasks.filter((t) => t.status === "done").length,
    totalCount: tasks.length,
    riskFlags: computeRiskFlags(activeTasks),
    nextDeadline: getNextDeadline(tasks),
  };
}

export function getMemberAvatars(members: ProjectMember[]) {
  return members
    .filter((m) => m.user)
    .slice(0, 5)
    .map((m) => ({
      id: m.user_id,
      name: m.user!.name,
      initials: m.user!.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    }));
}
