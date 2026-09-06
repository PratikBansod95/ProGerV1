import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { buildProjectMetrics } from "@/lib/projects/metrics";
import type { Project, ProjectMember, Task } from "@/types/database";

export async function fetchProjectsForHub() {
  const user = await requireUser();
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select(
      `
      *,
      tasks(*),
      project_members(*, user:users(*))
    `
    )
    .eq("archived", false)
    .order("end_date", { ascending: true, nullsFirst: false });

  if (user.role !== "admin") {
    const { data: memberships } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", user.id);

    const projectIds = memberships?.map((m) => m.project_id) ?? [];
    if (projectIds.length === 0) return [];
    query = query.in("id", projectIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((project) => {
    const tasks = (project.tasks ?? []) as Task[];
    const members = (project.project_members ?? []) as ProjectMember[];
    return {
      ...(project as Project),
      tasks,
      members,
      metrics: buildProjectMetrics(project as Project, tasks),
    };
  });
}

export async function fetchProjectDetail(projectId: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select(
      `
      *,
      tasks(*, assignee:users(*)),
      project_members(*, user:users(*))
    `
    )
    .eq("id", projectId)
    .single();

  if (error || !project) return null;

  const tasks = (project.tasks ?? []) as Task[];
  const members = (project.project_members ?? []) as ProjectMember[];

  return {
    ...(project as Project),
    tasks,
    members,
    metrics: buildProjectMetrics(project as Project, tasks),
    currentUser: user,
  };
}

export async function fetchBucketTasks() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: tasks, error }, { data: priorities }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        `
        *,
        assignee:users(*),
        project:projects(id, name)
      `
      )
      .eq("assignee_id", user.id)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("task_user_priority")
      .select("task_id, sort_order")
      .eq("user_id", user.id),
  ]);

  if (error) throw new Error(error.message);

  const priorityMap = new Map(
    (priorities ?? []).map((p) => [p.task_id, p.sort_order])
  );

  const sorted = [...(tasks ?? [])].sort((a, b) => {
    const aPriority = priorityMap.get(a.id);
    const bPriority = priorityMap.get(b.id);
    if (aPriority != null && bPriority != null) return aPriority - bPriority;
    if (aPriority != null) return -1;
    if (bPriority != null) return 1;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    return 0;
  });

  return sorted as Task[];
}

export async function fetchUserProjects() {
  const user = await requireUser();
  const supabase = await createClient();

  if (user.role === "admin") {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("archived", false)
      .order("name");
    return data ?? [];
  }

  const { data } = await supabase
    .from("project_members")
    .select("project:projects(id, name)")
    .eq("user_id", user.id);

  return (data ?? [])
    .map((m) => {
      const project = m.project as
        | { id: string; name: string }
        | { id: string; name: string }[]
        | null;
      if (Array.isArray(project)) return project[0] ?? null;
      return project;
    })
    .filter((p): p is { id: string; name: string } => p != null);
}

export async function fetchTaskDetail(taskId: string) {
  await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      *,
      assignee:users(*),
      project:projects(id, name),
      checklist_items(*),
      comments(*, user:users(*)),
      activity_log(*, user:users(*))
    `
    )
    .eq("id", taskId)
    .single();

  if (error) return null;
  return data;
}
