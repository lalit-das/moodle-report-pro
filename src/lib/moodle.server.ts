import type {
  Activity,
  QuizStudentResult,
  VplAttempt,
  VplStudentResult,
} from "./types";

/** Fetch a Moodle page authenticated with a MoodleSession cookie. */
export async function moodleFetch(
  baseUrl: string,
  path: string,
  cookie: string,
): Promise<string> {
  const root = baseUrl.replace(/\/+$/, "");
  const url = path.startsWith("http") ? path : `${root}${path}`;
  const value = cookie.includes("=") ? cookie.trim() : `MoodleSession=${cookie.trim()}`;

  const res = await fetch(url, {
    headers: {
      Cookie: value,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(
      `Moodle returned HTTP ${res.status} for ${url.replace(/(cookie|token)=[^&]+/gi, "$1=***")}`,
    );
  }
  return await res.text();
}

const stripTags = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

function isLoginPage(html: string) {
  return (
    /id="login"|loginform|You are not logged in|Log in to the site/i.test(html) &&
    !/logout\.php/i.test(html)
  );
}

/** Validate the session cookie and return the logged-in display name. */
export async function validateSession(baseUrl: string, cookie: string) {
  const html = await moodleFetch(baseUrl, "/my/", cookie);
  if (isLoginPage(html)) {
    return { valid: false as const, username: null, message: "Session cookie is invalid or expired." };
  }
  const patterns = [
    /<span[^>]*class="[^"]*usertext[^"]*"[^>]*>([^<]+)</i,
    /<a[^>]*href="[^"]*\/user\/profile\.php[^"]*"[^>]*>([^<]+)</i,
    /"fullname"\s*:\s*"([^"]+)"/i,
    /<title>([^<]+)<\/title>/i,
  ];
  let username: string | null = null;
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) {
      username = stripTags(m[1]);
      break;
    }
  }
  return { valid: true as const, username, message: "Session is active." };
}

/** Discover VPL + Quiz activities in a course. */
export async function discoverCourseActivities(
  baseUrl: string,
  cookie: string,
  courseId: string,
) {
  const html = await moodleFetch(baseUrl, `/course/view.php?id=${encodeURIComponent(courseId)}`, cookie);
  if (isLoginPage(html)) throw new Error("Session cookie is invalid or expired.");

  const vpl: Activity[] = [];
  const quiz: Activity[] = [];
  const seen = new Set<string>();

  const linkRe = /<a[^>]+href="[^"]*\/mod\/(vpl|quiz)\/view\.php\?id=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    const type = m[1]!.toLowerCase() as "vpl" | "quiz";
    const id = m[2]!;
    const key = `${type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const inner = m[3]!;
    const nameMatch = inner.match(/class="[^"]*instancename[^"]*"[^>]*>([\s\S]*?)</i);
    const name = stripTags(nameMatch?.[1] ?? inner)
      .replace(/\s*(VPL|Quiz)$/i, "")
      .trim();
    const activity: Activity = { id, name: name || `${type.toUpperCase()} ${id}`, type };
    (type === "vpl" ? vpl : quiz).push(activity);
  }
  return { vpl_activities: vpl, quiz_activities: quiz };
}

/** Fetch a single activity's display name. */
export async function fetchActivityName(
  baseUrl: string,
  cookie: string,
  type: "vpl" | "quiz",
  id: string,
): Promise<string> {
  const html = await moodleFetch(baseUrl, `/mod/${type}/view.php?id=${encodeURIComponent(id)}`, cookie);
  const h = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) ?? html.match(/<title>([^<]+)<\/title>/i);
  const raw = stripTags(h?.[1] ?? "");
  const name = raw.split("|")[0]!.trim();
  return name || `${type.toUpperCase()} ${id}`;
}

interface RawRow {
  userId: string;
  name: string;
  cells: string[];
  headerCells: string[];
  html: string;
}

/** Split HTML tables into rows of plain-text cells, keeping any userid found. */
function parseTableRows(html: string): RawRow[] {
  const rows: RawRow[] = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  let t: RegExpExecArray | null;
  const tables: string[] = [];
  while ((t = tableRe.exec(html))) tables.push(t[0]);
  if (!tables.length) tables.push(html);

  for (const table of tables) {
    const rowRe = /<tr[\s\S]*?<\/tr>/gi;
    let r: RegExpExecArray | null;
    let headers: string[] = [];
    while ((r = rowRe.exec(table))) {
      const rowHtml = r[0];
      const cells: string[] = [];
      const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let c: RegExpExecArray | null;
      while ((c = cellRe.exec(rowHtml))) cells.push(stripTags(c[1]!));
      if (!cells.length) continue;
      if (!headers.length) {
        headers = cells;
        // A header-looking first row is not a data row.
        if (/<th[\s>]/i.test(rowHtml)) continue;
      }
      const userId =
        rowHtml.match(/userid=(\d+)/i)?.[1] ??
        rowHtml.match(/\/user\/view\.php\?id=(\d+)/i)?.[1] ??
        "";
      const nameFromLink = rowHtml.match(
        /<a[^>]+href="[^"]*(?:\/user\/view\.php|userid=)[^"]*"[^>]*>([^<]+)</i,
      )?.[1];
      const name = stripTags(nameFromLink ?? cells[0] ?? "");
      rows.push({ userId, name, cells, headerCells: headers, html: rowHtml });
    }
  }
  return rows;
}

const DATE_RE =
  /\b\d{1,2}\s+\w+\s+\d{4}[,\s]*\d{1,2}:\d{2}(:\d{2})?(\s*[AP]M)?\b|\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}[,\s]*\d{1,2}:\d{2}\b/i;
const GRADE_RE = /(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*(\d+(?:\.\d+)?)|^\s*(\d+(?:\.\d+)?)\s*$/;

/** Pick a cell by header name, mirroring the reference script's `pick()`. */
function pickByHeader(row: RawRow, ...candidates: string[]): string {
  const map = new Map<string, string>();
  row.headerCells.forEach((h, i) => map.set(h.toLowerCase().trim(), row.cells[i] ?? ""));
  for (const key of candidates) {
    const hit = map.get(key.toLowerCase());
    if (hit) return hit;
  }
  for (const key of candidates) {
    for (const [hk, hv] of map) {
      if (hk.includes(key.toLowerCase()) && !hk.includes("name") && hv) return hv;
    }
  }
  return "";
}

function pickGrade(cells: string[]): string {
  for (let i = cells.length - 1; i >= 0; i--) {
    const cell = cells[i];
    if (!cell || DATE_RE.test(cell)) continue;
    const m = cell.match(GRADE_RE);
    if (m) return (m[0] ?? "").trim();
  }
  return "";
}


/** Students appearing in a VPL submissions list (mirrors the "Show all" URL). */
export async function fetchVplSubmissionList(
  baseUrl: string,
  cookie: string,
  activityId: string,
) {
  const id = encodeURIComponent(activityId);
  const listUrl = (perPage: number, page?: number) =>
    `/mod/vpl/views/submissionslist.php?id=${id}&showgrades=0&group=-1` +
    `&tilast&tifirst&tperpage=${perPage}&thiddenfields` +
    (page === undefined ? "" : `&tpage=${page}`);

  const html = await moodleFetch(baseUrl, listUrl(5000), cookie);
  if (isLoginPage(html)) throw new Error("Session cookie is invalid or expired.");

  const out: { userId: string; moodleName: string; grade: string; latestSubmission: string }[] = [];
  const seen = new Set<string>();
  const collect = (pageHtml: string) => {
    let added = 0;
    for (const row of parseTableRows(pageHtml)) {
      if (!row.userId || !row.name) continue;
      if (seen.has(row.userId)) continue;
      seen.add(row.userId);
      added++;
      out.push({
        userId: row.userId,
        moodleName: row.name,
        grade: pickGrade(row.cells),
        latestSubmission: row.cells.find((c) => DATE_RE.test(c))?.match(DATE_RE)?.[0] ?? "",
      });
    }
    return added;
  };
  collect(html);

  // Fallback: the list is still paginated, so walk the pages.
  if (out.length < 50) {
    for (let page = 0; page < 40; page++) {
      const pageHtml = await moodleFetch(baseUrl, listUrl(100, page), cookie);
      if (collect(pageHtml) === 0) break;
    }
  }
  return out;
}

/** All attempts of one student on one VPL activity (popup previous-submissions list). */
export async function fetchVplAttempts(
  baseUrl: string,
  cookie: string,
  activityId: string,
  userId: string,
): Promise<VplAttempt[]> {
  const root = baseUrl.replace(/\/+$/, "");
  const html = await moodleFetch(
    baseUrl,
    `/mod/vpl/views/previoussubmissionslist.php?id=${encodeURIComponent(activityId)}` +
      `&userid=${encodeURIComponent(userId)}&inpopup=1`,
    cookie,
  );

  const attempts: VplAttempt[] = [];
  const subIds = new Set<string>();
  for (const row of parseTableRows(html)) {
    const text = row.cells.join(" | ");
    const href = row.html.match(
      /href="([^"]*(?:submissionview|submissionid)[^"]*)"/i,
    )?.[1];
    const linkUrl = href
      ? href.startsWith("http")
        ? href.replace(/&amp;/g, "&")
        : `${root}${href.replace(/&amp;/g, "&")}`
      : "";
    const subId =
      (linkUrl.match(/submissionid=(\d+)/i)?.[1] ?? linkUrl.match(/subid=(\d+)/i)?.[1]) ??
      text.match(/subid=(\d+)/i)?.[1] ??
      "";
    const date = pickByHeader(row, "date", "submission date", "time") || text.match(DATE_RE)?.[0] || "";
    if (!date) continue;
    const key = subId || `${activityId}-${attempts.length + 1}`;
    if (subIds.has(key)) continue;
    subIds.add(key);

    let grade = pickByHeader(row, "grade", "mark", "score", "result");
    if (!grade || !/\d/.test(grade)) grade = pickGrade(row.cells);

    attempts.push({
      attemptNumber: 0,
      submittedAt: date.match(DATE_RE)?.[0] ?? date,
      description:
        pickByHeader(row, "description", "desc", "file") ||
        row.cells.find((c) => c && !DATE_RE.test(c) && !/^\d+$/.test(c) && c.length > 2) ||
        "",
      grade,
      status:
        pickByHeader(row, "status", "state") ||
        (/not graded|no grade/i.test(text) ? "Not graded" : grade ? "Graded" : "Submitted"),
      submissionUrl:
        linkUrl ||
        `${root}/mod/vpl/views/submissionview.php?id=${activityId}&userid=${userId}&subid=${subId}`,
      submissionId: subId,
    });
  }

  // Fall back to raw subid links when the table shape is unexpected.
  if (!attempts.length) {
    const linkRe = /sub(?:mission)?id=(\d+)/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html))) {
      if (subIds.has(m[1]!)) continue;
      subIds.add(m[1]!);
      attempts.push({
        attemptNumber: 0,
        submittedAt: "",
        description: "",
        grade: "",
        status: "Submitted",
        submissionUrl: `${root}/mod/vpl/views/submissionview.php?id=${activityId}&userid=${userId}&subid=${m[1]!}`,
        submissionId: m[1]!,
      });
    }
  }

  // No rows at all: record why, like the reference script does.
  if (!attempts.length) {
    const text = stripTags(html).toLowerCase();
    const status = /no submission|no attempt/.test(text)
      ? "No submissions"
      : /log in/.test(text)
        ? "Not accessible"
        : "No data";
    return [
      {
        attemptNumber: 0,
        submittedAt: "",
        description: "",
        grade: "",
        status,
        submissionUrl: "",
        submissionId: "",
      },
    ];
  }

  attempts.reverse();
  attempts.forEach((a, i) => (a.attemptNumber = i + 1));
  return attempts;
}


/** Grade shown on a single submission view page. */
export async function fetchVplSubmissionGrade(
  baseUrl: string,
  cookie: string,
  activityId: string,
  userId: string,
  subId: string,
): Promise<string> {
  const html = await moodleFetch(
    baseUrl,
    `/mod/vpl/views/submissionview.php?id=${activityId}&userid=${userId}&subid=${subId}`,
    cookie,
  );
  const text = stripTags(html);
  const m =
    text.match(/Grade\s*:?\s*(\d+(?:\.\d+)?\s*(?:\/\s*\d+(?:\.\d+)?)?)/i) ??
    text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  return (m?.[1] ?? "").trim();
}

/** Quiz attempts from the overview report. */
export async function fetchQuizResults(
  baseUrl: string,
  cookie: string,
  activityId: string,
): Promise<Omit<QuizStudentResult, "rollNo" | "studentName">[]> {
  const html = await moodleFetch(
    baseUrl,
    `/mod/quiz/report.php?id=${encodeURIComponent(activityId)}&mode=overview&attempts=enrolled_with&onlygraded=&pagesize=1000`,
    cookie,
  );
  if (isLoginPage(html)) throw new Error("Session cookie is invalid or expired.");

  const out: Omit<QuizStudentResult, "rollNo" | "studentName">[] = [];
  for (const row of parseTableRows(html)) {
    if (!row.userId || !row.name) continue;
    const dates = row.cells.filter((c) => DATE_RE.test(c)).map((c) => c.match(DATE_RE)![0]);
    const state =
      row.cells.find((c) => /finished|in progress|overdue|abandoned|never submitted/i.test(c)) ?? "";
    const score = pickGrade(row.cells);
    out.push({
      userId: row.userId,
      moodleName: row.name,
      attemptNumber: row.cells.find((c) => /^\d{1,2}$/.test(c)) ?? "1",
      startedAt: dates[0] ?? "",
      finishedAt: dates[1] ?? "",
      score,
      grade: score,
      state: stripTags(state) || "Finished",
    });
  }
  return out;
}
