"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface WizardShellProps {
  steps: string[];
  currentStep: number;
  onStepClick: (stepIndex: number) => void;
  children: ReactNode;
  footer: ReactNode;
}

export function WizardShell({ steps, currentStep, onStepClick, children, footer }: WizardShellProps) {
  const currentLabel = steps[currentStep] ?? "";
  const progress = Math.round(((currentStep + 1) / steps.length) * 100);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Adım {currentStep + 1}/{steps.length}</span>
          <span>{currentLabel}</span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
            aria-hidden
          />
        </div>

        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {steps.map((step, index) => {
            const isPast = index < currentStep;
            const isCurrent = index === currentStep;
            const isFuture = index > currentStep;

            return (
              <li key={step}>
                <button
                  type="button"
                  onClick={() => onStepClick(index)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left text-xs transition-colors",
                    isCurrent && "border-primary bg-primary/10 text-foreground",
                    isPast && "border-border bg-card hover:bg-accent/40",
                    isFuture && "border-border bg-muted/40 text-muted-foreground hover:bg-accent/30"
                  )}
                >
                  <span className="block font-semibold">{index + 1}. Adım</span>
                  <span className="mt-1 block">{step}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div>{children}</div>

      <div className="sticky bottom-0 z-10 -mx-1 border-t border-border bg-card px-1 py-4">
        {footer}
      </div>
    </div>
  );
}
