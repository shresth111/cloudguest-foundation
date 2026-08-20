import { Check, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { StepStatusBadge, type StepStatus } from "./StepStatusBadge";

export interface StepperItem {
  key: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  status?: StepStatus;
}

export interface StepperProps {
  steps: StepperItem[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
  allowBackwardNavigation?: boolean;
}

export function Stepper({
  steps,
  currentStep,
  onStepClick,
  className,
  allowBackwardNavigation = true,
}: StepperProps) {
  return (
    <ol className={cn("space-y-1", className)}>
      {steps.map((step, index) => {
        const done = index < currentStep;
        const active = index === currentStep;
        const Icon = step.icon;
        const clickable = allowBackwardNavigation && onStepClick && index < currentStep;

        return (
          <li key={step.key}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(index)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                active && "bg-background shadow-sm",
                !active && clickable && "hover:bg-background/60",
                !clickable && "cursor-default",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-medium",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : Icon ? (
                  <Icon className="h-3.5 w-3.5" />
                ) : (
                  index + 1
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "text-sm font-medium",
                      !active && !done && "text-muted-foreground",
                    )}
                  >
                    {index + 1}. {step.title}
                  </div>
                  {step.status ? <StepStatusBadge status={step.status} /> : null}
                </div>
                {step.description ? (
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
