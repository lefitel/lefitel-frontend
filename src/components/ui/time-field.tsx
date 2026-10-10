import { useRef, useState } from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { horaComoTexto, leerHora } from "@/lib/envios"
import { Input } from "./input"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./popover"

/**
 * A time of day, to the minute: a box to type it in, and the hours on the dot
 * one click away.
 *
 * It was a select of twenty-four hours. The list stays because most schedules
 * are on the dot and picking is quicker than typing; the box is there for the
 * one that is not.
 *
 * Twenty-four-hour text and not `<input type="time">`: the native one shows
 * AM/PM or not according to the machine it runs on, and everything else on the
 * screen says "07:00".
 *
 * **What is typed counts as soon as it reads as a time**, not when the box is
 * left: Intro saves the form without a blur, and would otherwise save the time
 * from before. The price is that "25:99" passes through "2" on its way to
 * being nonsense, so leaving the box with something that is not a time puts
 * back the time it held when it was entered — not the last prefix that happened
 * to read as one.
 */

interface TimeFieldProps {
  id?: string
  hora: number
  minuto: number
  onChange: (hora: number, minuto: number) => void
  disabled?: boolean
  className?: string
}

const HORAS_EN_PUNTO = Array.from({ length: 24 }, (_, i) => i)

export function TimeField({ id, hora, minuto, onChange, disabled, className }: TimeFieldProps) {
  // `null` while nobody is typing: the box then shows the value it was given.
  const [tecleado, setTecleado] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const alEntrar = useRef({ hora, minuto })

  const noEsUnaHora = tecleado !== null && leerHora(tecleado) === null

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverAnchor asChild>
        <div className={cn("relative", className)}>
          <Input
            id={id}
            inputMode="numeric"
            autoComplete="off"
            placeholder="HH:MM"
            disabled={disabled}
            aria-invalid={noEsUnaHora || undefined}
            className="pr-9 tabular-nums"
            value={tecleado ?? horaComoTexto(hora, minuto)}
            onChange={(e) => {
              setTecleado(e.target.value)
              const leida = leerHora(e.target.value)
              if (leida) onChange(leida.hora, leida.minuto)
            }}
            onFocus={() => { alEntrar.current = { hora, minuto } }}
            onBlur={() => {
              if (noEsUnaHora) onChange(alEntrar.current.hora, alEntrar.current.minuto)
              setTecleado(null)
            }}
          />
          <PopoverTrigger
            type="button"
            disabled={disabled}
            aria-label="Elegir una hora en punto"
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-28 p-1">
        <div role="listbox" aria-label="Horas en punto" className="max-h-60 overflow-y-auto">
          {HORAS_EN_PUNTO.map((h) => {
            const elegida = h === hora && minuto === 0
            return (
              <button
                key={h}
                type="button"
                role="option"
                aria-selected={elegida}
                onClick={() => {
                  setTecleado(null)
                  onChange(h, 0)
                  setAbierto(false)
                }}
                className={cn(
                  "flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-sm tabular-nums outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent",
                  elegida && "bg-accent text-accent-foreground",
                )}
              >
                {horaComoTexto(h, 0)}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
