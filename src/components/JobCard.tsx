import { Link } from "@tanstack/react-router";
import { Download, Trash2, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { downloadWorkbook } from "@/lib/excel";
import { jobStore } from "@/lib/job-store";
import { toast } from "sonner";
import type { Job } from "@/lib/types";

export function JobCard({ job }: { job: Job }) {
  const download = async () => {
    try {
      await downloadWorkbook(job);
      toast.success("Excel report downloaded");
    } catch {
      toast.error("Could not build the Excel file for this job.");
    }
  };

  return (
    <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{job.section_name}</p>
          <StatusBadge status={job.status} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {new Date(job.created_at).toLocaleString()} · {job.activities.length} activities ·{" "}
          {job.studentsProcessed} student rows · {job.job_id.slice(0, 8)}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/progress/$jobId" params={{ jobId: job.job_id }}>
            <ScrollText className="size-4" />
            View log
          </Link>
        </Button>
        <Button size="sm" onClick={download} disabled={job.status !== "completed"}>
          <Download className="size-4" />
          Download
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            jobStore.remove(job.job_id);
            toast.success("Job deleted");
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
