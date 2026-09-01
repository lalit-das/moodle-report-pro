import { createFileRoute, Link } from "@tanstack/react-router";
import { useHydrated } from "@tanstack/react-router";
import { ArrowRight, GraduationCap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { useJobs } from "@/hooks/useJobPolling";
import { FACULTY } from "@/lib/faculty";
import { buildBoards } from "@/lib/live-boards";

export const Route = createFileRoute("/faculty/")({
  head: () => ({
    meta: [
      { title: "Faculty Dashboards | REVA VPL & Quiz Report Extractor" },
      {
        name: "description",
        content:
          "Pick a faculty member to open their own dashboard with live VPL and quiz scores for only their allotted sections.",
      },
      { property: "og:title", content: "Faculty Dashboards — REVA Report Extractor" },
      {
        property: "og:description",
        content: "Per-faculty live score dashboards scoped to their own class sections.",
      },
    ],
  }),
  component: FacultyIndex,
});

function FacultyIndex() {
  const jobs = useJobs();
  const hydrated = useHydrated();
  const boards = buildBoards(jobs);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <section className="surface-card p-6">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <GraduationCap className="size-5 text-primary" />
            Faculty dashboards
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each faculty member gets a dashboard limited to their own sections and students.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FACULTY.map((f) => {
            const mine = boards.filter((b) => b.faculty === f.name);
            const students = mine.reduce((n, b) => n + b.rows.length, 0);
            return (
              <Link
                key={f.name}
                to="/faculty/$facultyName"
                params={{ facultyName: encodeURIComponent(f.name) }}
                className="surface-card flex flex-col gap-3 p-5 transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold leading-tight">{f.name}</h2>
                  <ArrowRight className="size-4 text-primary" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {f.sections.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {hydrated
                    ? `${mine.length} live section${mine.length === 1 ? "" : "s"} · ${students} students`
                    : "Loading live data…"}
                </p>
              </Link>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
