import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  helperText?: string;
  icon?: ReactNode;
  tone?: "neutral" | "teal" | "amber" | "red" | "sky" | "emerald";
  href?: string;
  clickable?: boolean;
}

const toneStyles: Record<NonNullable<KpiCardProps["tone"]>, { iconBg: string; iconText: string; valueColor: string }> = {
  neutral: { iconBg: "bg-slate-100", iconText: "text-slate-600", valueColor: "text-slate-900" },
  teal: { iconBg: "bg-teal-50", iconText: "text-teal-600", valueColor: "text-slate-900" },
  amber: { iconBg: "bg-amber-50", iconText: "text-amber-600", valueColor: "text-slate-900" },
  red: { iconBg: "bg-red-50", iconText: "text-red-600", valueColor: "text-red-600" },
  sky: { iconBg: "bg-sky-50", iconText: "text-sky-600", valueColor: "text-slate-900" },
  emerald: { iconBg: "bg-emerald-50", iconText: "text-emerald-600", valueColor: "text-slate-900" },
};

export function KpiCard({
  label,
  value,
  subtitle,
  helperText,
  icon,
  tone = "neutral",
  href,
  clickable,
}: KpiCardProps) {
  const styles = toneStyles[tone];
  const isLink = href !== undefined;

  const inner = (
    <div
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all",
        (isLink || clickable) && "cursor-pointer hover:border-slate-300 hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {icon && (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", styles.iconBg, styles.iconText)}>
            {icon}
          </span>
        )}
      </div>
      <div>
        <p className={cn("text-2xl font-semibold tracking-tight tabular-nums", styles.valueColor)}>{value}</p>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        {helperText && <p className="mt-0.5 text-xs text-slate-400">{helperText}</p>}
      </div>
      {isLink && (
        <ArrowRight className="absolute right-5 bottom-5 h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400" />
      )}
    </div>
  );

  if (isLink) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}
