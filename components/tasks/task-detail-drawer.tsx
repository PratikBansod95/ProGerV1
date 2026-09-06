"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import {
  createTask,
  updateTask,
  deleteTask,
  toggleChecklistItem,
  addComment,
} from "@/lib/actions/projects";
import { canAssignTasks, canDeleteTask } from "@/lib/auth/roles";
import { statusLabel } from "@/lib/health/compute";
import { createClient } from "@/lib/supabase/client";
import { OverrideModal } from "@/components/tasks/override-modal";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type {
  ActivityLogEntry,
  ChecklistItem,
  Comment,
  ProjectMember,
  Task,
  TaskPriority,
  TaskStatus,
  User,
} from "@/types/database";

interface TaskDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string | null;
  projectId: string;
  members: ProjectMember[];
  currentUser: User;
  isProjectManager: boolean;
  mode: "create" | "edit";
  onSaved: () => void;
}

export function TaskDetailDrawer({
  open,
  onOpenChange,
  taskId,
  projectId,
  members,
  currentUser,
  isProjectManager,
  mode,
  onSaved,
}: TaskDetailDrawerProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [taskType, setTaskType] = useState("development");
  const [commentText, setCommentText] = useState("");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    if (mode === "create") {
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setDueDate("");
      setAssigneeId(currentUser.id);
      setTaskType("development");
      setChecklist([]);
      setComments([]);
      setActivity([]);
      setTask(null);
      return;
    }

    if (!taskId) return;

    async function loadTask() {
      const supabase = createClient();
      const { data } = await supabase
        .from("tasks")
        .select(
          `
          *,
          checklist_items(*),
          comments(*, user:users(*)),
          activity_log(*, user:users(*))
        `
        )
        .eq("id", taskId)
        .single();

      if (data) {
        setTask(data as Task);
        setTitle(data.title);
        setDescription(data.description ?? "");
        setStatus(data.status);
        setPriority(data.priority);
        setDueDate(data.due_date ?? "");
        setAssigneeId(data.assignee_id ?? "");
        setTaskType(data.task_type);
        setChecklist((data.checklist_items ?? []) as ChecklistItem[]);
        setComments((data.comments ?? []) as Comment[]);
        setActivity(
          ((data.activity_log ?? []) as ActivityLogEntry[]).sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        );
      }
    }

    loadTask();
  }, [open, taskId, mode, currentUser.id]);

  function handleStatusChange(newStatus: TaskStatus) {
    const unchecked = checklist.filter((i) => !i.is_checked);
    if (newStatus === "done" && unchecked.length > 0) {
      setPendingStatus(newStatus);
      setOverrideOpen(true);
      return;
    }
    setStatus(newStatus);
  }

  function handleSave(overrideReason?: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("description", description);
      formData.set("status", pendingStatus ?? status);
      formData.set("priority", priority);
      formData.set("due_date", dueDate);
      formData.set("assignee_id", assigneeId);
      if (overrideReason) formData.set("override_reason", overrideReason);

      try {
        if (mode === "create") {
          formData.set("project_id", projectId);
          formData.set("task_type", taskType);
          await createTask(formData);
        } else if (taskId) {
          await updateTask(taskId, formData);
        }
        setOverrideOpen(false);
        setPendingStatus(null);
        onOpenChange(false);
        onSaved();
      } catch (err) {
        if (err instanceof Error && err.message === "OVERRIDE_REQUIRED") {
          setPendingStatus("done");
          setOverrideOpen(true);
        }
      }
    });
  }

  function handleDelete() {
    if (!taskId || !confirm("Delete this task?")) return;
    startTransition(async () => {
      await deleteTask(taskId);
      onOpenChange(false);
      onSaved();
    });
  }

  function handleToggleChecklist(itemId: string, checked: boolean) {
    startTransition(async () => {
      await toggleChecklistItem(itemId, checked);
      setChecklist((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, is_checked: checked } : i))
      );
    });
  }

  function handleAddComment() {
    if (!taskId || !commentText.trim()) return;
    startTransition(async () => {
      await addComment(taskId, commentText.trim());
      setCommentText("");
      const supabase = createClient();
      const { data } = await supabase
        .from("comments")
        .select("*, user:users(*)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      setComments((data ?? []) as Comment[]);
    });
  }

  const canAssign = canAssignTasks(currentUser.role, isProjectManager);
  const canDelete = canDeleteTask(currentUser.role, isProjectManager);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{mode === "create" ? "New task" : "Task detail"}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-desc">Description</Label>
              <Textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["todo", "in_progress", "blocked", "done"] as TaskStatus[]).map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {statusLabel(s)}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as TaskPriority)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due-date">Due date</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              {mode === "create" && (
                <div className="space-y-2">
                  <Label>Task type</Label>
                  <Select
                    value={taskType}
                    onValueChange={(value) => value && setTaskType(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {canAssign && (
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select
                  value={assigneeId}
                  onValueChange={(value) => value && setAssigneeId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.user?.name ?? m.user_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode === "edit" && checklist.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Definition of Done</Label>
                  <div className="space-y-2">
                    {checklist
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={item.is_checked}
                            onCheckedChange={(checked) =>
                              handleToggleChecklist(item.id, !!checked)
                            }
                          />
                          {item.label}
                        </label>
                      ))}
                  </div>
                </div>
              </>
            )}

            {mode === "edit" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="comment">Add comment</Label>
                  <Textarea
                    id="comment"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={2}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddComment}
                    disabled={!commentText.trim() || isPending}
                  >
                    Post comment
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Activity log</Label>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                    {activity.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No activity yet.</p>
                    ) : (
                      activity.map((entry) => (
                        <div key={entry.id} className="text-sm">
                          <span className="font-medium">
                            {entry.user?.name ?? "User"}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            {entry.action.replace(/_/g, " ")} ·{" "}
                            {format(new Date(entry.created_at), "MMM d, h:mm a")}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={() => handleSave()} disabled={!title.trim() || isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
              {canDelete && mode === "edit" && (
                <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
                  Delete
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <OverrideModal
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        onConfirm={(reason) => {
          if (pendingStatus) setStatus(pendingStatus);
          handleSave(reason);
        }}
        isPending={isPending}
      />
    </>
  );
}
