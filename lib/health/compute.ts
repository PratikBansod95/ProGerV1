import type {
  ProjectHealth,
  RiskFlag,
  Task,
  TaskStatus,
} from "@/types/database";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STALE_HOURS = 48;
const SILENT_BLOCKER_DAYS = 3;

export function isOverdue(task: Pick<Task, "due_date" | "status">): boolean {
  if (!task.due_date || task.status === "done") return false;
  const due = new Date(task.due_date);
  const today = startOfDay(new Date());
  return due < today;
}

export function isStale(task: Pick<Task, "due_date" | "status">): boolean {
  if (!task.due_date || task.status !== "todo") return false;
  const due = new Date(task.due_date);
  const now = new Date();
  const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilDue >= 0 && hoursUntilDue <= STALE_HOURS;
}

export function isSilentBlocker(
  task: Pick<Task, "status" | "last_activity_at">
): boolean {
  if (task.status !== "blocked") return false;
  const lastActivity = new Date(task.last_activity_at);
  const daysSince =
    (Date.now() - lastActivity.getTime()) / MS_PER_DAY;
  return daysSince > SILENT_BLOCKER_DAYS;
}

export function computeTaskHealth(
  task: Pick<Task, "due_date" | "status" | "last_activity_at">
): ProjectHealth | null {
  if (task.status === "done") return null;
  if (isOverdue(task) || isSilentBlocker(task)) return "red";
  if (isStale(task)) return "amber";
  return "green";
}

export function computeProjectHealth(tasks: Task[]): ProjectHealth {
  const activeTasks = tasks.filter((t) => t.status !== "done");
  if (activeTasks.length === 0) return "green";

  const hasRed = activeTasks.some(
    (t) => isOverdue(t) || isSilentBlocker(t)
  );
  if (hasRed) return "red";

  const hasAmber = activeTasks.some((t) => isStale(t));
  if (hasAmber) return "amber";

  return "green";
}

export function computePercentComplete(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}

export function computeRiskFlags(tasks: Task[]): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const overdue = tasks.filter(isOverdue);
  const stale = tasks.filter(isStale);
  const silent = tasks.filter(isSilentBlocker);

  if (overdue.length > 0) {
    flags.push({
      type: "overdue",
      message: `${overdue.length} task${overdue.length === 1 ? "" : "s"} overdue`,
      count: overdue.length,
      taskId: overdue[0]?.id,
    });
  }

  if (stale.length > 0) {
    flags.push({
      type: "stale",
      message: `${stale.length} task${stale.length === 1 ? "" : "s"} due within 48 hours and still To Do`,
      count: stale.length,
      taskId: stale[0]?.id,
    });
  }

  if (silent.length > 0) {
    flags.push({
      type: "silent_blocker",
      message: `${silent.length} blocked task${silent.length === 1 ? "" : "s"} with no activity for 3+ days`,
      count: silent.length,
      taskId: silent[0]?.id,
    });
  }

  return flags;
}

export function getNextDeadline(tasks: Task[]): string | null {
  const upcoming = tasks
    .filter((t) => t.due_date && t.status !== "done")
    .map((t) => t.due_date!)
    .sort();
  return upcoming[0] ?? null;
}

export function computeDaysRemaining(endDate: string | null): number | null {
  if (!endDate) return null;
  const end = startOfDay(new Date(endDate));
  const today = startOfDay(new Date());
  return Math.ceil((end.getTime() - today.getTime()) / MS_PER_DAY);
}

export function healthLabel(health: ProjectHealth): string {
  return health.charAt(0).toUpperCase() + health.slice(1);
}

export function healthBadgeClass(health: ProjectHealth): string {
  switch (health) {
    case "red":
      return "bg-red-100 text-red-800 border-red-200";
    case "amber":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-green-100 text-green-800 border-green-200";
  }
}

export function statusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    blocked: "Blocked",
    done: "Done",
  };
  return labels[status];
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
