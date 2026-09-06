"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveProject, updateProject } from "@/lib/actions/projects";
import { HealthBadge } from "@/components/shared/health-badge";
import { ProjectTabs } from "@/components/projects/project-tabs";
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProjectMetrics, ProjectMember, Project, User } from "@/types/database";
import Link from "next/link";

interface ProjectOverviewProps {
  project: Project;
  metrics: ProjectMetrics;
  members: ProjectMember[];
  currentUser: User;
}

export function ProjectOverviewClient({
  project,
  metrics,
  members,
  currentUser,
}: ProjectOverviewProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleUpdate(formData: FormData) {
    startTransition(async () => {
      await updateProject(project.id, formData);
      setEditOpen(false);
      router.refresh();
    });
  }

  function handleArchive() {
    if (!confirm("Archive this project?")) return;
    startTransition(async () => {
      await archiveProject(project.id);
      router.push("/hub");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <HealthBadge health={metrics.health} />
          </div>
          {project.description && (
            <p className="max-w-2xl text-muted-foreground">{project.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              Edit project
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit project</DialogTitle>
              </DialogHeader>
              <form action={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" defaultValue={project.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={project.description ?? ""}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start date</Label>
                    <Input
                      id="start_date"
                      name="start_date"
                      type="date"
                      defaultValue={project.start_date ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">End date</Label>
                    <Input
                      id="end_date"
                      name="end_date"
                      type="date"
                      defaultValue={project.end_date ?? ""}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={isPending} className="w-full">
                  Save changes
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          {currentUser.role === "admin" && (
            <Button variant="destructive" onClick={handleArchive} disabled={isPending}>
              Archive
            </Button>
          )}
        </div>
      </div>

      <ProjectTabs projectId={project.id} active="overview" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{metrics.percentComplete}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Days remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {metrics.daysRemaining ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{metrics.openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Blocked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{metrics.blockedCount}</p>
          </CardContent>
        </Card>
      </div>

      {metrics.riskFlags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk flags</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {metrics.riskFlags.map((flag) => (
                <li key={flag.type}>
                  <Link
                    href={`/projects/${project.id}/tasks${flag.taskId ? `?highlight=${flag.taskId}` : ""}`}
                    className="text-sm text-destructive hover:underline"
                  >
                    {flag.message}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {members.map((m) => (
              <li key={m.id}>
                {m.user?.name ?? "Unknown"} — {m.role_in_project.replace("_", " ")}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
