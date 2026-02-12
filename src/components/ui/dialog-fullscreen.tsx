"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const DialogFullscreenContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Content
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 flex flex-col h-[100dvh] max-h-[100dvh]",
      className
    )}
    {...props}
  />
));
DialogFullscreenContent.displayName = DialogPrimitive.Content.displayName;

export { DialogFullscreenContent };

