import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(7,12,24,0.95))] shadow-[0_24px_60px_rgba(2,6,23,0.42)] ring-1 ring-inset ring-white/[0.03] backdrop-blur-md",
        className,
      )}
      {...props}
    />
  );
}