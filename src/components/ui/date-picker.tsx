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

interface DatePickerProps {
    value?: Date
    onSelect?: (date: Date | undefined) => void
    placeholder?: string
    className?: string
}

const currentYear = new Date().getFullYear()

export function DatePicker({ value, onSelect, placeholder = "Seleccionar fecha", className }: DatePickerProps) {
    return (
        <Popover>
            <PopoverTrigger
                className={cn(
                    "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring active:translate-y-0",
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
