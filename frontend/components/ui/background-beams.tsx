import { motion } from "framer-motion";
import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.HTMLAttributes<HTMLDivElement>;

export function BackgroundBeams({ className, ...props }: Props) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      {...props}
    >
      {/* gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-sky-50 to-indigo-50" />
      {/* soft blobs */}
      <motion.div
        className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-indigo-400/25 blur-3xl"
        animate={{ x: [0, 40, -20, 0], y: [0, 20, -10, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-24 -bottom-24 h-[30rem] w-[30rem] rounded-full bg-fuchsia-400/25 blur-3xl"
        animate={{ x: [0, -30, 20, 0], y: [0, -10, 25, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* faint beams */}
      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-px w-[140%] -left-20 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            style={{ top: `${10 + i * 15}%` }}
            animate={{ x: ["-10%", "10%", "-10%"] }}
            transition={{ duration: 16 + i, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  );
}
