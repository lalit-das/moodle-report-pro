import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function StepWizard({
  steps,
  current,
  onStepClick,
}: {
  steps: string[];
  current: number;
  onStepClick?: (index: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStepClick?.(index)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                active && "border-primary bg-primary text-primary-foreground",
                done && "border-success bg-success/12 text-success",
                !active && !done && "border-border bg-card text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full text-xs font-semibold",
                  active ? "bg-primary-foreground/20" : done ? "bg-success/20" : "bg-muted",
                )}
              >
                {done ? <Check className="size-3" /> : index + 1}
              </span>
              <span className="hidden font-medium sm:inline">{label}</span>
            </button>
            {index < steps.length - 1 ? (
              <span className="hidden h-px w-6 bg-border sm:block" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
