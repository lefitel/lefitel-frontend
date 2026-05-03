import * as React from "react";
import { motion, LayoutGroup } from "motion/react";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** Optional icon */
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedControlOption<T>>;
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
  /** When true, allow the inner area to scroll horizontally if it overflows */
  scrollable?: boolean;
  /** Optional aria label for the group */
  ariaLabel?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  className,
  size = "md",
  scrollable = false,
  ariaLabel,
}: SegmentedControlProps<T>) {
  const groupId = React.useId();
  const heightClass = size === "sm" ? "h-7" : "h-9";
  const buttonHeight = size === "sm" ? "h-[calc(100%-2px)]" : "h-[calc(100%-1px)]";
  const textClass = size === "sm" ? "text-xs" : "text-sm";

  return (
    <LayoutGroup id={`seg-${groupId}`}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center rounded-lg bg-muted p-0.5 gap-0.5",
          heightClass,
          scrollable && "overflow-x-auto max-w-full no-scrollbar",
          className
        )}
      >
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onValueChange(opt.value)}
              className={cn(
                "relative inline-flex items-center justify-center gap-1.5 rounded-md px-2 sm:px-3 font-medium whitespace-nowrap shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                buttonHeight,
                textClass,
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId={`seg-highlight-${groupId}`}
                  className="absolute inset-0 rounded-md bg-background shadow-sm dark:border dark:border-input dark:bg-input/30 z-0"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                {opt.icon}
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
