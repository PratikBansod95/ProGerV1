export type UserRole = "admin" | "pm" | "team_member" | "stakeholder";
export type UserStatus = "active" | "inactive";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type ProjectHealth = "green" | "amber" | "red";
export type ProjectMemberRole = "pm" | "team_member" | "stakeholder";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  archived: boolean;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role_in_project: ProjectMemberRole;
  user?: User;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  task_type: string;
  last_activity_at: string;
  created_by: string | null;
  created_at: string;
  assignee?: User | null;
  project?: Project | null;
  checklist_items?: ChecklistItem[];
}

export interface ChecklistTemplate {
  id: string;
  task_type: string;
  label: string;
  sort_order: number;
}

export interface ChecklistItem {
  id: string;
  task_id: string;
  template_item_id: string | null;
  label: string;
  is_checked: boolean;
  sort_order: number;
}

export interface ChecklistOverride {
  id: string;
  task_id: string;
  checklist_item_id: string;
  user_id: string;
  reason: string;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  text: string;
  created_at: string;
  user?: User;
}

export interface ActivityLogEntry {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user?: User;
}

export interface TaskUserPriority {
  user_id: string;
  task_id: string;
  sort_order: number;
}

export interface ProjectWithTasks extends Project {
  tasks: Task[];
  members: ProjectMember[];
}

export interface RiskFlag {
  type: "overdue" | "stale" | "silent_blocker";
  message: string;
  taskId?: string;
  count?: number;
}

export interface ProjectMetrics {
  health: ProjectHealth;
  percentComplete: number;
  daysRemaining: number | null;
  openCount: number;
  blockedCount: number;
  doneCount: number;
  totalCount: number;
  riskFlags: RiskFlag[];
  nextDeadline: string | null;
}
