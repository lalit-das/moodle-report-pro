import { createFileRoute, Link } from "@tanstack/react-router";
import { useHydrated } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Radio, Users, FileSpreadsheet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useJobs } from "@/hooks/useJobPolling";
import { FACULTY, facultyForSection, gradeValue } from "@/lib/faculty";
import type { Job } from "@/lib/types";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live Scores | REVA VPL & Quiz Report Extractor" },
      {
        name: "description",
        content:
          "Live dashboard of VPL and quiz scores per faculty and section, refreshing automatically as extractions run.",
      },
      { property: "og:title", content: "Live VPL & Quiz Scores by Faculty" },
      {
        property: "og:description",
        content:
          "Watch VPL attempts and quiz marks update in real time for every REVA section and its assigned faculty.",
      },
    ],
  }),
  component: LiveDashboard,
});

interface StudentRow {
  rollNo: string;
  studentName: string;
  scores: Record<string, number | null>;
  attempts: number;
}

interface SectionBoard {
  section: string;
  faculty: string;
  status: Job["status"];
  updatedAt: string;
  activities: string[];
  rows: StudentRow[];
}

function buildBoards(jobs: Job[]): SectionBoard[] {
  const bySection = new Map<string, Job>();
  for (const job of jobs) {
    const key = job.section_name.toUpperCase();
    const existing = bySection.get(key);
    if (!existing || new Date(job.updated_at) > new Date(existing.updated_at)) {
      bySection.set(key, job);
    }
  }

  return [...bySection.values()]
    .map((job) => {
      const activities: string[] = [];
      const students = new Map<string, StudentRow>();

      const ensure = (rollNo: string, studentName: string) => {
        const key = rollNo || studentName;
        let row = students.get(key);
        if (!row) {
          row = { rollNo, studentName, scores: {}, attempts: 0 };
          students.set(key, row);
        }
        return row;
      };

      for (const result of job.results) {
        const label = result.activity.name;
        if (!activities.includes(label)) activities.push(label);
        for (const s of result.vpl ?? []) {
          const row = ensure(s.rollNo, s.studentName);
          row.scores[label] = gradeValue(s.finalGrade);
          row.attempts += s.attempts.length;
        }
        for (const s of result.quiz ?? []) {
          const row = ensure(s.rollNo, s.studentName);
          const value = gradeValue(s.grade) ?? gradeValue(s.score);
          const prev = row.scores[label];
          row.scores[label] = prev == null ? value : Math.max(prev, value ?? prev);
          row.attempts += 1;
        }
      }

      return {
        section: job.section_name,
        faculty: facultyForSection(job.section_name),
        status: job.status,
        updatedAt: job.updated_at,
        activities,
        rows: [...students.values()].sort((a, b) =>
          (a.rollNo || a.studentName).localeCompare(b.rollNo || b.studentName),
        ),
      };
    })
    .filter((b) => b.rows.length > 0);
}

function average(row: StudentRow, activities: string[]) {
  const values = activities.map((a) => row.scores[a]).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return values.reduce((n, v) => n + v, 0) / values.length;
}

function LiveDashboard() {
  const jobs = useJobs();
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [faculty, setFaculty] = useState<string>("all");

  const boards = useMemo(() => buildBoards(jobs), [jobs]);

  const visible = boards.filter((b) => {
    if (faculty !== "all" && b.faculty !== faculty) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      b.section.toLowerCase().includes(q) ||
      b.faculty.toLowerCase().includes(q) ||
      b.rows.some(
        (r) =>
          r.studentName.toLowerCase().includes(q) || r.rollNo.toLowerCase().includes(q),
      )
    );
  });

  const totalStudents = visible.reduce((n, b) => n + b.rows.length, 0);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <section className="surface-card flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Radio className="size-5 text-primary" />
              Live scores
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              VPL and quiz marks refresh automatically while extractions run — grouped by faculty
              and section.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-primary" />
              {visible.length} sections
            </span>
            <span className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              {totalStudents} students
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search section, faculty, roll no or student name"
            className="sm:max-w-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={faculty === "all" ? "default" : "outline"}
              onClick={() => setFaculty("all")}
            >
              All faculty
            </Button>
            {FACULTY.map((f) => (
              <Button
                key={f.name}
                size="sm"
                variant={faculty === f.name ? "default" : "outline"}
                onClick={() => setFaculty(f.name)}
              >
                {f.name}
              </Button>
            ))}
          </div>
        </section>

        {!hydrated ? (
          <div className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : visible.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No live scores yet. Run an extraction and results will stream in here.
            </p>
            <Button asChild className="mt-4">
              <Link to="/new">Start an extraction</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {visible.map((board) => (
              <section key={board.section} className="surface-card overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                  <div>
                    <h2 className="text-lg font-semibold">{board.section}</h2>
                    <p className="text-sm text-muted-foreground">{board.faculty}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={board.status === "running" ? "default" : "secondary"}>
                      {board.status === "running" ? "Live" : board.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Updated {new Date(board.updatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </header>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Roll No</TableHead>
                        <TableHead>Student</TableHead>
                        {board.activities.map((a) => (
                          <TableHead key={a} className="text-right">
                            {a}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Attempts</TableHead>
                        <TableHead className="text-right">Average</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {board.rows.map((row) => {
                        const avg = average(row, board.activities);
                        return (
                          <TableRow key={row.rollNo || row.studentName}>
                            <TableCell className="font-medium tabular-nums">
                              {row.rollNo || "—"}
                            </TableCell>
                            <TableCell>{row.studentName}</TableCell>
                            {board.activities.map((a) => (
                              <TableCell key={a} className="text-right tabular-nums">
                                {row.scores[a] ?? "—"}
                              </TableCell>
                            ))}
                            <TableCell className="text-right tabular-nums">
                              {row.attempts}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {avg == null ? "—" : avg.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
