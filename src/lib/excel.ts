import type ExcelJSTypes from "exceljs";
import type { ActivityResult, Job } from "./types";

const NAVY = "FF1F3864";
const BLUE = "FF2B5592";
const LIGHT = "FFDCE6F2";

const safeSheet = (name: string) =>
  name.replace(/[\\/*?:[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 28) || "Sheet";

function styleHeader(sheet: ExcelJSTypes.Worksheet, widths: number[], fill = NAVY) {
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
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: widths.length },
  };
}

function zebra(sheet: ExcelJSTypes.Worksheet) {
  sheet.eachRow((row, i) => {
    if (i === 1) return;
    row.font = { name: "Calibri", size: 11 };
    row.alignment = { vertical: "middle", wrapText: true };
    if (i % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F7FB" } };
      });
    }
  });
}

/** Sheet names that a job will produce — used for the wizard preview too. */
export function previewSheetNames(activities: { name: string; type: string }[]) {
  const names: string[] = [];
  for (const a of activities) {
    if (a.type === "vpl") {
      names.push(`${safeSheet(a.name)} - Att`, `${safeSheet(a.name)} - Sum`);
    } else {
      names.push(`${safeSheet(a.name)} - Res`);
    }
  }
  names.push("Master Summary", "Attempt Marks Grid", "Unmatched Students");
  return names;
}

export async function buildWorkbook(job: Job): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "REVA VPL & Quiz Report Extractor";
  wb.created = new Date();

  const section = job.section_name;
  const results = job.results;

  for (const result of results) {
    if (result.vpl) {
      const attempts = wb.addWorksheet(`${safeSheet(result.activity.name)} - Att`);
      attempts.addRow([
        "Roll No",
        "Student Name",
        "User ID",
        "Class Section",
        "Attempt #",
        "Submission Date & Time",
        "Description",
        "Grade",
        "Status",
        "Submission View URL",
        "Submission ID",
      ]);
      for (const s of result.vpl) {
        for (const a of s.attempts) {
          attempts.addRow([
            s.rollNo,
            s.studentName || s.moodleName,
            s.userId,
            section,
            a.attemptNumber,
            a.submittedAt,
            a.description,
            a.grade,
            a.status,
            a.submissionUrl,
            a.submissionId,
          ]);
        }
      }
      styleHeader(attempts, [14, 30, 10, 13, 10, 24, 32, 10, 14, 46, 14]);
      zebra(attempts);

      const summary = wb.addWorksheet(`${safeSheet(result.activity.name)} - Sum`);
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
          s.attempts.map((a) => a.grade || "-").join(", "),
          s.attempts.map((a) => a.submittedAt).filter(Boolean).join(" | "),
          s.finalGrade,
          s.latestSubmission || s.attempts[s.attempts.length - 1]?.submittedAt || "",
          s.attempts[s.attempts.length - 1]?.description ?? "",
        ]);
      }
      styleHeader(summary, [14, 30, 10, 13, 13, 16, 18, 40, 10, 24, 30], BLUE);
      zebra(summary);
    }

    if (result.quiz) {
      const sheet = wb.addWorksheet(`${safeSheet(result.activity.name)} - Res`);
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
      styleHeader(sheet, [14, 30, 10, 13, 14, 22, 22, 10, 10, 16], BLUE);
      zebra(sheet);
    }
  }

  // ---- Master summary ----
  const roster = new Map<
    string,
    { rollNo: string; name: string; userId: string; marks: Record<string, string> }
  >();
  const keyOf = (rollNo: string, name: string, userId: string) =>
    rollNo || userId || name.toUpperCase();

  for (const result of results) {
    const label = result.activity.name;
    const push = (rollNo: string, name: string, userId: string, value: string) => {
      const key = keyOf(rollNo, name, userId);
      const row =
        roster.get(key) ?? { rollNo, name, userId, marks: {} as Record<string, string> };
      row.marks[label] = value;
      if (!row.rollNo) row.rollNo = rollNo;
      if (!row.userId) row.userId = userId;
      roster.set(key, row);
    };
    result.vpl?.forEach((s) =>
      push(s.rollNo, s.studentName || s.moodleName, s.userId, s.finalGrade),
    );
    result.quiz?.forEach((s) =>
      push(s.rollNo, s.studentName || s.moodleName, s.userId, s.score),
    );
  }
  for (const s of job.students) {
    const key = keyOf(s.roll_no, s.name, "");
    if (!roster.has(key)) roster.set(key, { rollNo: s.roll_no, name: s.name, userId: "", marks: {} });
  }

  const labels = results.map((r) => r.activity.name);
  const master = wb.addWorksheet("Master Summary");
  master.addRow([
    "Roll No",
    "Student Name",
    "User ID",
    "Class Section",
    ...labels,
    "Total Marks",
    "Completed",
  ]);
  const sortedRoster = [...roster.values()].sort((a, b) =>
    (a.rollNo || a.name).localeCompare(b.rollNo || b.name),
  );
  const numOf = (v: string) => {
    const m = (v ?? "").match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  };
  for (const r of sortedRoster) {
    const values = labels.map((l) => r.marks[l] ?? "");
    master.addRow([
      r.rollNo,
      r.name,
      r.userId,
      section,
      ...values,
      values.reduce((sum, v) => sum + numOf(v), 0),
      `${values.filter((v) => v !== "").length}/${labels.length}`,
    ]);
  }
  styleHeader(master, [14, 30, 10, 13, ...labels.map(() => 16), 13, 12]);
  zebra(master);

  // ---- Attempt marks grid ----
  const grid = wb.addWorksheet("Attempt Marks Grid");
  const vplResults = results.filter((r) => r.vpl);
  grid.addRow([
    "Roll No",
    "Student Name",
    "User ID",
    "Class Section",
    ...vplResults.map((r) => r.activity.name),
  ]);
  for (const r of sortedRoster) {
    grid.addRow([
      r.rollNo,
      r.name,
      r.userId,
      section,
      ...vplResults.map((res) => {
        const s = res.vpl!.find(
          (x) => (x.rollNo || x.userId) === (r.rollNo || r.userId) || x.userId === r.userId,
        );
        return s ? s.attempts.map((a) => a.grade || "-").join(", ") : "";
      }),
    ]);
  }
  styleHeader(grid, [14, 30, 10, 13, ...vplResults.map(() => 22)], BLUE);
  zebra(grid);

  // ---- Unmatched students ----
  const unmatched = wb.addWorksheet("Unmatched Students");
  unmatched.addRow(["Activity", "Type", "Moodle Name", "User ID", "Class Section"]);
  for (const r of results) {
    for (const u of r.unmatched) {
      unmatched.addRow([r.activity.name, r.activity.type.toUpperCase(), u.moodleName, u.userId, section]);
    }
  }
  styleHeader(unmatched, [26, 10, 32, 12, 14], "FFC55A11");
  zebra(unmatched);
  unmatched.getCell("A1").note = "Names from Moodle that could not be matched to the supplied student list.";

  for (const sheet of wb.worksheets) {
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = cell.fill ?? { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
    });
  }

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
