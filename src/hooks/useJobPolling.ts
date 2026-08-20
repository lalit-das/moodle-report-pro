import { useEffect, useState } from "react";
import { jobStore } from "@/lib/job-store";
import type { Job } from "@/lib/types";

/** Subscribes to the job store and re-reads every 1s while a job is active. */
export function useJob(jobId: string | undefined) {
  const [job, setJob] = useState<Job | undefined>(undefined);

  useEffect(() => {
    if (!jobId) return;
    const sync = () => setJob(jobStore.get(jobId));
    sync();
    const unsubscribe = jobStore.subscribe(sync);
    const timer = window.setInterval(sync, 1000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [jobId]);

  return job;
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    const sync = () => setJobs(jobStore.list());
    sync();
    const unsubscribe = jobStore.subscribe(sync);
    const timer = window.setInterval(sync, 2000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  return jobs;
}
