"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ProjectMemberRole, TaskPriority, TaskStatus } from "@/types/database";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createProject(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;
  const startDate = (formData.get("start_date") as string) || null;
  const endDate = (formData.get("end_date") as string) || null;
  const memberIds = formData.getAll("member_ids") as string[];

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name,
      description,
      start_date: startDate,
      end_date: endDate,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const members = [
    { project_id: project.id, user_id: user.id, role_in_project: "pm" as ProjectMemberRole },
    ...memberIds
      .filter((id) => id !== user.id)
      .map((id) => ({
        project_id: project.id,
        user_id: id,
        role_in_project: "team_member" as ProjectMemberRole,
      })),
  ];

  await supabase.from("project_members").insert(members);

  revalidatePath("/hub");
  return project;
}

export async function updateProject(projectId: string, formData: FormData) {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .update({
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      start_date: (formData.get("start_date") as string) || null,
      end_date: (formData.get("end_date") as string) || null,
    })
    .eq("id", projectId);

  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/hub");
}

export async function archiveProject(projectId: string) {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .update({ archived: true })
    .eq("id", projectId);

  if (error) throw new Error(error.message);
  revalidatePath("/hub");
}

export async function createTask(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const projectId = formData.get("project_id") as string;
  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || null;
  const assigneeId = (formData.get("assignee_id") as string) || user.id;
  const priority = (formData.get("priority") as TaskPriority) || "medium";
  const dueDate = (formData.get("due_date") as string) || null;
  const taskType = (formData.get("task_type") as string) || "development";

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      project_id: projectId,
      title,
      description,
      assignee_id: assigneeId,
      priority,
      due_date: dueDate,
      task_type: taskType,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { data: templates } = await supabase
    .from("checklist_templates")
    .select("*")
    .eq("task_type", taskType)
    .order("sort_order");

  if (templates && templates.length > 0) {
    await supabase.from("checklist_items").insert(
      templates.map((t) => ({
        task_id: task.id,
        template_item_id: t.id,
        label: t.label,
        sort_order: t.sort_order,
      }))
    );
  }

  await supabase.from("activity_log").insert({
    task_id: task.id,
    user_id: user.id,
    action: "created",
    metadata: { title },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tasks`);
  revalidatePath("/bucket");
  revalidatePath("/hub");
  return task;
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  overrideReason?: string
) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("*, checklist_items(*)")
    .eq("id", taskId)
    .single();

  if (!task) throw new Error("Task not found");

  if (status === "done") {
    const unchecked = (task.checklist_items ?? []).filter(
      (item: { is_checked: boolean }) => !item.is_checked
    );

    if (unchecked.length > 0) {
      if (!overrideReason?.trim()) {
        throw new Error("OVERRIDE_REQUIRED");
      }

      for (const item of unchecked) {
        await supabase.from("checklist_overrides").insert({
          task_id: taskId,
          checklist_item_id: item.id,
          user_id: user.id,
          reason: overrideReason.trim(),
        });
      }

      await supabase.from("activity_log").insert({
        task_id: taskId,
        user_id: user.id,
        action: "checklist_override",
        metadata: {
          reason: overrideReason.trim(),
          items: unchecked.map((i: { label: string }) => i.label),
        },
      });
    }
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", taskId);

  if (error) throw new Error(error.message);

  await supabase.from("activity_log").insert({
    task_id: taskId,
    user_id: user.id,
    action: "status_changed",
    metadata: { from: task.status, to: status },
  });

  revalidatePath(`/projects/${task.project_id}`);
  revalidatePath(`/projects/${task.project_id}/tasks`);
  revalidatePath("/bucket");
  revalidatePath("/hub");
}

export async function updateTask(taskId: string, formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const status = formData.get("status") as TaskStatus;
  const overrideReason = (formData.get("override_reason") as string) || undefined;

  const { data: existing } = await supabase
    .from("tasks")
    .select("*, checklist_items(*)")
    .eq("id", taskId)
    .single();

  if (!existing) throw new Error("Task not found");

  if (status === "done" && status !== existing.status) {
    const unchecked = (existing.checklist_items ?? []).filter(
      (item: { is_checked: boolean }) => !item.is_checked
    );
    if (unchecked.length > 0 && !overrideReason?.trim()) {
      throw new Error("OVERRIDE_REQUIRED");
    }
    if (unchecked.length > 0 && overrideReason?.trim()) {
      for (const item of unchecked) {
        await supabase.from("checklist_overrides").insert({
          task_id: taskId,
          checklist_item_id: item.id,
          user_id: user.id,
          reason: overrideReason.trim(),
        });
      }
      await supabase.from("activity_log").insert({
        task_id: taskId,
        user_id: user.id,
        action: "checklist_override",
        metadata: {
          reason: overrideReason.trim(),
          items: unchecked.map((i: { label: string }) => i.label),
        },
      });
    }
  }

  const updates = {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || null,
    assignee_id: (formData.get("assignee_id") as string) || null,
    priority: formData.get("priority") as TaskPriority,
    due_date: (formData.get("due_date") as string) || null,
    status,
  };

  const { error } = await supabase.from("tasks").update(updates).eq("id", taskId);
  if (error) throw new Error(error.message);

  if (status !== existing.status) {
    await supabase.from("activity_log").insert({
      task_id: taskId,
      user_id: user.id,
      action: "status_changed",
      metadata: { from: existing.status, to: status },
    });
  }

  revalidatePath(`/projects/${existing.project_id}`);
  revalidatePath(`/projects/${existing.project_id}/tasks`);
  revalidatePath("/bucket");
  revalidatePath("/hub");
}

export async function deleteTask(taskId: string) {
  await requireUser();
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", taskId)
    .single();

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);

  if (task) {
    revalidatePath(`/projects/${task.project_id}`);
    revalidatePath(`/projects/${task.project_id}/tasks`);
  }
  revalidatePath("/bucket");
  revalidatePath("/hub");
}

export async function toggleChecklistItem(itemId: string, isChecked: boolean) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("checklist_items")
    .select("*, tasks(project_id)")
    .eq("id", itemId)
    .single();

  const { error } = await supabase
    .from("checklist_items")
    .update({ is_checked: isChecked })
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  if (item) {
    await supabase
      .from("tasks")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", item.task_id);

    await supabase.from("activity_log").insert({
      task_id: item.task_id,
      user_id: user.id,
      action: isChecked ? "checklist_checked" : "checklist_unchecked",
      metadata: { label: item.label },
    });

    const projectId = (item.tasks as { project_id: string })?.project_id;
    if (projectId) {
      revalidatePath(`/projects/${projectId}`);
      revalidatePath(`/projects/${projectId}/tasks`);
    }
    revalidatePath("/bucket");
  }
}

export async function addComment(taskId: string, text: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", taskId)
    .single();

  const { error } = await supabase.from("comments").insert({
    task_id: taskId,
    user_id: user.id,
    text,
  });

  if (error) throw new Error(error.message);

  await supabase
    .from("tasks")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", taskId);

  await supabase.from("activity_log").insert({
    task_id: taskId,
    user_id: user.id,
    action: "comment_added",
    metadata: { text },
  });

  if (task) {
    revalidatePath(`/projects/${task.project_id}/tasks`);
  }
  revalidatePath("/bucket");
}

export async function updateTaskPriorities(
  priorities: { taskId: string; sortOrder: number }[]
) {
  const user = await requireUser();
  const supabase = await createClient();

  for (const { taskId, sortOrder } of priorities) {
    await supabase.from("task_user_priority").upsert({
      user_id: user.id,
      task_id: taskId,
      sort_order: sortOrder,
    });
  }

  revalidatePath("/bucket");
}

export async function getAllUsers() {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("status", "active")
    .order("name");
  return data ?? [];
}
