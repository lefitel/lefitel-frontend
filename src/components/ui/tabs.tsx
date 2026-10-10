import * as React from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { cn } from "@/lib/utils";

// ─── Shared skin ──────────────────────────────────────────────────────────────
// The pill-in-a-track drawing, shared with SegmentedControl so both stay one shape.

// Dark flips the pair: a well darker than any surface it sits on, and a thumb lighter than
// the card. The hairline keeps the well visible on the page ground, which is the same colour.
export const pillTrack = "rounded-full bg-muted dark:bg-background dark:inset-ring dark:inset-ring-border/60";
export const pillThumb = "absolute inset-0 z-0 rounded-full bg-background shadow-sm dark:bg-accent";
export const pillSpring = { type: "spring", stiffness: 380, damping: 32 } as const;

// ─── Context ──────────────────────────────────────────────────────────────────

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
  groupId: string;
  orientation: "horizontal" | "vertical";
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(component: string) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error(`${component} must be used inside <Tabs>`);
  return ctx;
}

// ─── Root ─────────────────────────────────────────────────────────────────────

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
}

function Tabs({
  className,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  orientation = "horizontal",
  children,
  ...props
}: TabsProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const isControlled = valueProp !== undefined;
  const value = isControlled ? valueProp : uncontrolled;
  const groupId = React.useId();

  const setValue = React.useCallback(
    (v: string) => {
      if (!isControlled) setUncontrolled(v);
      onValueChange?.(v);
    },
    [isControlled, onValueChange]
  );

  const ctx = React.useMemo(
    () => ({ value, setValue, groupId, orientation }),
    [value, setValue, groupId, orientation]
  );

  return (
    <TabsContext.Provider value={ctx}>
      <LayoutGroup id={groupId}>
        <div
          data-slot="tabs"
          data-orientation={orientation}
          className={cn(
            "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </LayoutGroup>
    </TabsContext.Provider>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  useTabsContext("TabsList");

  return (
    <div
      role="tablist"
      data-slot="tabs-list"
      className={cn(
        "group/tabs-list relative inline-flex w-fit items-center justify-center p-[2px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
        pillTrack,
        className
      )}
      {...props}
    />
  );
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

function TabsTrigger({ className, value, children, onClick, ...props }: TabsTriggerProps) {
  const ctx = useTabsContext("TabsTrigger");
  const isActive = ctx.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-slot="tabs-trigger"
      data-active={isActive ? "" : undefined}
      onClick={(e) => {
        ctx.setValue(value);
        onClick?.(e);
      }}
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-full border border-transparent px-3 py-0.5 text-sm font-medium whitespace-nowrap transition-colors group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        isActive
          ? "text-foreground"
          : "text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground",
        className
      )}
      {...props}
    >
      {/* Animated highlighter — only rendered on active tab; layoutId drives the slide */}
      {isActive && (
        <motion.span
          layoutId={`tabs-highlighter-${ctx.groupId}`}
          className={pillThumb}
          transition={pillSpring}
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-1.5">
        {children}
      </span>
    </button>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function TabsContent({ className, value, children }: TabsContentProps) {
  const ctx = useTabsContext("TabsContent");
  const isActive = ctx.value === value;

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {isActive && (
        <motion.div
          key={value}
          role="tabpanel"
          data-slot="tabs-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={cn("flex-1 text-sm outline-none", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
