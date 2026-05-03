import { CRITICALITY_LEVELS, getCriticalityMeta } from "../lib/criticality";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

interface CriticalityBadgeProps {
  level: number | null | undefined;
  /** Compact: only number (or "—" when null) */
  compact?: boolean;
  /** When provided, the badge becomes a clickable dropdown to change the level */
  onChange?: (level: number | null) => void;
  /** Disable interactions (e.g. while saving) */
  disabled?: boolean;
}

export function CriticalityBadge({ level, compact = false, onChange, disabled = false }: CriticalityBadgeProps) {
  const meta = getCriticalityMeta(level);
  const isUnclassified = level == null;
  const editable = !!onChange;

  const badgeBaseClass = compact
    ? `inline-flex items-center justify-center min-w-7 h-6 px-2 rounded-md text-xs font-semibold border ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`
    : `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${meta.bgClass} ${meta.textClass} ${meta.borderClass}`;

  const content = compact ? (
    isUnclassified ? "—" : meta.level
  ) : (
    <>
      {!isUnclassified && <span className="font-bold tabular-nums">{meta.level}</span>}
      <span className={isUnclassified ? "italic" : ""}>{meta.label}</span>
    </>
  );

  if (!editable) {
    return (
      <span
        className={badgeBaseClass}
        title={isUnclassified ? "Sin clasificar" : `Nivel ${meta.level} — ${meta.label}`}
      >
        {content}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={`${badgeBaseClass} gap-1 cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        title="Click para cambiar criticidad"
      >
        {content}
        <ChevronDownIcon className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs">Asignar criticidad</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onChange!(null); }}
          className="gap-2 text-muted-foreground italic"
        >
          {isUnclassified ? <CheckIcon className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
          Sin clasificar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {CRITICALITY_LEVELS.map((c) => (
          <DropdownMenuItem
            key={c.level}
            onClick={(e) => { e.stopPropagation(); onChange!(c.level); }}
            className={`gap-2 ${c.textClass}`}
          >
            {level === c.level ? <CheckIcon className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
            <span className="font-bold tabular-nums">{c.level}</span>
            <span>{c.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
