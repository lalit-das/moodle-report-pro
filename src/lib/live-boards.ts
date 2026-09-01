import { facultyForSection, gradeValue } from "./faculty";
import type { Job } from "./types";

export interface StudentRow {
  rollNo: string;
  studentName: string;
  scores: Record<string, number | null>;
  attempts: number;
}

export interface SectionBoard {
  section: string;
  faculty: string;
  status: Job["status"];
  updatedAt: string;
  activities: string[];
  rows: StudentRow[];
}

/** Collapses jobs into one live board per section (latest job wins). */
export function buildBoards(jobs: Job[]): SectionBoard[] {
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

export function average(row: StudentRow, activities: string[]) {
  const values = activities.map((a) => row.scores[a]).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return values.reduce((n, v) => n + v, 0) / values.length;
}
