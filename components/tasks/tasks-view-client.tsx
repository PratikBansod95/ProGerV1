"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { updateTaskStatus } from "@/lib/actions/projects";
import { canEditTask } from "@/lib/auth/roles";
import { isOverdue, statusLabel } from "@/lib/health/compute";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { TaskDetailDrawer } from "@/components/tasks/task-detail-drawer";
import { OverrideModal } from "@/components/tasks/override-modal";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Project, ProjectMember, Task, TaskStatus, User } from "@/types/database";

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

interface TasksViewProps {
  project: Project;
  tasks: Task[];
  members: ProjectMember[];
  currentUser: User;
  highlightTaskId?: string;
}

function TaskCard({
  task,
  canEdit,
  onOpen,
}: {
  task: Task;
  canEdit: boolean;
  onOpen: () => void;
}) {
  const overdue = isOverdue(task);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: !canEdit });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={cn(
        "cursor-pointer rounded-lg border bg-background p-3 shadow-sm",
        overdue && "border-l-4 border-l-red-500",
        !canEdit && "cursor-default opacity-80"
      )}
      onClick={onOpen}
    >
      {canEdit && (
        <button
          className="mb-2 w-full text-left text-xs text-muted-foreground"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          Drag to move
        </button>
      )}
      <p className="font-medium">{task.title}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{task.assignee?.name ?? "Unassigned"}</span>
        <Badge variant="outline">{task.priority}</Badge>
      </div>
      {task.due_date && (
        <p className="mt-1 text-xs text-muted-foreground">Due {task.due_date}</p>
      )}
    </div>
  );
}

export function TasksViewClient({
  project,
  tasks: initialTasks,
  members,
  currentUser,
  highlightTaskId,
}: TasksViewProps) {
  const router = useRouter();
  const [view, setView] = useState<"board" | "table">("board");
  const [tasks, setTasks] = useState(initialTasks);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [overrideTaskId, setOverrideTaskId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const isProjectManager =
    currentUser.role === "admin" ||
    members.some(
      (m) => m.user_id === currentUser.id && m.role_in_project === "pm"
    );

  const filtered = tasks.filter((task) => {
    if (assigneeFilter !== "all" && task.assignee_id !== assigneeFilter) return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    return true;
  });

  function canEdit(task: Task) {
    return canEditTask(
      currentUser.role,
      currentUser.id,
      task.assignee_id,
      isProjectManager
    );
  }

  async function changeStatus(taskId: string, status: TaskStatus, reason?: string) {
    startTransition(async () => {
      try {
        await updateTaskStatus(taskId, status, reason);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status } : t))
        );
        setOverrideTaskId(null);
        setPendingStatus(null);
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
    setActiveId(null);
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !canEdit(task)) return;

    let newStatus: TaskStatus | null = null;
    if (COLUMNS.includes(over.id as TaskStatus)) {
      newStatus = over.id as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      newStatus = overTask?.status ?? null;
    }

    if (!newStatus || newStatus === task.status) return;
    changeStatus(taskId, newStatus);
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <ProjectTabs projectId={project.id} active="tasks" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={view === "board" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("board")}
          >
            Board
          </Button>
          <Button
            variant={view === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("table")}
          >
            Table
          </Button>
          <Select
            value={assigneeFilter}
            onValueChange={(value) => value && setAssigneeFilter(value)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.user?.name ?? m.user_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={priorityFilter}
            onValueChange={(value) => value && setPriorityFilter(value)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {view === "board" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e) => setActiveId(e.active.id as string)}
          onDragEnd={handleDragEnd}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((status) => {
              const columnTasks = filtered.filter((t) => t.status === status);
              return (
                <div
                  key={status}
                  id={status}
                  className="rounded-lg bg-muted/40 p-3"
                >
                  <h3 className="mb-3 text-sm font-medium">
                    {statusLabel(status)} ({columnTasks.length})
                  </h3>
                  <SortableContext
                    items={columnTasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2 min-h-[120px]">
                      {columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          canEdit={canEdit(task)}
                          onOpen={() => setSelectedTaskId(task.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className="rounded-lg border bg-background p-3 shadow-lg">
                {activeTask.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((task) => (
                <TableRow
                  key={task.id}
                  className={cn(
                    "cursor-pointer",
                    highlightTaskId === task.id && "bg-amber-50",
                    isOverdue(task) && "border-l-4 border-l-red-500"
                  )}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <TableCell>{task.title}</TableCell>
                  <TableCell>{task.assignee?.name ?? "—"}</TableCell>
                  <TableCell>{task.due_date ?? "—"}</TableCell>
                  <TableCell>{task.priority}</TableCell>
                  <TableCell>
                    {canEdit(task) ? (
                      <Select
                        value={task.status}
                        onValueChange={(v) => changeStatus(task.id, v as TaskStatus)}
                      >
                        <SelectTrigger className="w-36" onClick={(e) => e.stopPropagation()}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COLUMNS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {statusLabel(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      statusLabel(task.status)
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskDetailDrawer
        open={createOpen || !!selectedTaskId}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setSelectedTaskId(null);
          }
        }}
        taskId={selectedTaskId}
        projectId={project.id}
        members={members}
        currentUser={currentUser}
        isProjectManager={isProjectManager}
        mode={createOpen ? "create" : "edit"}
        onSaved={() => router.refresh()}
      />

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
            changeStatus(overrideTaskId, pendingStatus, reason);
          }
        }}
        isPending={isPending}
      />
    </div>
  );
}
