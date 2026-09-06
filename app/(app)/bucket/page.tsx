import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { fetchBucketTasks, fetchUserProjects } from "@/lib/data/queries";
import { BucketClient } from "@/components/bucket/bucket-client";

export default async function BucketPage() {
  const user = await requireUser();

  if (user.role === "stakeholder") {
    redirect("/stakeholder");
  }

  const [tasks, projects] = await Promise.all([
    fetchBucketTasks(),
    fetchUserProjects(),
  ]);

  return (
    <BucketClient
      tasks={tasks}
      projects={projects as { id: string; name: string }[]}
    />
  );
}
