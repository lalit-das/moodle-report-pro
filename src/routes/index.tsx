import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, FileSpreadsheet, PlayCircle, Users, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { JobCard } from "@/components/JobCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useJobs } from "@/hooks/useJobPolling";
import { useHydrated } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard | REVA VPL & Quiz Report Extractor" },
      {
        name: "description",
        content:
          "Track VPL and quiz extraction jobs, monitor progress and download styled Excel reports for every REVA class section.",
      },
      { property: "og:title", content: "REVA VPL & Quiz Report Extractor — Dashboard" },
      {
        property: "og:description",
        content:
          "Extract Moodle VPL submissions and quiz results into styled Excel reports, section by section.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const jobs = useJobs();
  const hydrated = useHydrated();

  const stats = [
    { label: "Total Jobs", value: jobs.length, icon: Briefcase },
    {
      label: "Active Jobs",
      value: jobs.filter((j) => j.status === "running" || j.status === "queued").length,
      icon: PlayCircle,
    },
    {
      label: "Reports Generated",
      value: jobs.filter((j) => j.status === "completed").length,
      icon: FileSpreadsheet,
    },
    {
      label: "Students Processed",
      value: jobs.reduce((n, j) => n + j.studentsProcessed, 0),
      icon: Users,
    },
  ];

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <section className="surface-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Extraction dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pull VPL attempts, grades and quiz results from Moodle, then export a fully formatted
              workbook.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/new">
              Quick Start
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="surface-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <stat.icon className="size-5 text-primary" />
              </div>
              {hydrated ? (
                <p className="mt-2 text-3xl font-bold tabular-nums">{stat.value}</p>
              ) : (
                <Skeleton className="mt-3 h-8 w-16" />
              )}
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent jobs</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/jobs">View all</Link>
            </Button>
          </div>
          {!hydrated ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="surface-card p-10 text-center">
              <p className="text-sm text-muted-foreground">
                No extractions yet. Start with your Moodle session cookie and a course ID.
              </p>
              <Button asChild className="mt-4">
                <Link to="/new">Start first extraction</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.slice(0, 5).map((job) => (
                <JobCard key={job.job_id} job={job} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
