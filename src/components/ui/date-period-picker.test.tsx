// A period chosen in one control, with a calendar for each end.
//
// It is one control because a period is one thing: it reads "01/03/2026 —
// 20/03/2026" and takes one place in a header. It is two calendars inside
// because the two ends are often far apart. A range calendar draws two
// adjoining months that move together, with no way to jump: reaching a year
// back was twelve presses, twice. Here each end has its own calendar with its
// own month and year menus, and moving one leaves the other where it was.
//
// What two separate date fields could not do is keep the ends in order — the
// end could be set before the start, and the only sign was an empty list. So:
// the end's calendar does not offer a day before the start, and a start chosen
// past the end takes the end with it.

import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DatePeriodPicker, type DatePeriod } from "./date-period-picker";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const clave = (f: Date) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
const mismoDia = (a?: Date, b?: Date) => !!a && !!b && clave(a) === clave(b);

function Montado(props: { inicial?: DatePeriod; max?: Date; onChange?: (p: DatePeriod) => void }) {
  const [value, setValue] = useState<DatePeriod>(props.inicial ?? { from: d(2026, 3, 10), to: d(2026, 3, 20) });
  return (
    <DatePeriodPicker
      ariaLabel="Período"
      value={value}
      onChange={(p) => { setValue(p); props.onChange?.(p); }}
      max={props.max}
    />
  );
}

const abrir = () => fireEvent.click(screen.getByRole("button", { name: /^Período: / }));
const calendario = (cual: "Inicio" | "Fin") => screen.getByRole("group", { name: cual });
/** A day's button in one of the two calendars, or null when that calendar is not showing it. */
const boton = (cual: "Inicio" | "Fin", f: Date) =>
  calendario(cual).querySelector<HTMLButtonElement>(`[data-day="${clave(f)}"] button`);
/** The month and the year menu of a calendar, in that order. */
const menus = (cual: "Inicio" | "Fin") =>
  Array.from(calendario(cual).querySelectorAll<HTMLButtonElement>('button[aria-haspopup="listbox"]'));

describe("DatePeriodPicker", () => {
  it("says the whole period in one control", () => {
    render(<Montado />);

    expect(screen.getByRole("button", { name: "Período: 10/03/2026 — 20/03/2026" })).toBeTruthy();
  });

  it("opens a calendar for each end, each with its own month and year menus", () => {
    render(<Montado />);
    abrir();

    expect(menus("Inicio")).toHaveLength(2);
    expect(menus("Fin")).toHaveLength(2);
  });

  it("opens each calendar on its own end, however far apart they are", () => {
    render(<Montado inicial={{ from: d(2024, 1, 15), to: d(2026, 3, 20) }} />);
    abrir();

    expect(boton("Inicio", d(2024, 1, 15))).not.toBeNull();
    expect(boton("Fin", d(2026, 3, 20))).not.toBeNull();
  });

  it("moves one calendar a year back without moving the other", () => {
    render(<Montado />);
    abrir();

    fireEvent.click(menus("Inicio")[1]);
    fireEvent.click(within(calendario("Inicio")).getByRole("option", { name: "2024" }));

    expect(boton("Inicio", d(2024, 3, 15))).not.toBeNull();
    expect(boton("Inicio", d(2026, 3, 15))).toBeNull();
    // The end's calendar is where it was.
    expect(boton("Fin", d(2026, 3, 15))).not.toBeNull();
    expect(boton("Fin", d(2024, 3, 15))).toBeNull();
  });

  it("changes only the end it was asked to change", () => {
    const onChange = vi.fn();
    render(<Montado onChange={onChange} />);
    abrir();

    fireEvent.click(boton("Fin", d(2026, 3, 28))!);
    let p = onChange.mock.calls.at(-1)?.[0] as DatePeriod;
    expect([mismoDia(p.from, d(2026, 3, 10)), mismoDia(p.to, d(2026, 3, 28))]).toEqual([true, true]);

    fireEvent.click(boton("Inicio", d(2026, 3, 4))!);
    p = onChange.mock.calls.at(-1)?.[0] as DatePeriod;
    expect([mismoDia(p.from, d(2026, 3, 4)), mismoDia(p.to, d(2026, 3, 28))]).toEqual([true, true]);
  });

  it("does not offer an end before the start, but does offer the start's own day", () => {
    const onChange = vi.fn();
    render(<Montado onChange={onChange} />);
    abrir();

    expect(boton("Fin", d(2026, 3, 9))!.disabled).toBe(true);
    fireEvent.click(boton("Fin", d(2026, 3, 9))!);
    expect(onChange).not.toHaveBeenCalled();

    // A period of one day is a period.
    expect(boton("Fin", d(2026, 3, 10))!.disabled).toBe(false);
    fireEvent.click(boton("Fin", d(2026, 3, 10))!);
    const p = onChange.mock.calls.at(-1)?.[0] as DatePeriod;
    expect([mismoDia(p.from, d(2026, 3, 10)), mismoDia(p.to, d(2026, 3, 10))]).toEqual([true, true]);
  });

  it("takes the end along when the start is moved past it", () => {
    // Refusing the start instead would mean moving the end first to move the
    // period later — two steps in the one order that is not obvious.
    const onChange = vi.fn();
    render(<Montado onChange={onChange} />);
    abrir();

    fireEvent.click(boton("Inicio", d(2026, 3, 25))!);

    const p = onChange.mock.calls.at(-1)?.[0] as DatePeriod;
    expect([mismoDia(p.from, d(2026, 3, 25)), mismoDia(p.to, d(2026, 3, 25))]).toEqual([true, true]);
  });

  it("offers no day after the last one it is given, in either calendar", () => {
    render(<Montado max={d(2026, 3, 22)} />);
    abrir();

    for (const cual of ["Inicio", "Fin"] as const) {
      expect(boton(cual, d(2026, 3, 22))!.disabled).toBe(false);
      expect(boton(cual, d(2026, 3, 23))!.disabled).toBe(true);
    }
  });

  it("says which end is missing when only one is set, and that nothing limits it when neither is", () => {
    const { unmount } = render(<Montado inicial={{ from: d(2026, 3, 10), to: undefined }} />);
    expect(screen.getByRole("button", { name: "Período: Desde 10/03/2026" })).toBeTruthy();
    unmount();

    render(<Montado inicial={{ from: undefined, to: undefined }} />);
    expect(screen.getByRole("button", { name: "Período: Todo el período" })).toBeTruthy();
  });

  // The two calendars are told apart by where they are — start on the left, end
  // on the right, as the control itself reads — and by what each offers. A
  // heading over each said it a third time and made both taller than wide.
  it("writes no heading over either calendar, and still names each for whoever cannot see them", () => {
    render(<Montado />);
    abrir();

    expect(screen.queryByText("Inicio")).toBeNull();
    expect(screen.queryByText("Fin")).toBeNull();
    expect(calendario("Inicio").getAttribute("aria-label")).toBe("Inicio");
    expect(calendario("Fin").getAttribute("aria-label")).toBe("Fin");
  });

  it("is text alone: no icon on the control", () => {
    render(<Montado />);

    expect(screen.getByRole("button", { name: /^Período: / }).querySelector("svg")).toBeNull();
  });

  // The month and year menus are lists that hang from the calendar and float
  // over whatever is below. A box that scrolls or clips keeps them in: instead
  // of opening over the days, the list grew the panel's scroll area and pushed
  // everything about. The panel had been given `overflow-y-auto` so that two
  // calendars stacked on a phone would fit; the menus are used far more often
  // than that case arises.
  it("does not clip or scroll the panel, so the month and year menus open over it", () => {
    render(<Montado />);
    abrir();

    const panel = calendario("Inicio").closest('[data-slot="popover-content"]');
    expect(panel).not.toBeNull();
    const clases = (panel as HTMLElement).className.split(/\s+/);
    expect(clases.filter((c) => /^(overflow-|max-h-)/.test(c))).toEqual([]);
    // Nor any box between the panel and the calendars.
    for (let el = calendario("Inicio").parentElement; el && el !== panel; el = el.parentElement) {
      expect(el.className).not.toMatch(/overflow-/);
    }
  });
});

// Two calendars one over the other are taller than a phone, and the panel may
// not scroll — so there it shows one end at a time.
describe("DatePeriodPicker on a phone", () => {
  const ancho = window.innerWidth;
  beforeEach(() => { window.innerWidth = 360; });
  afterEach(() => { window.innerWidth = ancho; });

  it("shows one calendar at a time, under a tab for each end", () => {
    render(<Montado />);
    abrir();

    expect(screen.getByRole("tab", { name: "Inicio" })).toHaveAttribute("aria-selected", "true");
    expect(calendario("Inicio")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Fin" })).toBeNull();
  });

  it("moves on to the end once the start is chosen", async () => {
    const onChange = vi.fn();
    render(<Montado onChange={onChange} />);
    abrir();

    fireEvent.click(boton("Inicio", d(2026, 3, 12))!);

    expect(mismoDia((onChange.mock.calls.at(-1)?.[0] as DatePeriod).from, d(2026, 3, 12))).toBe(true);
    expect(screen.getByRole("tab", { name: "Fin" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(screen.queryByRole("group", { name: "Inicio" })).toBeNull());
    expect(calendario("Fin")).toBeTruthy();
  });
});
