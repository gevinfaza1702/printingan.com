import { cn } from "@/src/lib/utils";
import * as React from "react";

export function BentoGrid({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-6", className)}>
      {children}
    </div>
  );
}

export function BentoCard({
  title,
  value,
  icon,
  gradient,
}: {
  title: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  gradient?: string; // ex: "from-blue-400 to-indigo-500"
}) {
  return (
    <div className="relative group">
      <div
        className={cn(
          "absolute inset-0 rounded-xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity",
          gradient ? `bg-gradient-to-r ${gradient}` : "bg-slate-200"
        )}
      />
      <div className="relative rounded-xl border border-gray-100 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <div
            className={cn(
              "rounded-lg p-2 text-white",
              gradient ? `bg-gradient-to-r ${gradient}` : "bg-gray-400"
            )}
          >
            {icon}
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{title}</div>
      </div>
    </div>
  );
}
