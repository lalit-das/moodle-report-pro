import { useEffect, useRef } from "react";

export function LogFeed({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length]);

  return (
    <div
      ref={ref}
      className="h-72 overflow-y-auto rounded-lg bg-secondary/60 p-3 font-mono text-xs leading-relaxed text-secondary-foreground"
    >
      {lines.length === 0 ? (
        <p className="text-muted-foreground">Waiting for log output…</p>
      ) : (
        lines.map((line, i) => (
          <p key={i} className="whitespace-pre-wrap">
            {line}
          </p>
        ))
      )}
    </div>
  );
}
