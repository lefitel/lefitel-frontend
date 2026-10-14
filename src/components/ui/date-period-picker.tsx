import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { type Matcher } from "react-day-picker"
import { Calendar } from "@/components/ui/calendar"
import { chooserTrigger } from "@/components/ui/control-surface"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

/** A period by its two ends. Either may be missing: an open end limits nothing. */
export interface DatePeriod {
  from: Date | undefined
  to: Date | undefined
}

interface DatePeriodPickerProps {
  value: DatePeriod
  onChange: (period: DatePeriod) => void
  /** The last day that can be chosen, at either end. A log has nothing after today. */
  max?: Date
  /** What the control says when neither end is set. */
  placeholder?: string
  className?: string
  /**
   * Accessible name for the trigger. Same reason as `DatePicker`'s: what the
   * button says is the period it holds, never the field it belongs to.
   */
  ariaLabel?: string
  /** Which edge of the trigger the calendars line up with. */
  align?: "start" | "end"
}

const day = (d: Date) => format(d, "dd/MM/yyyy", { locale: es })
/** Whether `a` falls on a later calendar day than `b`, whatever the hour of either. */
const isLaterDay = (a: Date, b: Date) =>
  new Date(a.getFullYear(), a.getMonth(), a.getDate()) > new Date(b.getFullYear(), b.getMonth(), b.getDate())

const currentYear = new Date().getFullYear()

/**
 * A period in one control, with a calendar of its own for each end.
 *
 * One control, because a period is one thing: it takes one place in a toolbar
 * and reads as "01/03/2026 — 20/03/2026". Two calendars, because its ends are
 * often far apart. `DateRangePicker` draws two adjoining months that move
 * together and cannot jump, which suits a range of days or weeks; a year back
 * there is twelve presses, twice. Here each end is navigated on its own, with
 * the month and year menus `DatePicker` has.
 *
 * The ends are kept in order by what each calendar offers rather than by a
 * message afterwards: the end's does not offer a day before the start, and a
 * start chosen past the end takes the end with it — refusing it would mean
 * moving the end first in order to move the period later. A period of a single
 * day is allowed, so whoever reads the value must treat the end as the whole
 * of that day.
 */
export function DatePeriodPicker({
  value, onChange, max, placeholder = "Todo el período", className, ariaLabel, align = "start",
}: DatePeriodPickerProps) {
  const { from, to } = value
  const label =
    from && to ? `${day(from)} — ${day(to)}`
    : from ? `Desde ${day(from)}`
    : to ? `Hasta ${day(to)}`
    : placeholder

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel && `${ariaLabel}: ${label}`}
          className={cn(chooserTrigger, "justify-start font-normal", !from && !to && "text-muted-foreground", className)}
        >
          <span>{label}</span>
        </button>
      </PopoverTrigger>
      {/* No `overflow` and no height limit on the panel, on purpose. The month
          and year menus are lists that hang from the calendar and float over
          what is below; inside a box that scrolls they stop floating and grow
          its scroll area instead, shoving the days about. It was tried, so that
          two calendars stacked on a phone would always fit. */}
      <PopoverContent className="w-auto p-0" align={align}>
        {/* Mounted with the popover, so each opening starts on the months the
            period holds now rather than wherever the last visit left them. */}
        <PeriodCalendars value={value} onChange={onChange} max={max} />
      </PopoverContent>
    </Popover>
  )
}

function PeriodCalendars({ value, onChange, max }: Pick<DatePeriodPickerProps, "value" | "onChange" | "max">) {
  const { from, to } = value
  // The month each calendar shows is its own, which is the point: one can be
  // taken a year back while the other stays on last week.
  const [fromMonth, setFromMonth] = useState<Date>(from ?? to ?? max ?? new Date())
  const [toMonth, setToMonth] = useState<Date>(to ?? from ?? max ?? new Date())

  const afterMax: Matcher[] = max ? [{ after: max }] : []
  const menus = {
    captionLayout: "dropdown" as const,
    startMonth: new Date(currentYear - 100, 0),
    endMonth: max ?? new Date(currentYear + 10, 11),
    locale: es,
    // Closer to square. A month is seven cells wide and up to six rows tall
    // under a caption and a row of weekdays, so at the calendar's usual
    // spacing it stood half again as tall as wide — and there are two of them
    // side by side. The rows and the caption are drawn closer together here;
    // the cells keep their size, so nothing is harder to press.
    className: "[&_.rdp-month]:gap-2 [&_.rdp-week]:mt-1",
  }

  // On a phone one calendar at a time, under a pair of tabs. Both stood one
  // over the other there, and at a finger's cell size that is taller than the
  // screen, with the end's calendar below its edge — and the panel cannot
  // scroll (see above). Choosing the start moves on to the end, which is
  // nearly always what comes next.
  const isMobile = useIsMobile()
  const [end, setEnd] = useState<"inicio" | "fin">("inicio")

  const inicio = (
    <div role="group" aria-label="Inicio">
      <Calendar
        mode="single"
        selected={from}
        onSelect={(next) => {
          // Past the end, the end comes along — and its calendar with it, or
          // it would be left showing a month the period no longer touches.
          const pushed = !!next && !!to && isLaterDay(next, to)
          if (pushed) setToMonth(next)
          onChange({ from: next, to: pushed ? next : to })
          if (next) setEnd("fin")
        }}
        month={fromMonth}
        onMonthChange={setFromMonth}
        disabled={afterMax}
        {...menus}
      />
    </div>
  )
  const fin = (
    <div role="group" aria-label="Fin">
      <Calendar
        mode="single"
        selected={to}
        onSelect={(next) => onChange({ from, to: next })}
        month={toMonth}
        onMonthChange={setToMonth}
        // Not before the start. The start's own day is offered: a period of
        // one day is a period.
        disabled={from ? [{ before: from }, ...afterMax] : afterMax}
        {...menus}
      />
    </div>
  )

  if (isMobile) {
    return (
      <Tabs value={end} onValueChange={(v) => setEnd(v as "inicio" | "fin")} className="pt-2">
        <TabsList className="mx-2 w-[calc(100%-1rem)]">
          <TabsTrigger value="inicio">Inicio</TabsTrigger>
          <TabsTrigger value="fin">Fin</TabsTrigger>
        </TabsList>
        <TabsContent value="inicio">{inicio}</TabsContent>
        <TabsContent value="fin">{fin}</TabsContent>
      </Tabs>
    )
  }

  return (
    <div className="flex flex-row divide-x divide-border/60">
      {/* No heading over either. Start on the left and end on the right is
          the order the control itself reads in, and a heading on each made
          both taller. The name is kept for whoever cannot see the layout. */}
      {inicio}
      {fin}
    </div>
  )
}
