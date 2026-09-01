import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { average, type SectionBoard as Board } from "@/lib/live-boards";

export function SectionBoard({ board, showFaculty = true }: { board: Board; showFaculty?: boolean }) {
  return (
    <section className="surface-card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-lg font-semibold">{board.section}</h2>
          {showFaculty ? (
            <p className="text-sm text-muted-foreground">{board.faculty}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{board.rows.length} students</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={board.status === "running" ? "default" : "secondary"}>
            {board.status === "running" ? "Live" : board.status}
          </Badge>
          <span className="text-xs tabular-nums text-muted-foreground">
            Updated {new Date(board.updatedAt).toLocaleTimeString()}
          </span>
        </div>
      </header>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Roll No</TableHead>
              <TableHead>Student</TableHead>
              {board.activities.map((a) => (
                <TableHead key={a} className="text-right">
                  {a}
                </TableHead>
              ))}
              <TableHead className="text-right">Attempts</TableHead>
              <TableHead className="text-right">Average</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {board.rows.map((row) => {
              const avg = average(row, board.activities);
              return (
                <TableRow key={row.rollNo || row.studentName}>
                  <TableCell className="font-medium tabular-nums">{row.rollNo || "—"}</TableCell>
                  <TableCell>{row.studentName}</TableCell>
                  {board.activities.map((a) => (
                    <TableCell key={a} className="text-right tabular-nums">
                      {row.scores[a] ?? "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">{row.attempts}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {avg == null ? "—" : avg.toFixed(2)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
