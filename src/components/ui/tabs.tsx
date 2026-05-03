import * as React from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ─── Context ──────────────────────────────────────────────────────────────────

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
  groupId: string;
  orientation: "horizontal" | "vertical";
  variant: "default" | "line";
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

  // variant gets injected by TabsList children (default unless TabsList specifies "line")
  const [variant, setVariant] = React.useState<"default" | "line">("default");

  const ctx = React.useMemo(
    () => ({ value, setValue, groupId, orientation, variant }),
    [value, setValue, groupId, orientation, variant]
  );

  // expose setVariant via internal context (pasamos por children)
  const ctxWithSetter = React.useMemo(
    () => ({ ...ctx, _setVariant: setVariant }),
    [ctx]
  );

  return (
    <TabsContext.Provider value={ctxWithSetter as unknown as TabsContextValue}>
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

const tabsListVariants = cva(
  "group/tabs-list relative inline-flex w-fit items-center justify-center rounded-lg p-[2px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface TabsListProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tabsListVariants> {}

function TabsList({ className, variant = "default", ...props }: TabsListProps) {
  const ctx = useTabsContext("TabsList");
  // sync variant up to context
  const setVariant = (ctx as unknown as { _setVariant: (v: "default" | "line") => void })._setVariant;
  React.useEffect(() => {
    setVariant?.(variant ?? "default");
  }, [variant, setVariant]);

  return (
    <div
      role="tablist"
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
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
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-0.5 text-sm font-medium whitespace-nowrap transition-colors group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        isActive
          ? "text-foreground"
          : "text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground",
        className
      )}
      {...props}
    >
      {/* Animated highlighter — only rendered on active tab; layoutId drives the slide */}
      {isActive && ctx.variant === "default" && (
        <motion.span
          layoutId={`tabs-highlighter-${ctx.groupId}`}
          className="absolute inset-0 rounded-md bg-background shadow-sm dark:border dark:border-input dark:bg-input/30 z-0"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        />
      )}
      {isActive && ctx.variant === "line" && (
        <motion.span
          layoutId={`tabs-underline-${ctx.groupId}`}
          className="absolute inset-x-0 -bottom-1.25 h-0.5 bg-foreground"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
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

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
