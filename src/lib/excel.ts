import type ExcelJSTypes from "exceljs";
import type { ActivityResult, Job, VplAttempt, VplStudentResult } from "./types";

/** Colours taken from the reference CSE_A_VPL_Report.xlsx workbook. */
const NAVY = "FF1F3864"; // per-activity attempt sheets
const BLUE = "FF2B5592"; // per-activity summary / quiz sheets
const GREEN = "FF1E6B1E"; // Master Summary + Attempt Marks Grid
const RED = "FFC00000"; // Unmatched Students
const ZEBRA = "FFF4F7FB";

const numOf = (v: string) => {
  const m = (v ?? "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
};

/** Numeric "Lab Marks" value the reference workbook stores next to a grade. */
const labMarks = (grade: string) => (grade ? String(numOf(grade)) : "");

const cleanSheet = (name: string) =>
  name.replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim();

/** Reference workbook truncates the activity name, then suffixes " - Atte"/" - Summ" and dedupes. */
function sheetNamer() {
  const used = new Set<string>();
  return (activityName: string, suffix: "Atte" | "Summ" | "Resu") => {
    const base = `${cleanSheet(activityName).slice(0, 22)} - ${suffix}`;
    let name = base;
    let i = 0;
    while (used.has(name)) name = `${base}${++i}`;
    used.add(name);
    return name.slice(0, 31);
  };
}

function styleSheet(
  sheet: ExcelJSTypes.Worksheet,
  widths: number[],
  fill: string,
  frozenColumns = 0,
) {
  const header = sheet.getRow(1);
  header.font = { name: "Calibri", bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.height = 28;
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.border = {
      top: { style: "thin", color: { argb: "FFFFFFFF" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  });
  widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: frozenColumns }];

  sheet.eachRow((row, i) => {
    if (i === 1) return;
    row.font = { name: "Calibri", size: 10 };
    row.alignment = { vertical: "middle", wrapText: true };
    if (i % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      });
    }
  });
}

/** Sheet names that a job will produce — used for the wizard preview too. */
export function previewSheetNames(activities: { name: string; type: string }[]) {
  const nameFor = sheetNamer();
  const names: string[] = [];
  for (const a of activities) {
    if (a.type === "vpl") {
      names.push(nameFor(a.name, "Atte"), nameFor(a.name, "Summ"));
    } else {
      names.push(nameFor(a.name, "Resu"));
    }
  }
  names.push("Master Summary", "Attempt Marks Grid", "Unmatched Students");
  return names;
}

/** Marks list a student scored per attempt, e.g. "10, 10, -, 8". */
const attemptMarks = (attempts: VplAttempt[]) =>
  attempts.map((a) => (a.grade ? String(numOf(a.grade)) : "-")).join(", ");

/** Lab marks for the attempt matching the student's latest submission. */
function summaryLabMarks(s: VplStudentResult) {
  const latest = s.attempts.find((a) => a.submittedAt && a.submittedAt === s.latestSubmission);
  return labMarks(latest?.grade ?? "");
}

export async function buildWorkbook(job: Job): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "REVA VPL & Quiz Report Extractor";
  wb.created = new Date();

  const section = job.section_name;
  const results = job.results;
  const nameFor = sheetNamer();

  for (const result of results) {
    if (result.vpl) {
      // ---- Attempts sheet (one row per submission) ----
      const attempts = wb.addWorksheet(nameFor(result.activity.name, "Atte"));
      attempts.addRow([
        "Student Name",
        "User ID",
        "Class Section",
        "Attempt #",
        "Submission Date & Time",
        "Description",
        "Grade",
        "Lab Marks",
        "Status",
        "Submission View URL",
        "Submission ID",
      ]);
      for (const s of result.vpl) {
        for (const a of s.attempts) {
          const row = attempts.addRow([
            s.studentName || s.moodleName,
            s.userId,
            "",
            a.attemptNumber,
            a.submittedAt,
            a.description,
            a.grade,
            labMarks(a.grade),
            a.status,
            a.submissionUrl,
            a.submissionId,
          ]);
          if (a.submissionUrl) {
            row.getCell(10).value = { text: a.submissionUrl, hyperlink: a.submissionUrl };
          }
        }
      }
      styleSheet(attempts, [24, 10, 12, 10, 22, 26, 12, 10, 14, 55, 14], NAVY);

      // ---- Per-student summary sheet ----
      const summary = wb.addWorksheet(nameFor(result.activity.name, "Summ"));
      summary.addRow([
        "Roll No",
        "Student Name",
        "User ID",
        "Class Section",
        "Attempt Count",
        "Attempt Numbers",
        "Attempt Marks",
        "Submission Dates & Times",
        "Marks",
        "Lab Marks",
        "Latest Submission",
        "Description",
      ]);
      for (const s of result.vpl) {
        summary.addRow([
          s.rollNo,
          s.studentName || s.moodleName,
          s.userId,
          section,
          s.attempts.length,
          s.attempts.map((a) => a.attemptNumber).join(", "),
          attemptMarks(s.attempts),
          s.attempts.map((a) => a.submittedAt).filter(Boolean).join(", "),
          s.attempts.map((a) => a.grade).filter(Boolean).join(", "),
          summaryLabMarks(s),
          s.latestSubmission || s.attempts[s.attempts.length - 1]?.submittedAt || "",
          s.attempts.map((a) => a.description).filter(Boolean).join(", "),
        ]);
      }
      styleSheet(summary, [14, 24, 10, 12, 12, 20, 20, 30, 30, 10, 24, 30], BLUE);
    }

    if (result.quiz) {
      const sheet = wb.addWorksheet(nameFor(result.activity.name, "Resu"));
      sheet.addRow([
        "Roll No",
        "Student Name",
        "User ID",
        "Class Section",
        "Quiz Attempt #",
        "Start Time",
        "Finish Time",
        "Score",
        "Grade",
        "State",
      ]);
      for (const s of result.quiz) {
        sheet.addRow([
          s.rollNo,
          s.studentName || s.moodleName,
          s.userId,
          section,
          s.attemptNumber,
          s.startedAt,
          s.finishedAt,
          s.score,
          s.grade,
          s.state,
        ]);
      }
      styleSheet(sheet, [14, 24, 10, 12, 14, 22, 22, 12, 12, 16], BLUE);
    }
  }

  // ---- Roster keyed by roll number / user id ----
  interface RosterRow {
    rollNo: string;
    name: string;
    userId: string;
    marks: Record<string, string>;
  }
  const roster = new Map<string, RosterRow>();
  const keyOf = (rollNo: string, name: string, userId: string) =>
    rollNo || userId || name.toUpperCase();

  for (const s of job.students) {
    roster.set(keyOf(s.roll_no, s.name, ""), {
      rollNo: s.roll_no,
      name: s.name,
      userId: "",
      marks: {},
    });
  }

  const labelOf = (result: ActivityResult, index: number) =>
    `${cleanSheet(result.activity.name)}#${index}`;

  results.forEach((result, index) => {
    const label = labelOf(result, index);
    const push = (rollNo: string, name: string, userId: string, value: string) => {
      const key = keyOf(rollNo, name, userId);
      const row = roster.get(key) ?? { rollNo, name, userId, marks: {} };
      row.marks[label] = value;
      if (!row.rollNo) row.rollNo = rollNo;
      if (!row.userId) row.userId = userId;
      if (!row.name) row.name = name;
      roster.set(key, row);
    };
    result.vpl?.forEach((s) =>
      push(s.rollNo, s.studentName || s.moodleName, s.userId, attemptMarks(s.attempts)),
    );
    result.quiz?.forEach((s) => push(s.rollNo, s.studentName || s.moodleName, s.userId, s.score));
  });

  const sortedRoster = [...roster.values()].sort((a, b) =>
    (a.rollNo || a.name).localeCompare(b.rollNo || b.name),
  );

  // ---- Master Summary: one column per activity ----
  const master = wb.addWorksheet("Master Summary");
  master.addRow([
    "Roll No",
    "Student Name",
    "User ID",
    "Class Section",
    ...results.map((r) => cleanSheet(r.activity.name)),
    "Total Marks",
    "Completed",
  ]);
  for (const r of sortedRoster) {
    const values = results.map((res, i) => r.marks[labelOf(res, i)] ?? "");
    master.addRow([
      r.rollNo,
      r.name,
      r.userId,
      section,
      ...values,
      values.reduce((sum, v) => sum + numOf(v), 0),
      `${values.filter((v) => v !== "").length}/${results.length}`,
    ]);
  }
  styleSheet(master, [14, 24, 10, 12, ...results.map(() => 22), 13, 12], GREEN, 4);

  // ---- Attempt Marks Grid: one row per student per VPL activity ----
  const grid = wb.addWorksheet("Attempt Marks Grid");
  const vplResults = results.filter((r) => r.vpl);
  const maxAttempts = Math.max(
    1,
    ...vplResults.flatMap((r) => r.vpl!.map((s) => s.attempts.length)),
  );
  grid.addRow([
    "Roll No",
    "Student Name",
    "User ID",
    "Class Section",
    "Activity",
    ...Array.from({ length: maxAttempts }, (_, i) => `Attempt ${i + 1}`),
  ]);
  for (const r of sortedRoster) {
    for (const res of vplResults) {
      const student = res.vpl!.find(
        (x) =>
          (x.rollNo && x.rollNo === r.rollNo) ||
          (x.userId && x.userId === r.userId) ||
          (x.studentName || x.moodleName).toUpperCase() === r.name.toUpperCase(),
      );
      if (!student) continue;
      grid.addRow([
        r.rollNo,
        r.name,
        r.userId,
        section,
        cleanSheet(res.activity.name),
        ...Array.from({ length: maxAttempts }, (_, i) => {
          const a = student.attempts[i];
          if (!a) return "-";
          return a.grade ? String(numOf(a.grade)) : "-";
        }),
      ]);
    }
  }
  styleSheet(
    grid,
    [14, 24, 10, 12, 26, ...Array.from({ length: maxAttempts }, () => 10)],
    GREEN,
    2,
  );

  // ---- Unmatched students ----
  const unmatched = wb.addWorksheet("Unmatched Students");
  unmatched.addRow(["Roll No", `${section} Name`, "Activity", "Note"]);
  const matchedKeys = new Set<string>();
  for (const result of results) {
    result.vpl?.forEach((s) => matchedKeys.add(`${result.activity.id}:${s.rollNo || s.userId}`));
    result.quiz?.forEach((s) => matchedKeys.add(`${result.activity.id}:${s.rollNo || s.userId}`));
  }
  for (const result of results) {
    // Students on the roster with no Moodle submission for this activity.
    for (const s of job.students) {
      if (!matchedKeys.has(`${result.activity.id}:${s.roll_no}`)) {
        unmatched.addRow([
          s.roll_no,
          s.name.toUpperCase(),
          cleanSheet(result.activity.name),
          "Not found in Moodle submissions",
        ]);
      }
    }
    // Moodle names that could not be matched back to the roster.
    for (const u of result.unmatched) {
      unmatched.addRow([
        "",
        u.moodleName.toUpperCase(),
        cleanSheet(result.activity.name),
        `Moodle user ${u.userId} not in ${section} list`,
      ]);
    }
  }
  styleSheet(unmatched, [14, 28, 30, 38], RED);

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function downloadWorkbook(job: Job) {
  const blob = await buildWorkbook(job);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${job.output_filename || `${job.section_name}_Report`}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
