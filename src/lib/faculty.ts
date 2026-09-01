export interface Faculty {
  name: string;
  sections: string[];
}

/** Faculty ↔ section allocation for the current term. */
export const FACULTY: Faculty[] = [
  { name: "Dr. Ramaprasad H C", sections: ["CSE-A", "CSE-B", "CSE-C"] },
  { name: "Dr. Kavya A K Alse", sections: ["CSE-D"] },
  { name: "Prof. Ravindra Kumar", sections: ["CSE-E", "CSE-F"] },
  { name: "Dr. Manisha", sections: ["AIML-A", "AIML-B"] },
  { name: "Prof. Prathiksha", sections: ["AIML-C", "AIML-D", "AIML-E"] },
  { name: "Prof. Srinivas", sections: ["AIDS-A", "AIDS-B"] },
  { name: "Prof. Abhijeet", sections: ["AIDS-C", "IOT"] },
  { name: "Prof. Soumyadip Roy", sections: ["CSIT-A", "CSIT-B", "CSIT-C"] },
  { name: "Prof. Shruti K", sections: ["ISE-A", "ISE-B"] },
];

export const ALL_SECTIONS = FACULTY.flatMap((f) => f.sections);

const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function facultyForSection(section: string): string {
  const key = normalize(section);
  const hit = FACULTY.find((f) => f.sections.some((s) => normalize(s) === key));
  return hit?.name ?? "Unassigned";
}

/** Pulls the numeric part out of grades like "8 / 10", "8 out of 10" or "8". */
export function gradeValue(grade: string | undefined): number | null {
  if (!grade) return null;
  const match = grade.match(/(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}
