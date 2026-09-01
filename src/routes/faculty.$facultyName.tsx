import { createFileRoute, Link, useHydrated } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Radio, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SectionBoard } from "@/components/SectionBoard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useJobs } from "@/hooks/useJobPolling";
import { FACULTY } from "@/lib/faculty";
import { buildBoards } from "@/lib/live-boards";

export const Route = createFileRoute("/faculty/$facultyName")({
  head: () => ({
    meta: [
      { title: "Faculty Live Scores | REVA VPL & Quiz Report Extractor" },
      {
        name: "description",
        content:
          "Live VPL and quiz scores for a single faculty member's own sections and students, refreshing automatically.",
      },
      { property: "og:title", content: "Faculty Live Scores — REVA Report Extractor" },
      {
        property: "og:description",
        content: "A faculty-scoped dashboard showing only their own class sections and students.",
      },
    ],
  }),
  component: FacultyDashboard,
});

function FacultyDashboard() {
  const { facultyName } = Route.useParams();
  const name = decodeURIComponent(facultyName);
  const jobs = useJobs();
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");

  const profile = FACULTY.find((f) => f.name.toLowerCase() === name.toLowerCase());
  const boards = useMemo(
    () => buildBoards(jobs).filter((b) => b.faculty.toLowerCase() === name.toLowerCase()),
    [jobs, name],
  );

  const filtered = boards
    .map((b) => {
      const q = query.trim().toLowerCase();
      if (!q) return b;
      return {
        ...b,
        rows: b.rows.filter(
          (r) =>
            r.studentName.toLowerCase().includes(q) || r.rollNo.toLowerCase().includes(q),
        ),
      };
    })
    .filter((b) => b.rows.length > 0);

  const totalStudents = filtered.reduce((n, b) => n + b.rows.length, 0);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <section className="surface-card flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
              <Link to="/faculty">
                <ArrowLeft className="size-4" />
                All faculty
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">{profile?.name ?? name}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(profile?.sections ?? boards.map((b) => b.section)).map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Radio className="size-4 text-primary" />
              {filtered.length} live sections
            </span>
            <span className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              {totalStudents} students
            </span>
          </div>
        </section>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a roll no or student name in your sections"
          className="sm:max-w-sm"
        />

        {!hydrated ? (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No extracted scores for these sections yet.
            </p>
            <Button asChild className="mt-4">
              <Link to="/new">Start an extraction</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {filtered.map((board) => (
              <SectionBoard key={board.section} board={board} showFaculty={false} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
