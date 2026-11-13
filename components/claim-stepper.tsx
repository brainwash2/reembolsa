import { cn } from "@/lib/utils";
import { claimStatusLabels } from "@/lib/format";
import type { ClaimStatus } from "@/lib/mock-data";
import { Check } from "lucide-react";

const steps: ClaimStatus[] = ["draft", "ready", "filed", "approved", "paid"];

export function ClaimStepper({ status }: { status: ClaimStatus }) {
  const currentIndex = steps.indexOf(status);

  return (
    <div className="flex items-center gap-0.5">
      {steps.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={step} className="flex flex-1 items-center gap-0.5">
            <div
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-colors",
                isDone
                  ? "bg-teal-500 text-white"
                  : isCurrent
                    ? "bg-teal-100 text-teal-700 ring-2 ring-teal-400"
                    : "bg-slate-100 text-slate-400"
              )}
              title={claimStatusLabels[step]}
            >
              {isDone ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  i < currentIndex ? "bg-teal-500" : "bg-slate-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
