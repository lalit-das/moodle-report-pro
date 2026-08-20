import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { scrapeQuizActivity, scrapeVplActivity } from "@/lib/moodle.functions";
import { jobStore } from "@/lib/job-store";
import { extractRollNo, matchStudent } from "@/lib/fuzzy";
import type { Activity, ActivityResult, Job, StudentInput } from "@/lib/types";

export const MAX_CONCURRENT_JOBS = 3;

export interface ExtractionConfig {
  moodle_url: string;
  session_cookie: string;
  section_name: string;
  extraction_mode: 1 | 2;
  activities: Activity[];
  students: StudentInput[];
  output_filename: string;
}

const stamp = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function log(jobId: string, line: string) {
  const job = jobStore.get(jobId);
  if (!job) return;
  jobStore.save({
    ...job,
    progress: { ...job.progress, log: [...job.progress.log, `[${stamp()}] ${line}`].slice(-400) },
  });
}

export function createJob(config: ExtractionConfig): Job {
  const job: Job = {
    job_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "queued",
    section_name: config.section_name,
    extraction_mode: config.extraction_mode,
    output_filename: config.output_filename,
    moodle_url: config.moodle_url,
    activities: config.activities,
    students: config.students,
    progress: {
      current_activity: 0,
      total_activities: config.activities.length,
      current_student: 0,
      total_students: config.extraction_mode === 1 ? config.students.length : 0,
      activity_name: "",
      percent: 0,
      log: [`[${stamp()}] Job queued for ${config.section_name}`],
    },
    results: [],
    studentsProcessed: 0,
    hasFile: false,
  };
  jobStore.save(job);
  return job;
}

export function useExtraction() {
  const runVpl = useServerFn(scrapeVplActivity);
  const runQuiz = useServerFn(scrapeQuizActivity);

  const run = useCallback(
    async (jobId: string, cookie: string, opts?: { resume?: boolean }) => {
      const start = jobStore.get(jobId);
      if (!start) throw new Error("Job not found");

      const activities = start.activities;
      const students = start.students;
      const filtered = start.extraction_mode === 1 && students.length > 0;
      const results: ActivityResult[] = opts?.resume ? [...start.results] : [];
      const doneIds = new Set(results.map((r) => r.activity.id + r.activity.type));

      jobStore.save({
        ...start,
        status: "running",
        error: undefined,
        failedActivityId: undefined,
        results,
      });
      log(jobId, opts?.resume ? "Resuming from checkpoint" : "Extraction started");

      let processed = start.studentsProcessed;

      for (let i = 0; i < activities.length; i++) {
        const activity = activities[i]!;
        const current = jobStore.get(jobId);
        if (!current || current.status === "cancelled") {
          log(jobId, "Cancelled by user");
          return;
        }
        if (doneIds.has(activity.id + activity.type)) continue;

        jobStore.update(jobId, {
          progress: {
            ...current.progress,
            current_activity: i + 1,
            total_activities: activities.length,
            activity_name: activity.name,
            current_student: 0,
            percent: Math.round((i / activities.length) * 100),
          },
        });

        try {
          if (activity.type === "vpl") {
            const { rows } = await runVpl({
              data: {
                moodle_url: start.moodle_url,
                session_cookie: cookie,
                activity_id: activity.id,
              },
            });

            const unmatched: ActivityResult["unmatched"] = [];
            const vpl = rows.map((row, idx) => {
              const match = filtered ? matchStudent(row.moodleName, students) : { student: null, score: 0 };
              if (filtered && !match.student) unmatched.push({ moodleName: row.moodleName, userId: row.userId });
              const attempts = row.attempts;
              const p = jobStore.get(jobId);
              if (p && (idx % 20 === 0 || idx === rows.length - 1)) {
                jobStore.save({
                  ...p,
                  progress: {
                    ...p.progress,
                    current_student: idx + 1,
                    total_students: rows.length,
                  },
                });
              }
              return {
                userId: row.userId,
                moodleName: row.moodleName,
                rollNo: match.student?.roll_no ?? extractRollNo(row.moodleName),
                studentName: match.student?.name ?? row.moodleName,
                attempts,
                finalGrade: row.grade || attempts[attempts.length - 1]?.grade || "",
                latestSubmission: row.latestSubmission,
              };
            });

            const kept = filtered
              ? vpl.filter((s) => students.some((st) => st.roll_no === s.rollNo))
              : vpl;
            processed += kept.length;
            results.push({ activity, vpl: kept, unmatched });
            log(jobId, `${activity.name} done — ${kept.length} students, ${kept.reduce((n, s) => n + s.attempts.length, 0)} attempts`);
          } else {
            const { rows } = await runQuiz({
              data: {
                moodle_url: start.moodle_url,
                session_cookie: cookie,
                activity_id: activity.id,
              },
            });
            const unmatched: ActivityResult["unmatched"] = [];
            const quiz = rows.map((row) => {
              const match = filtered ? matchStudent(row.moodleName, students) : { student: null, score: 0 };
              if (filtered && !match.student) unmatched.push({ moodleName: row.moodleName, userId: row.userId });
              return {
                ...row,
                rollNo: match.student?.roll_no ?? extractRollNo(row.moodleName),
                studentName: match.student?.name ?? row.moodleName,
              };
            });
            const kept = filtered
              ? quiz.filter((s) => students.some((st) => st.roll_no === s.rollNo))
              : quiz;
            processed += kept.length;
            results.push({ activity, quiz: kept, unmatched });
            log(jobId, `${activity.name} (quiz) done — ${kept.length} attempts`);
          }

          jobStore.update(jobId, {
            results: [...results],
            studentsProcessed: processed,
          });
        } catch (e) {
          const messageText = e instanceof Error ? e.message : "Unknown extraction error";
          const failing = jobStore.get(jobId);
          jobStore.save({
            ...failing!,
            status: "failed",
            error: `${activity.name}: ${messageText}`,
            failedActivityId: activity.id,
            results: [...results],
            studentsProcessed: processed,
          });
          log(jobId, `FAILED on ${activity.name}: ${messageText}`);
          return;
        }
      }

      const final = jobStore.get(jobId);
      jobStore.save({
        ...final!,
        status: "completed",
        results: [...results],
        studentsProcessed: processed,
        hasFile: true,
        progress: {
          ...final!.progress,
          percent: 100,
          current_activity: activities.length,
        },
      });
      log(jobId, "Extraction completed — report ready to download");
    },
    [runVpl, runQuiz],
  );

  return { run, createJob };
}
