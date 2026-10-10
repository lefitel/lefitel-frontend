import { useId, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Card } from "./ui/card";

interface Props {
  title: string;
  /** Shown after the title when above zero. */
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * One section of a panel, as a card of its own that folds down to its title.
 * Stack several inside the panel and each opens on its own.
 *
 * Its content is not mounted while folded, so a section that asks the server
 * for something on mount only does so once somebody opens it.
 */
export default function CollapsibleSection({ title, count, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <Card className="py-0 gap-0 shadow-sm border-border/60 overflow-hidden">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-semibold text-left transition-colors hover:bg-muted/40 -outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span>
            {title}
            {count !== undefined && count > 0 && (
              <span className="text-muted-foreground font-normal tabular-nums"> · {count}</span>
            )}
          </span>
          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h2>
      {open && <div id={id} className="px-3 pb-3 pt-0.5">{children}</div>}
    </Card>
  );
}
