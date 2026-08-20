export type ActivityType = "vpl" | "quiz";

export interface Activity {
  id: string;
  name: string;
  type: ActivityType;
}

export interface StudentInput {
  roll_no: string;
  name: string;
}

export interface VplAttempt {
  attemptNumber: number;
  submittedAt: string;
  description: string;
  grade: string;
  status: string;
  submissionUrl: string;
  submissionId: string;
}

export interface VplStudentResult {
  userId: string;
  moodleName: string;
  rollNo: string;
  studentName: string;
  attempts: VplAttempt[];
  finalGrade: string;
  latestSubmission: string;
}

export interface QuizStudentResult {
  userId: string;
  moodleName: string;
  rollNo: string;
  studentName: string;
  attemptNumber: string;
  startedAt: string;
  finishedAt: string;
  score: string;
  grade: string;
  state: string;
}

export interface ActivityResult {
  activity: Activity;
  vpl?: VplStudentResult[];
  quiz?: QuizStudentResult[];
  unmatched: { moodleName: string; userId: string }[];
}

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface JobProgress {
  current_activity: number;
  total_activities: number;
  current_student: number;
  total_students: number;
  activity_name: string;
  percent: number;
  log: string[];
}

export interface Job {
  job_id: string;
  created_at: string;
  updated_at: string;
  status: JobStatus;
  section_name: string;
  extraction_mode: 1 | 2;
  output_filename: string;
  moodle_url: string;
  activities: Activity[];
  students: StudentInput[];
  progress: JobProgress;
  error?: string | undefined;
  failedActivityId?: string | undefined;
  results: ActivityResult[];
  studentsProcessed: number;
  hasFile: boolean;
}
