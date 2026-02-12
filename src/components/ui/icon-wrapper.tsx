import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import type { ReactNode, ComponentPropsWithoutRef } from "react";

interface IconWrapperProps extends ComponentPropsWithoutRef<"button"> {
  children: ReactNode;
  className?: string;
  asChild?: boolean;
}

export function IconWrapper({
  children,
  className,
  asChild = false,
  ...props
}: IconWrapperProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      type={asChild ? undefined : "button"}
      className={cn(
        "w-11 h-11 inline-flex items-center justify-center rounded-md",
        "hover:bg-muted transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

