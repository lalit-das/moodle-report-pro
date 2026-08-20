import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/types";

const styles: Record<JobStatus, string> = {
  running: "bg-info text-info-foreground animate-pulse-ring",
  completed: "bg-success text-success-foreground",
  failed: "bg-destructive text-destructive-foreground",
  queued: "bg-warning text-warning-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const labels: Record<JobStatus, string> = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  queued: "Queued",
  cancelled: "Cancelled",
};

export function StatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        styles[status],
        className,
      )}
    >
      {labels[status]}
    </span>
  );
}
