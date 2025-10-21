import { cn } from "@/src/lib/utils";
import { motion } from "framer-motion";

type Props = React.HTMLAttributes<HTMLDivElement>;

export function AuroraBackground({ className, children, ...props }: Props) {
  return (
    <div className={cn("relative overflow-hidden", className)} {...props}>
      {/* base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600" />
      {/* subtle aurora blobs */}
      <motion.div
        className="absolute -top-32 -left-24 h-[30rem] w-[30rem] rounded-full bg-white/10 blur-3xl"
        animate={{ x: [0, 30, -10, 0], y: [0, 10, -20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 -right-24 h-[32rem] w-[32rem] rounded-full bg-white/10 blur-3xl"
        animate={{ x: [0, -25, 15, 0], y: [0, -15, 25, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* noise mask for texture */}
      <div className="pointer-events-none absolute inset-0 opacity-25 [background:radial-gradient(100%_50%_at_50%_0%,rgba(255,255,255,.35)_0%,rgba(255,255,255,0)_75%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}
