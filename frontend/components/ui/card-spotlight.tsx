import * as React from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = React.HTMLAttributes<HTMLDivElement>;

export function CardSpotlight({ className, children, ...props }: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const radial = useTransform([mx, my], ([x, y]) => {
    return `radial-gradient(160px 160px at ${x}px ${y}px, rgba(255,255,255,0.25), transparent 70%)`;
  });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn(
        "relative rounded-2xl border border-slate-200/60 bg-white/80 shadow-xl backdrop-blur",
        "overflow-hidden",
        className
      )}
      {...props}
    >
      {/* spotlight layer */}
      <motion.div
        aria-hidden
        style={{ background: radial }}
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
      />
      {children}
    </div>
  );
}
