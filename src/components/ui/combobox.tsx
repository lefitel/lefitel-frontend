import { useState, useRef } from "react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { chooserTrigger } from "./control-surface"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"

export interface ComboboxOption {
    value: string
    label: string
    /**
     * A second text on the same line, in the muted tone, at the right of the
     * label: what tells two options with the same label apart. The search
     * looks in it too.
     */
    hint?: string
}

interface ComboboxProps {
    options: ComboboxOption[]
    value: string
    onValueChange: (value: string) => void
    placeholder?: string
    searchPlaceholder?: string
    className?: string
    /**
     * Accessible name for the trigger.
     *
     * The trigger shows the chosen value and nothing else, so on a screen with
     * several of these — a filter per row — every one of them is called the
     * same thing, or nothing at all, to anybody not looking at the layout.
     */
    ariaLabel?: string
    /** Shows the chosen value and does not open: a field whose value is not yours to change. */
    disabled?: boolean
    /**
     * An action that sits under the list and is not an option: it does not
     * choose anything and the list closes when it runs. It stays when the
     * search finds nothing, because that is when "create it" is wanted.
     */
    footer?: { label: string; onSelect: () => void }
}

export function Combobox({
    options,
    value,
    onValueChange,
    placeholder = "Seleccionar...",
    searchPlaceholder = "Buscar...",
    className,
    ariaLabel,
    disabled,
    footer,
}: ComboboxProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    const selected = options.find((o) => o.value === value)
    // `?? ""` against the type, on purpose. The options are built from rows the
    // server sends, and a row with no name — a role saved without one — arrives
    // as `label: null` whatever the interface says. Reading it here threw during
    // render, and with no error boundary above that is the whole screen gone,
    // from a control whose job was to list it.
    // The label and the hint are searched one by one, never joined: a joined
    // text lets a query match across the boundary between them, and gives an
    // option with no hint a trailing space that only that option had.
    const query = search.toLowerCase()
    const filtered = options.filter((o) =>
        (o.label ?? "").toLowerCase().includes(query) ||
        (o.hint ?? "").toLowerCase().includes(query)
    )

    return (
        <Popover open={open} onOpenChange={(abierto) => { setOpen(abierto); if (abierto) { setSearch(""); setTimeout(() => inputRef.current?.focus(), 0) } }}>
            <PopoverTrigger
                aria-label={ariaLabel}
                disabled={disabled}
                // The same skin as the select it stands in for: this is a
                // select with a search box, and the two sit in the same filter
                // row. It carried its own copy of the old outlined one — see
                // `chooserTrigger`.
                className={cn(
                    chooserTrigger,
                    !selected && "text-muted-foreground",
                    className
                )}
            >
                <span className="min-w-0 truncate">
                    {selected ? selected.label : placeholder}
                    {selected?.hint && (
                        <span data-combobox-hint className="ml-2 hidden text-muted-foreground sm:inline">{selected.hint}</span>
                    )}
                </span>
                <ChevronDownIcon className="h-4 w-4 opacity-50 shrink-0" />
            </PopoverTrigger>
            <PopoverContent className="w-auto min-w-(--radix-popover-trigger-width) p-0" align="start">
                {/* Search input */}
                <div className="flex items-center border-b border-border px-3">
                    <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground mr-2" />
                    <input
                        ref={inputRef}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="flex h-9 w-full bg-transparent text-base outline-none md:text-sm placeholder:text-muted-foreground"
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
                                {option.hint && (
                                    <span data-combobox-hint className="ml-3 shrink-0 text-muted-foreground">{option.hint}</span>
                                )}
                                {option.value === value && (
                                    <CheckIcon className="h-4 w-4 shrink-0 ml-2" />
                                )}
                            </button>
                        ))
                    )}
                </div>
                {footer && (
                    <div className="border-t border-border p-1">
                        <button
                            type="button"
                            onClick={() => { setOpen(false); footer.onSelect() }}
                            className="flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-sm font-medium outline-none hover:bg-accent hover:text-accent-foreground"
                        >
                            {footer.label}
                        </button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
