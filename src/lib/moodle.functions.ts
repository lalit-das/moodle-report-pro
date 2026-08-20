import { createServerFn } from "@tanstack/react-start";
import {
  discoverCourseActivities,
  fetchActivityName,
  fetchQuizResults,
  fetchStudentName,
  fetchVplAttempts,
  fetchVplSubmissionGrade,
  fetchVplSubmissionList,
  validateSession,
} from "./moodle.server";

const message = (e: unknown) =>
  e instanceof Error ? e.message : "Could not reach the Moodle server.";

export const validateCookie = createServerFn({ method: "POST" })
  .inputValidator((input: { moodle_url: string; session_cookie: string }) => input)
  .handler(async ({ data }) => {
    try {
      return await validateSession(data.moodle_url, data.session_cookie);
    } catch (e) {
      return { valid: false as const, username: null, message: message(e) };
    }
  });

export const discoverActivities = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { moodle_url: string; session_cookie: string; course_id: string }) => input,
  )
  .handler(async ({ data }) => {
    try {
      const found = await discoverCourseActivities(
        data.moodle_url,
        data.session_cookie,
        data.course_id,
      );
      return { ...found, error: null as string | null };
    } catch (e) {
      return { vpl_activities: [], quiz_activities: [], error: message(e) };
    }
  });

export const fetchNames = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      moodle_url: string;
      session_cookie: string;
      items: { id: string; type: "vpl" | "quiz" }[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const names: { id: string; type: "vpl" | "quiz"; name: string }[] = [];
    for (const item of data.items) {
      try {
        const name = await fetchActivityName(
          data.moodle_url,
          data.session_cookie,
          item.type,
          item.id,
        );
        names.push({ ...item, name });
      } catch {
        names.push({ ...item, name: `${item.type.toUpperCase()} ${item.id}` });
      }
    }
    return { names };
  });

export const scrapeVplActivity = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      moodle_url: string;
      session_cookie: string;
      activity_id: string;
      user_ids?: string[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const list = await fetchVplSubmissionList(
      data.moodle_url,
      data.session_cookie,
      data.activity_id,
    );
    const filtered = data.user_ids?.length
      ? list.filter((s) => data.user_ids!.includes(s.userId))
      : list;

    const rows = [] as {
      userId: string;
      moodleName: string;
      grade: string;
      latestSubmission: string;
      attempts: Awaited<ReturnType<typeof fetchVplAttempts>>;
    }[];

    for (const student of filtered) {
      let attempts: Awaited<ReturnType<typeof fetchVplAttempts>> = [];
      try {
        attempts = await fetchVplAttempts(
          data.moodle_url,
          data.session_cookie,
          data.activity_id,
          student.userId,
        );
        // Popup list often omits the grade — read it from the submission page.
        for (const attempt of attempts) {
          if ((!attempt.grade || !/\d/.test(attempt.grade)) && attempt.submissionUrl) {
            try {
              const fallback = await fetchVplSubmissionGrade(
                data.moodle_url,
                data.session_cookie,
                attempt.submissionUrl,
              );
              if (fallback) {
                attempt.grade = fallback;
                if (!attempt.status || attempt.status === "Submitted") attempt.status = "Graded";
              }
            } catch {
              /* keep the attempt without a grade */
            }
          }
        }
      } catch {
        attempts = [];
      }
      let moodleName = student.moodleName;
      if (!moodleName || /^\d+$/.test(moodleName)) {
        moodleName =
          (await fetchStudentName(data.moodle_url, data.session_cookie, student.userId)) ||
          moodleName;
      }
      rows.push({ ...student, moodleName, attempts });
    }
    return { rows };
  });


export const scrapeQuizActivity = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { moodle_url: string; session_cookie: string; activity_id: string }) => input,
  )
  .handler(async ({ data }) => {
    const rows = await fetchQuizResults(
      data.moodle_url,
      data.session_cookie,
      data.activity_id,
    );
    return { rows };
  });
