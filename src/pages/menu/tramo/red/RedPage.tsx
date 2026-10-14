import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeftIcon } from "lucide-react";
import { SesionContext } from "../../../../context/SesionContext";
import { can } from "../../../../lib/permissions";
import type { LatLng } from "../../../../components/map/mapGeo";
import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import EstadoTramos from "../EstadoTramos";
import RedMap from "./RedMap";
import RedPanel from "./RedPanel";
import { ESTADO_INICIAL, reducir, tramosDeCiudad, type EstadoRed } from "./redEstado";
import CiudadFlotante from "./CiudadFlotante";
import TramoRail from "./TramoRail";
import { VISTA_PANEL_ID, type VistaTramo } from "./tramoVistas";
import { SIN_FILTROS, ciudadesDelMapa, type FiltrosLista } from "./filtrosLista";
import { useRedData, usePostesDelTramo } from "./useRedData";
import { useRutaDelTramo } from "./useRutaDelTramo";
import { HeaderSlot } from "../../../../components/HeaderSlot";
import { useTrailLabel } from "../../../../components/TrailLabel";

/** An id in the address: a plain whole number, or nothing. */
function idDeDireccion(valor: string | null): number | null {
  if (valor === null || !/^\d+$/.test(valor)) return null;
  const n = Number(valor);
  return Number.isSafeInteger(n) ? n : null;
}

/** Where the screen lives. A tramo's card is one step under it. */
const RAIZ = "/app/tramos";

/** The sentence under the map for what the person is doing now; nothing while just looking. */
function ayudaDe({ modo, elegidas }: EstadoRed): string | null {
  if (modo === "ciudadNueva") return "Pincha en el mapa donde va la ciudad nueva.";
  if (modo === "tramoNuevo") {
    return ["Pincha dos ciudades para trazar el tramo.", "Pincha la otra ciudad.", "Revisa el tramo en la tarjeta y guarda."][elegidas.length] ?? null;
  }
  return null;
}

/** Whether a dialog (a sheet, an alert) is open: Esc then belongs to it. */
const hayDialogoAbierto = () => document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;

/** What a popup is made of: Esc inside one closes the popup, not the tool. */
const DENTRO_DE_POPUP = '[role="listbox"], [role="menu"], [role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]';
const estaEnPopup = (el: EventTarget | null) => el instanceof Element && el.closest(DENTRO_DE_POPUP) !== null;

/**
 * The Tramos screen as a map of the whole network: the map, the card at its
 * right, and the address as the source of what is selected. The map draws and
 * reports clicks; this page decides what each click means in each mode.
 */
export default function RedPage() {
  const { sesion } = useContext(SesionContext);
  const rol = sesion.usuario.id_rol;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { id: idDeRuta } = useParams();
  const { estado: carga, tramos, ciudades, departamentos, recargando, recargar } = useRedData();
  const [estado, despachar] = useReducer(reducir, ESTADO_INICIAL);
  const { modo } = estado;
  // Whether the card has a save in flight: until it answers the person cannot
  // abandon the view that sent it by accident (Esc, a tool, a click on the map).
  const [ocupado, setOcupado] = useState(false);
  // Set in the card's list, and kept here because the map follows it too.
  const [filtros, setFiltros] = useState<FiltrosLista>(SIN_FILTROS);

  const puedeTramo = can(rol, "tramos", "crear");

  // The address says what is on screen, in three shapes:
  //
  //   /app/tramos              the list
  //   /app/tramos?tramo=52     the list, with that tramo selected and drawn
  //   /app/tramos/52           that tramo's card
  //   /app/tramos?ciudad=7     that city's card
  //
  // A tramo's card is a path of its own, as a pole's sheet is, so the trail in
  // the header can name it; a selection is only a mark on the list, and stays a
  // parameter. The tramo wins when the address carries a city as well.
  const tramoDeRuta = idDeDireccion(idDeRuta ?? null);
  const enDetalle = idDeRuta !== undefined;
  const tramoDeConsulta = idDeDireccion(params.get("tramo"));
  const ciudadDeDireccion = idDeDireccion(params.get("ciudad"));
  const tramoSel = enDetalle ? tramoDeRuta : tramoDeConsulta;
  const detalle = enDetalle && tramoSel !== null;
  const ciudadSel = tramoSel === null ? ciudadDeDireccion : null;

  // The parameters as they are now, for callbacks that must not be made again
  // every time the address moves: the map keeps the ones it was given.
  const paramsActuales = useRef(params);
  useEffect(() => { paramsActuales.current = params; }, [params]);

  /** Goes to the list, or to a tramo's card, with the parameters `cambiar` leaves. */
  const irA = useCallback((detalleDe: number | null, cambiar: (p: URLSearchParams) => void, replace = false) => {
    const siguientes = new URLSearchParams(paramsActuales.current);
    cambiar(siguientes);
    const consulta = siguientes.toString();
    navigate(
      { pathname: detalleDe === null ? RAIZ : `${RAIZ}/${detalleDe}`, search: consulta ? `?${consulta}` : "" },
      { replace },
    );
  }, [navigate]);

  // An id the data does not hold is dropped from the address, but only once the
  // data is settled: right after a save the new id is selected before the reload
  // brings it in, and that moment must not look like a mistake.
  const asentada = carga === "lista" && !recargando;
  const conocido = (id: number | null) => id !== null && tramos.some((t) => t.id === id);
  const rutaDesconocida = enDetalle && !conocido(tramoDeRuta);
  const tramoDesconocido = !enDetalle && params.has("tramo") && !conocido(tramoDeConsulta);
  const ciudadDesconocida = params.has("ciudad")
    && (ciudadDeDireccion === null || !ciudades.some((c) => c.id === ciudadDeDireccion));
  useEffect(() => {
    if (!asentada || (!rutaDesconocida && !tramoDesconocido && !ciudadDesconocida)) return;
    // A card for a tramo that is not there has nothing to show: back to the list.
    irA(rutaDesconocida ? null : (enDetalle ? tramoDeRuta : null), (p) => {
      if (tramoDesconocido) p.delete("tramo");
      if (ciudadDesconocida) p.delete("ciudad");
    }, true);
  }, [asentada, rutaDesconocida, tramoDesconocido, ciudadDesconocida, enDetalle, tramoDeRuta, irA]);

  // Without `replace`, so that "back" undoes a selection. Always to the list:
  // a new selection is never an open card, which is asked for on its own.
  const seleccionar = useCallback((sel: { tramo: number } | { ciudad: number } | null) => {
    irA(null, (p) => {
      p.delete("tramo");
      p.delete("ciudad");
      if (sel && "tramo" in sel) p.set("tramo", String(sel.tramo));
      if (sel && "ciudad" in sel) p.set("ciudad", String(sel.ciudad));
    });
  }, [irA]);

  // Without `replace` either, so that "back" closes the card it opened. With an
  // id it opens that tramo's card, whichever row was the selected one. With null
  // the card closes and its tramo stays the selected row of the list.
  const verDetalle = useCallback((tramo: number | null) => {
    if (tramo !== null) {
      irA(tramo, (p) => { p.delete("tramo"); p.delete("ciudad"); });
      return;
    }
    irA(null, (p) => {
      p.delete("ciudad");
      if (tramoSel !== null) p.set("tramo", String(tramoSel));
    });
  }, [irA, tramoSel]);

  // The one tool the screen has, on the list's title row. The list is only on
  // screen with nothing selected and no mode entered, so there is nothing to
  // back out of first; the address is cleared all the same, for a selection the
  // data does not hold yet.
  const nuevoTramo = useCallback(() => {
    if (ocupado) return;
    despachar({ tipo: "modo", modo: "tramoNuevo" });
    seleccionar(null);
  }, [ocupado, seleccionar]);

  // Esc backs out of a mode, unless something else took it: a popup that
  // consumed it (Radix prevents the default of the Escape that closes its select or
  // menu), a popup that holds focus, an open dialog, or a save in flight.
  const hayQueTerminar = modo !== "seleccionar" && !ocupado;
  useEffect(() => {
    if (!hayQueTerminar) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || hayDialogoAbierto()) return;
      if (estaEnPopup(e.target) || estaEnPopup(document.activeElement)) return;
      // One step back, as the card's own button: the city a tramo lacks is a
      // step of that tramo, and Esc there must not throw the tramo away too.
      despachar(modo === "ciudadNueva" ? { tipo: "volverAlTramo" } : { tipo: "terminar" });
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [hayQueTerminar, modo]);

  // What a click means. With a save in flight none does anything: what was sent
  // must stay what is on screen.
  const alCiudad = useCallback((id: number) => {
    if (ocupado) return;
    if (modo === "seleccionar") seleccionar({ ciudad: id });
    else if (modo === "tramoNuevo") despachar({ tipo: "elegir", id });
  }, [ocupado, modo, seleccionar]);
  const alMapa = useCallback((punto: LatLng) => {
    if (ocupado || modo !== "ciudadNueva") return;
    despachar({ tipo: "borrador", punto });
  }, [ocupado, modo]);
  const alVerPoste = useCallback((id: number) => navigate(`/app/postes/${id}`), [navigate]);

  // The poles of an id the address carries are not asked for until that tramo is known to exist.
  const tramoConocido = tramoSel !== null && tramos.some((t) => t.id === tramoSel);
  const { postes, cargando: cargandoPostes } = usePostesDelTramo(tramoConocido ? tramoSel : null, can(rol, "postes", "ver"));
  // Its road, drawn while it is the selected one: asked once the poles are in.
  const ruta = useRutaDelTramo({
    tramo: tramoConocido ? tramos.find((t) => t.id === tramoSel) : undefined,
    ciudades,
    postes,
    cargandoPostes,
  });

  // A pressed city opens a card that floats over it on the map: read there, and
  // changed on its own sheet. Only while just looking — a city pressed while a
  // tramo is being drawn is being picked for it, not looked at.
  const ciudadAbierta = modo !== "seleccionar" || ciudadSel === null
    ? undefined
    : ciudades.find((c) => c.id === ciudadSel);
  const cerrarCiudad = useCallback(() => seleccionar(null), [seleccionar]);
  const tramoDesde = useCallback((ciudad: number) => {
    despachar({ tipo: "modo", modo: "tramoNuevo", desde: ciudad });
    seleccionar(null);
  }, [seleccionar]);

  // The card and the list get every city; only the map is narrowed.
  const ciudadesVisibles = useMemo(
    () => ciudadesDelMapa({ tramos, ciudades, filtros, estado, tramoSel, ciudadSel }),
    [tramos, ciudades, filtros, estado, tramoSel, ciudadSel],
  );

  const ayuda = ayudaDe(estado);
  // The card of a tramo that is open has a rail beside it, as the pole's sheet
  // has: it chooses what the card shows. Kept with the tramo it was chosen for,
  // so another tramo's card opens on its summary and not on the last one's view.
  const [vistaDe, setVistaDe] = useState<{ tramo: number; vista: VistaTramo } | null>(null);
  const puedeVer = {
    postes: can(rol, "postes", "ver"),
    pendientes: can(rol, "eventos", "ver"),
    bitacora: can(rol, "bitacora", "ver"),
  };
  // No rail for a role that may open none of the three: a strip with the
  // summary alone would choose between one thing.
  const conRail = detalle && tramoConocido && (puedeVer.postes || puedeVer.pendientes || puedeVer.bitacora);
  const elegida = conRail && vistaDe?.tramo === tramoSel ? vistaDe.vista : "resumen";
  // A view this role may not open is never shown, whatever was chosen before.
  const vista: VistaTramo = elegida === "resumen" || puedeVer[elegida] ? elegida : "resumen";
  const tramoAbierto = conRail ? tramos.find((t) => t.id === tramoSel) : undefined;

  // The trail in the app's header says «Tramo #52», which is all the address
  // knows; with the card open it is told the tramo's name.
  useTrailLabel(detalle ? tramos.find((t) => t.id === tramoSel)?.nombre : null);

  // A third column for the rail, only while there is one: the map keeps the room otherwise.
  const rejillaBase = "grid grid-cols-1 gap-page lg:flex-1 lg:min-h-0 lg:grid-rows-[minmax(0,1fr)]";
  const rejilla = `${rejillaBase} ${conRail ? "lg:grid-cols-[minmax(0,1fr)_24rem_auto]" : "lg:grid-cols-[minmax(0,1fr)_24rem]"}`;

  return (
    // Two columns from `lg` up, as the pole sheet: the page takes the height the
    // shell leaves it and the card scrolls on its own. Below `lg` they stack.
    <div className="w-full p-page flex flex-col gap-page lg:flex-1 lg:min-h-0 animate-in fade-in duration-500">
      <h1 className="sr-only">Tramos</h1>
      <HeaderSlot>
        <EstadoTramos actual="activos" />
      </HeaderSlot>
      {/* The way out of a tramo's card, left of the trail in the app's header:
          the trail there says «Tramos › Tramo #52», and this is the step back
          it implies. It closes the card and leaves that tramo the selected
          row, which the trail's own «Tramos» link does not. */}
      {detalle && (
        <HeaderSlot side="start">
          {/* The size and skin of the button it sits beside, the one that
              folds the sidebar: a ghost icon button narrowed to `size-7`. A
              size up, the two read as controls from different sets. */}
          <Button variant="ghost" size="icon" className="size-7" aria-label="Volver a la lista" onClick={() => verDetalle(null)}>
            <ChevronLeftIcon />
          </Button>
        </HeaderSlot>
      )}

      {carga === "cargando" && (
        <div className={rejilla}>
          <Skeleton className="h-80 sm:h-104 lg:h-full min-h-0 rounded-xl" />
          <Skeleton className="h-64 lg:h-full min-h-0 rounded-xl" />
        </div>
      )}

      {carga === "fallo" && (
        <Card className="items-start gap-3 p-6">
          <p className="text-sm">No se pudo cargar la red de tramos.</p>
          <Button variant="outline" size="sm" onClick={() => void recargar()}>Reintentar</Button>
        </Card>
      )}

      {carga === "lista" && (
        <div className={rejilla}>
          {/* Shorter on a phone, where it is the top of a page that scrolls:
              at 416px it was the whole screen, with no sign of a list below. */}
          <div className="relative isolate h-80 sm:h-104 lg:h-full min-h-0 overflow-hidden rounded-xl border border-border/60">
            <RedMap
              tramos={tramos}
              ciudades={ciudadesVisibles}
              tramoSel={tramoSel}
              ciudadSel={ciudadSel}
              postes={postes}
              estado={estado}
              ruta={ruta}
              onCiudad={alCiudad}
              onMapa={alMapa}
              onVerPoste={alVerPoste}
              onCerrarCiudad={cerrarCiudad}
              ciudadFlotante={ciudadAbierta && (
                <CiudadFlotante
                  ciudad={ciudadAbierta}
                  tramos={tramosDeCiudad(tramos, ciudadAbierta.id)}
                  onTramo={(id) => seleccionar({ tramo: id })}
                  onTramoDesdeAqui={puedeTramo ? () => tramoDesde(ciudadAbierta.id) : undefined}
                  puedeVerFicha={can(rol, "ciudades", "ver")}
                />
              )}
            />

            <div aria-live="polite" className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-1000">
              {ayuda && (
                <p className="rounded-xl border border-border/60 bg-background/90 px-3 py-2 text-[13px] shadow-sm supports-backdrop-filter:backdrop-blur-sm">
                  {ayuda}
                </p>
              )}
            </div>
          </div>

          <Card
            // The rail's tabs point here; a region, as it always was, because
            // it is also the list and the two cards of a new tramo.
            id={conRail ? VISTA_PANEL_ID : undefined}
            role="region"
            aria-label="Detalle de la red"
            // Last on a phone, after the rail: in one column the rail came
            // under the whole card, far from what it switches. Between the map
            // and the card it sits where it does on every other sheet.
            className="shadow-sm border-muted/60 bg-muted/40 p-3 block min-h-0 lg:overflow-y-auto max-lg:order-last"
          >
            <RedPanel
              tramos={tramos}
              ciudades={ciudades}
              departamentos={departamentos}
              tramoSel={tramoSel}
              estado={estado}
              despachar={despachar}
              onSeleccionar={seleccionar}
              recargar={recargar}
              onOcupado={setOcupado}
              filtros={filtros}
              setFiltros={setFiltros}
              onNuevoTramo={puedeTramo ? nuevoTramo : undefined}
              detalle={detalle}
              onDetalle={verDetalle}
              vista={vista}
              postes={postes}
              cargandoPostes={cargandoPostes}
            />
          </Card>

          {conRail && tramoSel !== null && (
            <TramoRail
              vista={vista}
              onVista={(v) => setVistaDe({ tramo: tramoSel, vista: v })}
              canVerPostes={puedeVer.postes}
              canVerEventos={puedeVer.pendientes}
              canVerBitacora={puedeVer.bitacora}
              postes={tramoAbierto?.postes}
              pendientes={tramoAbierto?.pendientes}
            />
          )}
        </div>
      )}
    </div>
  );
}
