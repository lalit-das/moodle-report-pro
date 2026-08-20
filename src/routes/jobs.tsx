import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Trash2, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useJobs } from "@/hooks/useJobPolling";
import { downloadWorkbook } from "@/lib/excel";
import { jobStore } from "@/lib/job-store";
import type { Job } from "@/lib/types";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Jobs History | REVA VPL & Quiz Report Extractor" },
      {
        name: "description",
        content:
          "Filter past VPL and quiz extraction jobs by status, section and date, then re-download or delete reports.",
      },
      { property: "og:title", content: "Extraction jobs history" },
      {
        property: "og:description",
        content: "Every extraction job with status, activity counts and Excel downloads.",
      },
    ],
  }),
  component: JobsHistory,
});

function JobsHistory() {
  const jobs = useJobs();
  const [status, setStatus] = useState("all");
  const [section, setSection] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(
    () =>
      jobs.filter((job) => {
        if (status !== "all" && job.status !== status) return false;
        if (section && !job.section_name.toLowerCase().includes(section.toLowerCase())) return false;
        const created = new Date(job.created_at).getTime();
        if (from && created < new Date(from).getTime()) return false;
        if (to && created > new Date(to).getTime() + 86_400_000) return false;
        return true;
      }),
    [jobs, status, section, from, to],
  );

  const download = async (job: Job) => {
    try {
      await downloadWorkbook(job);
      toast.success("Excel report downloaded");
    } catch {
      toast.error("Could not build the Excel file for this job.");
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs history</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Jobs and their data are removed automatically after 24 hours.
          </p>
        </div>

        <div className="surface-card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-section">Section</Label>
            <Input
              id="filter-section"
              value={section}
              placeholder="CSE-A"
              onChange={(e) => setSection(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {selected.length > 0 ? (
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <p className="text-sm">{selected.length} selected</p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                jobStore.removeMany(selected);
                setSelected([]);
                toast.success("Selected jobs deleted");
              }}
            >
              <Trash2 className="size-4" />
              Delete selected
            </Button>
          </div>
        ) : null}

        <div className="surface-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Job ID</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Activities</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No jobs match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((job) => (
                  <TableRow key={job.job_id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.includes(job.job_id)}
                        onCheckedChange={(checked) =>
                          setSelected((prev) =>
                            checked ? [...prev, job.job_id] : prev.filter((id) => id !== job.job_id),
                          )
                        }
                        aria-label={`Select job ${job.job_id}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{job.job_id.slice(0, 8)}</TableCell>
                    <TableCell>{job.section_name}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(job.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {job.activities.length}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {job.studentsProcessed}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link to="/progress/$jobId" params={{ jobId: job.job_id }}>
                            <ScrollText className="size-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={job.status !== "completed"}
                          onClick={() => void download(job)}
                        >
                          <Download className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            jobStore.remove(job.job_id);
                            toast.success("Job deleted");
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
