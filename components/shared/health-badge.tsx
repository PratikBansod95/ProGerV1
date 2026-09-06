import { cn } from "@/lib/utils";
import {
  healthBadgeClass,
  healthLabel,
} from "@/lib/health/compute";
import type { ProjectHealth } from "@/types/database";

interface HealthBadgeProps {
  health: ProjectHealth;
  className?: string;
}

export function HealthBadge({ health, className }: HealthBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        healthBadgeClass(health),
        className
      )}
    >
      {healthLabel(health)}
    </span>
  );
}
