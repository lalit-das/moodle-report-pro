import { useRef } from "react";
import { Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { StudentInput } from "@/lib/types";

export function parseStudentText(text: string): StudentInput[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\t|,|;|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) return { roll_no: parts[0]!, name: parts.slice(1).join(" ") };
      const m = line.match(/^(\S+)\s+(.*)$/);
      return m ? { roll_no: m[1]!, name: m[2]! } : { roll_no: line, name: "" };
    })
    .filter((s) => s.roll_no && !/^roll\s*no$/i.test(s.roll_no));
}

export function StudentListInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const students = parseStudentText(value);

  const handleFile = async (file: File) => {
    try {
      if (/\.csv$/i.test(file.name)) {
        const text = await file.text();
        const rows = text
          .split(/\r?\n/)
          .filter(Boolean)
          .map((r) => r.split(","));
        onChange(rows.map((r) => `${(r[0] ?? "").trim()}\t${(r[1] ?? "").trim()}`).join("\n"));
      } else {
        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await file.arrayBuffer());
        const sheet = wb.worksheets[0]!;
        const lines: string[] = [];
        sheet.eachRow((row) => {
          const a = String(row.getCell(1).text ?? "").trim();
          const b = String(row.getCell(2).text ?? "").trim();
          if (a) lines.push(`${a}\t${b}`);
        });
        onChange(lines.join("\n"));
      }
      toast.success(`Loaded students from ${file.name}`);
    } catch {
      toast.error("Could not read that file. Use two columns: Roll No, Name.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="students">Student list (Roll No · TAB/comma · Name)</Label>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{students.length} students</Badge>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Upload CSV / Excel
          </Button>
        </div>
      </div>
      <Textarea
        id="students"
        rows={10}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"R25EF001\tANANYA SHARMA\nR25EF002\tKARTHIK RAO"}
        className="font-mono text-xs"
      />
    </div>
  );
}
