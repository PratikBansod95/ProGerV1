import Link from "next/link";
import { cn } from "@/lib/utils";

interface ProjectTabsProps {
  projectId: string;
  active: "overview" | "tasks";
}

export function ProjectTabs({ projectId, active }: ProjectTabsProps) {
  const tabs = [
    { key: "overview" as const, label: "Overview", href: `/projects/${projectId}` },
    { key: "tasks" as const, label: "Tasks", href: `/projects/${projectId}/tasks` },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b pb-3">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active === tab.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          {tab.label}
        </Link>
      ))}
      <span className="rounded-md px-3 py-1.5 text-sm text-muted-foreground/60">
        Timeline (coming soon)
      </span>
      <span className="rounded-md px-3 py-1.5 text-sm text-muted-foreground/60">
        Stakeholder Report (coming soon)
      </span>
    </div>
  );
}
