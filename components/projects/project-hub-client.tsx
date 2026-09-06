"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createProject } from "@/lib/actions/projects";
import { HealthBadge } from "@/components/shared/health-badge";
import { getMemberAvatars } from "@/lib/projects/metrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ProjectHealth, User } from "@/types/database";

interface HubProject {
  id: string;
  name: string;
  description: string | null;
  end_date: string | null;
  tasks: { status: string }[];
  members: Parameters<typeof getMemberAvatars>[0];
  metrics: {
    health: ProjectHealth;
    percentComplete: number;
    nextDeadline: string | null;
  };
}

interface ProjectHubProps {
  projects: HubProject[];
  users: User[];
}

export function ProjectHubClient({ projects, users }: ProjectHubProps) {
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("deadline");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    let result = [...projects];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    if (healthFilter !== "all") {
      result = result.filter((p) => p.metrics.health === healthFilter);
    }

    result.sort((a, b) => {
      if (sortBy === "health") {
        const order = { red: 0, amber: 1, green: 2 };
        return order[a.metrics.health] - order[b.metrics.health];
      }
      if (sortBy === "complete") {
        return b.metrics.percentComplete - a.metrics.percentComplete;
      }
      const aDate = a.end_date ?? a.metrics.nextDeadline ?? "9999";
      const bDate = b.end_date ?? b.metrics.nextDeadline ?? "9999";
      return aDate.localeCompare(bDate);
    });

    return result;
  }, [projects, search, healthFilter, sortBy]);

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      await createProject(formData);
      setOpen(false);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Project Hub</h1>
          <p className="text-sm text-muted-foreground">
            All active projects and their current health at a glance
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
            </DialogHeader>
            <form action={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start date</Label>
                  <Input id="start_date" name="start_date" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End date</Label>
                  <Input id="end_date" name="end_date" type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Team members</Label>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                  {users.map((user) => (
                    <label key={user.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="member_ids" value={user.id} />
                      {user.name} ({user.email})
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? "Creating..." : "Create project"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select
          value={healthFilter}
          onValueChange={(value) => value && setHealthFilter(value)}
        >
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All health</SelectItem>
            <SelectItem value="red">Red</SelectItem>
            <SelectItem value="amber">Amber</SelectItem>
            <SelectItem value="green">Green</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(value) => value && setSortBy(value)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="deadline">Deadline</SelectItem>
            <SelectItem value="health">Health</SelectItem>
            <SelectItem value="complete">% Complete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No projects found. Create your first project to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => {
            const avatars = getMemberAvatars(project.members);
            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <HealthBadge health={project.metrics.health} />
                    </div>
                    {project.description && (
                      <CardDescription className="line-clamp-2">
                        {project.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>{project.metrics.percentComplete}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${project.metrics.percentComplete}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Next deadline:{" "}
                        {project.metrics.nextDeadline ?? project.end_date ?? "—"}
                      </span>
                      <div className="flex -space-x-2">
                        {avatars.map((a) => (
                          <Avatar key={a.id} className="h-7 w-7 border-2 border-background">
                            <AvatarFallback className="text-[10px]">
                              {a.initials}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
