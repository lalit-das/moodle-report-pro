import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Download, Loader2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { LogFeed } from "@/components/LogFeed";
import { ProgressRing } from "@/components/ProgressRing";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useJob } from "@/hooks/useJobPolling";
import { useExtraction } from "@/hooks/useExtraction";
import { downloadWorkbook } from "@/lib/excel";
import { jobStore } from "@/lib/job-store";

export const Route = createFileRoute("/progress/$jobId")({
  head: () => ({
    meta: [
      { title: "Extraction Progress | REVA VPL & Quiz Report Extractor" },
      {
        name: "description",
        content:
          "Live progress of a Moodle VPL and quiz extraction job with per-activity logs and Excel download.",
      },
      { property: "og:title", content: "Extraction progress" },
      {
        property: "og:description",
        content: "Watch activity-by-activity extraction progress and download the finished report.",
      },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const { jobId } = Route.useParams();
  const job = useJob(jobId);
  const { run } = useExtraction();
  const [resumeCookie, setResumeCookie] = useState("");
  const [busy, setBusy] = useState(false);

  if (!job) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  const { progress } = job;
  const activityPct = progress.total_activities
    ? (progress.current_activity / progress.total_activities) * 100
    : 0;
  const studentPct = progress.total_students
    ? (progress.current_student / progress.total_students) * 100
    : 0;

  const download = async () => {
    setBusy(true);
    try {
      await downloadWorkbook(job);
      toast.success("Excel report downloaded");
    } catch {
      toast.error("Could not build the Excel workbook.");
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    if (!resumeCookie.trim()) {
      toast.error("Paste a fresh MoodleSession cookie to resume.");
      return;
    }
    setBusy(true);
    try {
      await run(job.job_id, resumeCookie, { resume: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {job.section_name} extraction
            </h1>
            <p className="text-xs text-muted-foreground">Job ID {job.job_id}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={job.status} />
            {job.status === "running" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  jobStore.update(job.job_id, { status: "cancelled" });
                  toast.info("Cancelling after the current activity");
                }}
              >
                <XCircle className="size-4" />
                Cancel
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          <div className="surface-card grid place-items-center p-6">
            <ProgressRing
              percent={job.status === "completed" ? 100 : progress.percent}
              label={job.status === "completed" ? "Report ready" : "Overall"}
            />
          </div>

          <div className="surface-card space-y-5 p-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Current activity
              </p>
              <p className="text-lg font-semibold">
                {progress.activity_name || "Preparing…"}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Activities</span>
                <span className="tabular-nums text-muted-foreground">
                  {progress.current_activity}/{progress.total_activities}
                </span>
              </div>
              <Progress value={activityPct} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Students</span>
                <span className="tabular-nums text-muted-foreground">
                  {progress.current_student}/{progress.total_students || "—"}
                </span>
              </div>
              <Progress value={studentPct} />
            </div>

            {job.status === "completed" ? (
              <Button
                size="lg"
                onClick={() => void download()}
                disabled={busy}
                className="w-full bg-success text-success-foreground hover:bg-success/90"
              >
                {busy ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
                Download Excel report
              </Button>
            ) : null}

            {job.status === "failed" ? (
              <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/8 p-4">
                <p className="flex items-start gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {job.error}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="resume-cookie">Fresh MoodleSession cookie</Label>
                  <Input
                    id="resume-cookie"
                    type="password"
                    value={resumeCookie}
                    onChange={(e) => setResumeCookie(e.target.value)}
                    placeholder="Paste cookie to resume from checkpoint"
                  />
                </div>
                <Button onClick={() => void resume()} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                  Resume from checkpoint
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="surface-card space-y-3 p-6">
          <h2 className="text-sm font-semibold">Live log</h2>
          <LogFeed lines={progress.log} />
        </div>

        <Button asChild variant="ghost">
          <Link to="/jobs">Back to jobs history</Link>
        </Button>
      </div>
    </AppShell>
  );
}
