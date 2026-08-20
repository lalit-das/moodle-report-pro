import type { Job } from "./types";

const KEY = "reva-extractor-jobs";
const PRESET_KEY = "reva-extractor-presets";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const listeners = new Set<() => void>();

function read(): Job[] {
  if (typeof window === "undefined") return [];
  try {
    const jobs = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as Job[];
    const now = Date.now();
    const fresh = jobs.filter((j) => now - new Date(j.created_at).getTime() < MAX_AGE_MS);
    if (fresh.length !== jobs.length) write(fresh);
    return fresh;
  } catch {
    return [];
  }
}

function write(jobs: Job[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(jobs.slice(0, 60)));
  listeners.forEach((l) => l());
}

export const jobStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    if (typeof window !== "undefined") window.addEventListener("storage", listener);
    return () => {
      listeners.delete(listener);
      if (typeof window !== "undefined") window.removeEventListener("storage", listener);
    };
  },
  list(): Job[] {
    return read().sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  },
  get(id: string): Job | undefined {
    return read().find((j) => j.job_id === id);
  },
  save(job: Job) {
    const jobs = read().filter((j) => j.job_id !== job.job_id);
    write([{ ...job, updated_at: new Date().toISOString() }, ...jobs]);
  },
  update(id: string, patch: Partial<Job>) {
    const job = this.get(id);
    if (!job) return;
    this.save({ ...job, ...patch });
  },
  remove(id: string) {
    write(read().filter((j) => j.job_id !== id));
    if (typeof window !== "undefined") window.localStorage.removeItem(`${KEY}:file:${id}`);
  },
  removeMany(ids: string[]) {
    write(read().filter((j) => !ids.includes(j.job_id)));
  },
  activeCount() {
    return read().filter((j) => j.status === "running" || j.status === "queued").length;
  },
};

export interface SectionPreset {
  section: string;
  students: { roll_no: string; name: string }[];
}

export const presetStore = {
  all(): SectionPreset[] {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem(PRESET_KEY) ?? "[]") as SectionPreset[];
    } catch {
      return [];
    }
  },
  get(section: string) {
    return this.all().find((p) => p.section.toUpperCase() === section.toUpperCase());
  },
  save(preset: SectionPreset) {
    if (typeof window === "undefined") return;
    const rest = this.all().filter(
      (p) => p.section.toUpperCase() !== preset.section.toUpperCase(),
    );
    window.localStorage.setItem(PRESET_KEY, JSON.stringify([preset, ...rest]));
  },
};
