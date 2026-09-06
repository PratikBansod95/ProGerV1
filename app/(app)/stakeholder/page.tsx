import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function StakeholderPage() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Stakeholder View</CardTitle>
          <CardDescription>
            The stakeholder-facing project summary is coming in a post-MVP release.
            Contact your project manager for updates in the meantime.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This view will show plain-English project status, health badges, and
          milestone timelines — generated automatically from live task data.
        </CardContent>
      </Card>
    </div>
  );
}
