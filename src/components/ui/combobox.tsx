import { useState, useRef } from "react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"

export interface ComboboxOption {
    value: string
    label: string
}

interface ComboboxProps {
    options: ComboboxOption[]
    value: string
    onValueChange: (value: string) => void
    placeholder?: string
    searchPlaceholder?: string
    className?: string
}

export function Combobox({
    options,
    value,
    onValueChange,
    placeholder = "Seleccionar...",
    searchPlaceholder = "Buscar...",
    className,
}: ComboboxProps) {
    const [search, setSearch] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    const selected = options.find((o) => o.value === value)
    const filtered = options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <Popover onOpenChange={(open) => { if (open) { setSearch(""); setTimeout(() => inputRef.current?.focus(), 0) } }}>
            <PopoverTrigger
                className={cn(
                    "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring active:translate-y-0",
                    !selected && "text-muted-foreground",
                    className
                )}
            >
                <span>{selected ? selected.label : placeholder}</span>
                <ChevronDownIcon className="h-4 w-4 opacity-50 shrink-0" />
            </PopoverTrigger>
            <PopoverContent className="w-(--anchor-width) p-0" align="start">
                {/* Search input */}
                <div className="flex items-center border-b border-border px-3">
                    <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground mr-2" />
                    <input
                        ref={inputRef}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="flex h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                </div>
                {/* Options list */}
                <div className="max-h-60 overflow-y-auto p-1">
                    {filtered.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">Sin resultados</p>
                    ) : (
                        filtered.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => onValueChange(option.value)}
                                className={cn(
                                    "relative flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                    option.value === value && "bg-accent text-accent-foreground"
                                )}
                            >
                                <span className="flex-1 text-left">{option.label}</span>
                                {option.value === value && (
                                    <CheckIcon className="h-4 w-4 shrink-0 ml-2" />
                                )}
                            </button>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
