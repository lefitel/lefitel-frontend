import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { type DateRange } from "react-day-picker"
import { Calendar } from "@/components/ui/calendar"
import { chooserTrigger } from "@/components/ui/control-surface"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
  /**
   * Accessible name for the trigger. Same reason as `DatePicker`'s: what the
   * button says is the range it holds, never the field it belongs to.
   */
  ariaLabel?: string
}

const day = (d: Date) => format(d, "dd/MM/yyyy", { locale: es })

export function DateRangePicker({ value, onChange, placeholder = "Seleccionar rango", className, ariaLabel }: DateRangePickerProps) {
  const label = !value?.from
    ? placeholder
    : value.to ? `${day(value.from)} — ${day(value.to)}` : day(value.from)
  // One month on a phone. Two are drawn one over the other there, and at a
  // finger's cell size that is taller than the screen, with the second month
  // below its edge; the arrows reach the next month just as well.
  const isMobile = useIsMobile()

  return (
    <Popover>
      <PopoverTrigger asChild>
        {/*
          The same skin as the select it sits beside, not a button's. It wore
          `variant="outline"` — `--gradient-surface`, built from `--card` — so
          in a filter row the operator and the range were 1.17:1 apart while
          being the same kind of control, and on a white card the trigger's own
          top edge was 1.00:1 against the surface behind it: no border, no
          contrast, only a drop shadow.

          And the name carries the span, for the reason spelled out in
          `DatePicker`: `aria-label` replaces the text, and the text is the
          value.
        */}
        <button
          type="button"
          aria-label={ariaLabel && `${ariaLabel}: ${label}`}
          className={cn(chooserTrigger, "justify-start font-normal", !value?.from && "text-muted-foreground", className)}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          // Two clicks, never one.
          //
          // With no minimum, `addToRange` answers the first click with
          // `{from: X, to: X}` — a complete, validating "entre X y X". A stray
          // click made a filter look finished, and on a timestamp column that
          // range matches only the rows at exactly midnight, so the report came
          // back empty with nothing to say why. With a minimum, one click
          // leaves the range half made and `validateConfig` says so, which is
          // what the two separate boxes used to do.
          //
          // The cost, and it is real: a single day can no longer be expressed
          // as "entre el 15 y el 15" here. Clicking the same day twice clears
          // the range instead. A one-day filter is «es igual a» or a pair of
          // «mayor o igual» / «menor o igual».
          min={1}
          defaultMonth={value?.from}
          selected={value}
          onSelect={onChange}
          numberOfMonths={isMobile ? 1 : 2}
          locale={es}
        />
      </PopoverContent>
    </Popover>
  )
}
