import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { type DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
}

export function DateRangePicker({ value, onChange, placeholder = "Seleccionar rango", className }: DateRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start gap-2 font-normal", !value?.from && "text-muted-foreground", className)}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          {value?.from ? (
            value.to ? (
              <span>{format(value.from, "dd/MM/yyyy", { locale: es })} — {format(value.to, "dd/MM/yyyy", { locale: es })}</span>
            ) : (
              <span>{format(value.from, "dd/MM/yyyy", { locale: es })}</span>
            )
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          defaultMonth={value?.from}
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
          locale={es}
        />
      </PopoverContent>
    </Popover>
  )
}
