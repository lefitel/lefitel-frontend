import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { chooserTrigger } from "./control-surface"

interface DatePickerProps {
    value?: Date
    onSelect?: (date: Date | undefined) => void
    placeholder?: string
    className?: string
    /**
     * Accessible name for the trigger.
     *
     * Without one, the button is named by what it says — a date, or the word
     * "Seleccionar fecha" — which tells somebody listening what it holds and
     * never which field it belongs to. Every caller that sits in a labelled
     * form row can leave it out; the ones that stand alone in a filter row
     * cannot.
     */
    ariaLabel?: string
}

const currentYear = new Date().getFullYear()

export function DatePicker({ value, onSelect, placeholder = "Seleccionar fecha", className, ariaLabel }: DatePickerProps) {
    return (
        <Popover>
            <PopoverTrigger
                // The name carries the value, not only the field.
                //
                // `aria-label` wins over the element's own text in the
                // accessible-name computation, so naming this "Valor para
                // Fecha del evento" replaced the date it shows: the control it
                // took over from was an `<input type="date">`, which exposed
                // the label *and* the value, because an input's value is a
                // separate property. A button has no such thing. Somebody
                // listening was left with no way to learn what the filter holds
                // without opening the calendar and hunting for the marked day.
                aria-label={ariaLabel && `${ariaLabel}: ${value ? format(value, "dd/MM/yyyy", { locale: es }) : placeholder}`}
                // Same skin as the select and the combobox: it opens something
                // to choose from, so it is one of those. It carried its own
                // copy of the old outlined one — see `chooserTrigger`.
                className={cn(
                    chooserTrigger,
                    !value && "text-muted-foreground",
                    className
                )}
            >
                <span>{value ? format(value, "dd/MM/yyyy", { locale: es }) : placeholder}</span>
                <ChevronDownIcon className="h-4 w-4 opacity-50" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={value}
                    onSelect={onSelect}
                    defaultMonth={value}
                    captionLayout="dropdown"
                    startMonth={new Date(currentYear - 100, 0)}
                    endMonth={new Date(currentYear + 10, 11)}
                    locale={es}
                />
            </PopoverContent>
        </Popover>
    )
}
