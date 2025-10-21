import * as React from "react";

export function SpotlightCard({
  className = "",
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-white ${className}`}>
      {/* top gradient bar */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-blue-500/0 via-blue-500/60 to-blue-500/0" />
      {/* hover ring glow */}
      <div className="pointer-events-none absolute -inset-px rounded-xl opacity-0 ring-1 ring-blue-500/20 transition-opacity duration-300 group-hover:opacity-100" />
      {children}
    </div>
  );
}
