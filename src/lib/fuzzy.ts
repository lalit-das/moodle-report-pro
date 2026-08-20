import type { StudentInput } from "./types";

const norm = (s: string) =>
  s
    .toUpperCase()
    .replace(/\b(MR|MS|MRS|DR)\b\.?/g, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (s: string) => norm(s).split(" ").filter(Boolean);

function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * 5-level scoring:
 * 1.00 exact normalised match
 * 0.90 same token set (any order)
 * 0.80 all tokens of the shorter name contained in the longer
 * 0.65 first + last token match
 * 0..0.6 character similarity fallback
 */
export function scoreNames(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ta = tokens(a);
  const tb = tokens(b);
  const sa = [...ta].sort().join(" ");
  const sb = [...tb].sort().join(" ");
  if (sa === sb) return 0.9;

  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.length && short.every((t) => long.includes(t))) return 0.8;

  if (ta[0] === tb[0] && ta[ta.length - 1] === tb[tb.length - 1]) return 0.65;

  const dist = levenshtein(na, nb);
  const sim = 1 - dist / Math.max(na.length, nb.length);
  return Math.max(0, Math.min(0.6, sim * 0.6));
}

export interface MatchResult {
  student: StudentInput | null;
  score: number;
}

export function matchStudent(
  moodleName: string,
  students: StudentInput[],
  threshold = 0.6,
): MatchResult {
  let best: MatchResult = { student: null, score: 0 };
  for (const s of students) {
    const score = scoreNames(moodleName, s.name);
    if (score > best.score) best = { student: s, score };
    if (score === 1) break;
  }
  return best.score >= threshold ? best : { student: null, score: best.score };
}

/** Roll numbers are often embedded in the Moodle display name. */
export function extractRollNo(moodleName: string): string {
  return moodleName.match(/\b[A-Z]\d{2}[A-Z]{2}\d{3,4}\b/i)?.[0]?.toUpperCase() ?? "";
}
