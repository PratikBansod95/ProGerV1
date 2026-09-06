"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { updateTaskStatus, updateTaskPriorities, createTask } from "@/lib/actions/projects";
import { statusLabel } from "@/lib/health/compute";
import { OverrideModal } from "@/components/tasks/override-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types/database";

interface BucketClientProps {
  tasks: Task[];
  projects: { id: string; name: string }[];
}

function BucketTaskRow({
  task,
  onStatusChange,
}: {
  task: Task;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className="flex items-center gap-3 rounded-lg border bg-background p-4"
    >
      <button
        className="cursor-grab text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{task.title}</p>
        <p className="text-sm text-muted-foreground">
          {(task.project as { name?: string })?.name ?? "Project"} · Due{" "}
          {task.due_date ?? "—"}
        </p>
      </div>
      <Badge variant="outline">{task.priority}</Badge>
      <Select
        value={task.status}
        onValueChange={(v) => onStatusChange(task.id, v as TaskStatus)}
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(["todo", "in_progress", "blocked", "done"] as TaskStatus[]).map((s) => (
            <SelectItem key={s} value={s}>
              {statusLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function BucketClient({ tasks: initialTasks, projects }: BucketClientProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [projectFilter, setProjectFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createProjectId, setCreateProjectId] = useState(projects[0]?.id ?? "");
  const [overrideTaskId, setOverrideTaskId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const filtered =
    projectFilter === "all"
      ? tasks
      : tasks.filter((t) => t.project_id === projectFilter);

  function handleStatusChange(taskId: string, status: TaskStatus) {
    startTransition(async () => {
      try {
        await updateTaskStatus(taskId, status);
        if (status === "done") {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
        } else {
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status } : t))
          );
        }
        router.refresh();
      } catch (err) {
        if (err instanceof Error && err.message === "OVERRIDE_REQUIRED") {
          setOverrideTaskId(taskId);
          setPendingStatus(status);
        }
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filtered.findIndex((t) => t.id === active.id);
    const newIndex = filtered.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(filtered, oldIndex, newIndex);

    setTasks((prev) => {
      const others = prev.filter(
        (t) => !reordered.find((r) => r.id === t.id)
      );
      return [...reordered, ...others];
    });

    startTransition(async () => {
      await updateTaskPriorities(
        reordered.map((t, index) => ({ taskId: t.id, sortOrder: index }))
      );
    });
  }

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      await createTask(formData);
      setCreateOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Bucket</h1>
          <p className="text-sm text-muted-foreground">
            All your assigned tasks across projects
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add task
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add personal task</DialogTitle>
            </DialogHeader>
            <form action={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project_id">Project</Label>
                <Select
                  value={createProjectId}
                  onValueChange={(value) => value && setCreateProjectId(value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="project_id" value={createProjectId} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due date</Label>
                <Input id="due_date" name="due_date" type="date" />
              </div>
              <input type="hidden" name="priority" value="medium" />
              <input type="hidden" name="task_type" value="general" />
              <Button type="submit" disabled={isPending} className="w-full">
                Create task
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setProjectFilter("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-sm",
            projectFilter === "all" && "bg-primary text-primary-foreground"
          )}
        >
          All projects
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setProjectFilter(p.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              projectFilter === p.id && "bg-primary text-primary-foreground"
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border py-12 text-center text-muted-foreground">
          No tasks in your bucket. You&apos;re all caught up!
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filtered.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {filtered.map((task) => (
                <BucketTaskRow
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <OverrideModal
        open={!!overrideTaskId}
        onOpenChange={(open) => {
          if (!open) {
            setOverrideTaskId(null);
            setPendingStatus(null);
          }
        }}
        onConfirm={(reason) => {
          if (overrideTaskId && pendingStatus) {
            startTransition(async () => {
              await updateTaskStatus(overrideTaskId, pendingStatus, reason);
              setTasks((prev) => prev.filter((t) => t.id !== overrideTaskId));
              setOverrideTaskId(null);
              setPendingStatus(null);
              router.refresh();
            });
          }
        }}
        isPending={isPending}
      />
    </div>
  );
}
