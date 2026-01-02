import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface GlassContainerProps {
  children: ReactNode;
  className?: string;
  rounded?: "none" | "lg" | "2xl";
}

export function GlassContainer({
  children,
  className,
  rounded = "lg",
}: GlassContainerProps) {
  return (
    <div
      className={cn(
        "bg-background/80 backdrop-blur-md border",
        rounded === "none"
          ? "rounded-none"
          : rounded === "2xl"
          ? "rounded-2xl"
          : "rounded-lg",
        className
      )}
    >
      {children}
    </div>
  );
}

