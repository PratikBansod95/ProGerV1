import { fetchBucketTasks, fetchUserProjects } from "@/lib/data/queries";
import { BucketClient } from "@/components/bucket/bucket-client";

export default async function BucketPage() {
  const [tasks, projects] = await Promise.all([
    fetchBucketTasks(),
    fetchUserProjects(),
  ]);

  return <BucketClient tasks={tasks} projects={projects as { id: string; name: string }[]} />;
}
