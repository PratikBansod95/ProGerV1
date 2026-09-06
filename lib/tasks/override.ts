import type { ChecklistItem } from "@/types/database";

export function getUncheckedItems(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter((item) => !item.is_checked);
}

export function requiresOverride(
  status: string,
  items: ChecklistItem[]
): boolean {
  return status === "done" && getUncheckedItems(items).length > 0;
}
