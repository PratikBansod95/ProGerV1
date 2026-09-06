import type { UserRole } from "@/types/database";

export const ROLE_HOME: Record<UserRole, string> = {
  admin: "/hub",
  pm: "/hub",
  team_member: "/bucket",
  stakeholder: "/stakeholder",
};

export function getRoleHome(role: UserRole): string {
  return ROLE_HOME[role];
}

export function canManageProjects(role: UserRole): boolean {
  return role === "admin" || role === "pm";
}

export function canManageAllProjects(role: UserRole): boolean {
  return role === "admin";
}

export function canEditTask(
  role: UserRole,
  userId: string,
  assigneeId: string | null,
  isProjectManager: boolean
): boolean {
  if (role === "admin" || isProjectManager) return true;
  if (role === "team_member") return assigneeId === userId;
  return false;
}

export function canDeleteTask(role: UserRole, isProjectManager: boolean): boolean {
  return role === "admin" || isProjectManager;
}

export function canAssignTasks(role: UserRole, isProjectManager: boolean): boolean {
  return role === "admin" || isProjectManager;
}
