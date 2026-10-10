import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { getPosteByTramo } from "../../../api/Poste.api";
import { fetchOrsRoute } from "../../../lib/orsRoute";
import { extremosCreibles, ordenarTramo } from "../../../lib/tramoOrden";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { PosteInterface } from "../../../interfaces/interfaces";
import {
  estadoTrasFallo, getOpcionesPoste, EstadoOpciones, OpcionCiudad, OpcionesPoste, OpcionSimple,
} from "../../../api/opciones.api";
import { getAdssPoste } from "../../../api/AdssPoste.api";
import { uploadImage } from "../../../api/Upload.api";
import { createPoste, editPoste } from "../../../api/Poste.api";
import { mensajeDeError } from "../../../api/descarga";
import { posteExample, latExample, lngExample } from "../../../data/example";
import { imageUrl } from "../../../lib/imageUrl";
import { DatePicker } from "../../ui/date-picker";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Combobox } from "../../ui/combobox";
import { Skeleton } from "../../ui/skeleton";
import FormDialog from "../FormDialog";
import CoordInputs from "../../map/CoordInputs";
import BaseMap from "../../map/BaseMap";
import MapPoint from "../../map/MapPoint";
import MapLine from "../../map/MapLine";
import { FitView } from "../../map/useFitCoords";
import { fromLatLngTuple, type LatLng, hasCoords } from "../../map/mapGeo";
import MapSearch from "../../map/MapSearch";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { SonarMarker } from "../../map/SonarMarker";
import { MAP_RADIUS, MAP_DOT } from "../../map/mapConstants";
import { ImageDropzone } from "../../ui/image-dropzone";
import { cn } from "../../../lib/utils";

/** One titled block of the form: what it is about, then its fields. */
function Grupo({ titulo, extra, children }: { titulo: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
        {extra && <span className="font-medium normal-case tracking-normal text-primary">{extra}</span>}
      </h3>
      {children}
    </section>
  );
}

interface Props {
  poste?: PosteInterface | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}

export default function PosteSheet({ poste, open, setOpen, onSuccess }: Props) {
  const isEditing = !!poste?.id;
  const { sesion } = useContext(SesionContext);
  const canEdit = !isEditing || can(sesion.usuario.id_rol, "postes", "editar");

  const [data, setData] = useState<PosteInterface>({ ...posteExample });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [adssSelected, setAdssSelected] = useState<number[]>([]);
  /** The ADSS the pole arrived with. What `adssSelected` is compared against to know if anything changed. */
  const [adssInicial, setAdssInicial] = useState<number[]>([]);

  const [listAdss, setListAdss] = useState<OpcionSimple[]>([]);
  const [listCiudad, setListCiudad] = useState<OpcionCiudad[]>([]);
  const [listMaterial, setListMaterial] = useState<OpcionSimple[]>([]);
  const [listPropietario, setListPropietario] = useState<OpcionSimple[]>([]);

  const [tramoPostes, setTramoPostes] = useState<PosteInterface[]>([]);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);

  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /**
   * Why the four lists are missing, when they are.
   *
   * Without this the sheet has no way to tell "you may not open this form" from
   * "the request did not arrive", and it showed the same four-second toast for
   * both — after which the four dropdowns sat empty and the ADSS block read
   * **"Sin ADSS registradas"**, a sentence that states as fact something the
   * screen has no idea about.
   *
   * The lists now come from `/api/poste/options`, which asks for `postes.ver`.
   * From `/app/postes` and `/app/postes/:id` that is already guaranteed —
   * `<ModuleRoute modulo="postes">` redirects without it — so the refusal is
   * reachable from exactly one place: **the home screen**, which requires
   * `eventos.ver` and opens this sheet behind `postes.editar` alone. A role
   * with those two and without `postes.ver` reaches a form it cannot fill.
   *
   * Nothing in the form can be saved without the lists anyway — all four are
   * required fields — so the honest answer is to say so and disable saving,
   * rather than leave somebody clicking a button that validates and stops.
   */
  const [estadoOpciones, setEstadoOpciones] = useState<EstadoOpciones>("cargando");


  useEffect(() => {
    if (poste) setData(poste);
  }, [poste]);

  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    setEstadoOpciones("cargando");

    const setLists = (opciones: OpcionesPoste) => {
      setListAdss(opciones.adss);
      setListCiudad(opciones.ciudad);
      setListMaterial(opciones.material);
      setListPropietario(opciones.propietario);
    };

    // One request where there were four. The ADSS a pole already carries is a
    // different question — about this pole, not about the catalogue — so it
    // travels beside the catalogue and, since its own audit, with **its own**
    // `catch`: sharing one emptied four lists that had arrived perfectly well
    // whenever `getAdssPoste` failed, and blamed the catalogues for it.
    const opciones = getOpcionesPoste()
      .then((o) => {
        setLists(o);
        setEstadoOpciones("listas");
      })
      .catch((error) => {
        setListAdss([]);
        setListCiudad([]);
        setListMaterial([]);
        setListPropietario([]);
        setEstadoOpciones(estadoTrasFallo(error));
      });

    if (!isEditing) {
      setData({ ...posteExample });
      setAdssSelected([]);
    }
    setAdssInicial([]);

    // Silent when the catalogues were already refused: since C5 both this and
    // `/api/poste/options` ask for `postes.ver`, so one refusal produces both
    // failures, and the sentence the sheet already shows on screen — "no tiene
    // permiso para consultar los catálogos de postes" — is the true one. A
    // second toast contradicting it would be this file answering a question
    // the screen has already answered better.
    const propios = isEditing && poste?.id
      ? getAdssPoste(poste.id as number)
        .then((adssP) => {
          const ids = adssP.map((a) => a.id_adss as number);
          setAdssSelected(ids);
          setAdssInicial(ids);
        })
        .catch((error) => {
          setAdssSelected([]);
          // `"fallo"`, the one outcome that is not a refusal. This read
          // `"listas"`, which `estadoTrasFallo` never answers, so the toast
          // below was dead and the unticked boxes went unexplained.
          if (estadoTrasFallo(error) === "fallo") {
            toast.error("No se pudo cargar el ADSS de este poste");
          }
        })
      : Promise.resolve();

    Promise.all([opciones, propios]).finally(() => setLoadingData(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, poste?.id]);

  useEffect(() => {
    if (!open || !isEditing || !listCiudad.length || !poste?.id_ciudadA || !poste?.id_ciudadB) return;
    const a = listCiudad.find((c) => c.id === poste.id_ciudadA);
    const b = listCiudad.find((c) => c.id === poste.id_ciudadB);
    if (!a?.lat || !a?.lng || !b?.lat || !b?.lng) return;

    setTramoPostes([]);
    setRoutePath([]);

    getPosteByTramo(poste.id_ciudadA, poste.id_ciudadB)
      .then((postes) => {
        const tramo = ordenarTramo(postes, a, b);
        setTramoPostes(tramo.postes);
        fetchOrsRoute(tramo.waypoints)
          .then((route) => setRoutePath(route ?? tramo.linea))
          .catch(() => setRoutePath(tramo.linea));
      })
      .catch(() => { });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listCiudad, poste?.id_ciudadA, poste?.id_ciudadB]);

  const handleClose = () => {
    setImageFile(null);
    setAdssSelected([]);
    setTramoPostes([]);
    setRoutePath([]);
    setErrors({});
    setOpen(false);
  };

  const toggleAdss = (id: number) => {
    setAdssSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleGuardar = async () => {
    const newErrors: Record<string, string> = {};
    if (!data.name.trim()) newErrors.name = "El número del poste es requerido";
    if (!data.id_ciudadA || !data.id_ciudadB) newErrors.tramo = "Selecciona el tramo completo (inicio y fin)";
    else if (data.id_ciudadA === data.id_ciudadB) newErrors.tramo = "El inicio y fin no pueden ser la misma ciudad";
    if (!data.id_material) newErrors.material = "Selecciona el material";
    if (!data.id_propietario) newErrors.propietario = "Selecciona el propietario";
    if (adssSelected.length === 0) newErrors.adss = "Selecciona al menos un ADSS";
    if (!isEditing && !imageFile) newErrors.image = "La imagen del poste es requerida";
    if (!data.lat || !data.lng) newErrors.location = "Selecciona una ubicación en el mapa";
    // A value is not a place. The two boxes take whatever is typed, and a
    // decimal point left out went straight to the table: a latitude of minus
    // twenty-two thousand million, on a pole that then cost its whole stretch
    // the road route. The server refuses it too; said here, it is said beside
    // the box that has it.
    else if (!hasCoords(data)) {
      newErrors.location =
        "Esa ubicación no existe: la latitud va de -90 a 90 y la longitud de -180 a 180. Revise el punto decimal.";
    }
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      let payload = { ...data, adss_ids: adssSelected };

      if (imageFile) {
        const subida = await uploadImage(imageFile);
        if (!subida.ok) { toast.error(subida.message); return; }
        payload = { ...payload, image: subida.path };
      }

      if (isEditing) {
        await editPoste(payload);
        toast.success("Poste actualizado");
      } else {
        payload = { ...payload, id_usuario: sesion.usuario.id ?? 0 };
        await createPoste(payload);
        toast.success("Poste creado correctamente");
      }

      handleClose();
      onSuccess();
    } catch (error) {
      // Una sola salida para las dos ramas, y con la frase del servidor: el
      // rechazo típico aquí es un nombre de poste ya usado en esa ciudad, y
      // «Ocurrió un error al guardar» mandaba a la persona a revisar el
      // formulario entero sin decirle qué campo mirar.
      toast.error(mensajeDeError(error, "Ocurrió un error al guardar"));
    } finally {
      setSaving(false);
    }
  };

  const ciudadA = listCiudad.find((c) => c.id === (poste?.id_ciudadA ?? data.id_ciudadA));
  const ciudadB = listCiudad.find((c) => c.id === (poste?.id_ciudadB ?? data.id_ciudadB));
  const allCoords: LatLng[] = isEditing ? [
    // Only the cities that lie near the stretch: one kept at a placeholder
    // position would have the map frame half the globe.
    ...extremosCreibles(tramoPostes, ciudadA, ciudadB),
    ...(hasCoords(data) ? [{ lat: data.lat, lng: data.lng }] : []),
    ...tramoPostes.filter(hasCoords).map((p) => ({ lat: p.lat, lng: p.lng })),
  ] : [];

  const soloLectura = isEditing && !canEdit;

  /** Whether closing now would lose something typed. The frame asks before it does. */
  const base = isEditing ? poste! : posteExample;
  const cambiado =
    data.name !== base.name
    || new Date(data.date).getTime() !== new Date(base.date).getTime()
    || data.id_propietario !== base.id_propietario
    || data.id_material !== base.id_material
    || data.id_ciudadA !== base.id_ciudadA
    || data.id_ciudadB !== base.id_ciudadB
    || data.lat !== base.lat
    || data.lng !== base.lng
    || !!imageFile
    || [...adssSelected].sort().join() !== [...adssInicial].sort().join();

  const faltan = [
    !data.name.trim() && "Número",
    !data.id_propietario && "Propietario",
    !data.id_material && "Material",
    (!data.id_ciudadA || !data.id_ciudadB) && "Tramo",
    adssSelected.length === 0 && "Ferretería",
    (!data.lat || !data.lng) && "Ubicación",
    !isEditing && !imageFile && "Foto",
  ].filter((c): c is string => !!c);

  const nombreA = listCiudad.find((c) => c.id === data.id_ciudadA)?.name;
  const nombreB = listCiudad.find((c) => c.id === data.id_ciudadB)?.name;

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      size="wide"
      title={isEditing ? `Editar poste ${data.name}`.trim() : "Nuevo poste"}
      description={
        soloLectura
          ? "Solo lectura: tu rol puede ver los postes, no editarlos."
          : nombreA && nombreB
            ? `Tramo ${nombreA} — ${nombreB}`
            : "Completa los datos para registrar un poste en la red."
      }
      dirty={!soloLectura && cambiado}
      missing={faltan}
      saving={saving}
      submitLabel={isEditing ? "Guardar cambios" : "Crear poste"}
      onSubmit={soloLectura ? undefined : () => void handleGuardar()}
      submitDisabled={loadingData || estadoOpciones !== "listas"}
      bodyClassName="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start"
    >
      {/* ── Left: what the pole is ── */}
      <div className="space-y-6 min-w-0">
        {(estadoOpciones === "denegado" || estadoOpciones === "fallo") && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
            <p className="text-sm text-destructive">
              {estadoOpciones === "denegado"
                ? "No tiene permiso para consultar los catálogos de postes, así que este formulario no se puede completar."
                : "No se pudieron cargar los catálogos. Cierre y vuelva a abrir para reintentarlo."}
            </p>
          </div>
        )}

        <Grupo titulo="Identificación">
          {isEditing && (
            <p className="text-xs text-muted-foreground">
              ID {data.id ?? "—"} · Registrado por{" "}
              {data.usuario ? `${data.usuario.name} ${data.usuario.lastname ?? ""}`.trim() : "—"}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="poste-name">Número <span className="text-destructive">*</span></Label>
              {loadingData ? <Skeleton className="h-9 w-full" /> : (
                <Input
                  id="poste-name"
                  placeholder="Ej: P-001"
                  value={data.name}
                  onChange={(e) => { setData((d) => ({ ...d, name: e.target.value })); if (errors.name) setErrors(p => ({ ...p, name: "" })); }}
                  disabled={soloLectura}
                  aria-invalid={!!errors.name}
                />
              )}
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Fecha en campo</Label>
              {loadingData ? <Skeleton className="h-9 w-full" /> : (
                <DatePicker
                  value={data.date ? new Date(data.date) : undefined}
                  onSelect={(date) => setData((d) => ({ ...d, date: date ?? new Date() }))}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Propietario <span className="text-destructive">*</span></Label>
              {loadingData ? <Skeleton className="h-9 w-full" /> : (
                <Combobox
                  placeholder="Seleccionar..."
                  options={listPropietario.map((p) => ({ value: String(p.id), label: p.name ?? "" }))}
                  value={data.id_propietario ? String(data.id_propietario) : ""}
                  onValueChange={(v) => {
                    // The nested object is cleared rather than replaced, here and
                    // in the three below. Nothing in this form reads it, and
                    // `updatePoste` ignores it — `TempPoste.set()` only writes
                    // real attributes — so it was already write-only. What the
                    // catalogue now hands back is a projection (`id`, `name`), not
                    // a `PropietarioInterface`, and leaving the object the pole
                    // arrived with would ship a stale name beside a new id.
                    setData((d) => ({ ...d, id_propietario: Number(v), propietario: null }));
                    if (errors.propietario) setErrors(p => ({ ...p, propietario: "" }));
                  }}
                />
              )}
              {errors.propietario && <p className="text-xs text-destructive mt-1">{errors.propietario}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Material <span className="text-destructive">*</span></Label>
              {loadingData ? <Skeleton className="h-9 w-full" /> : (
                <Combobox
                  placeholder="Seleccionar..."
                  options={listMaterial.map((m) => ({ value: String(m.id), label: m.name ?? "" }))}
                  value={data.id_material ? String(data.id_material) : ""}
                  onValueChange={(v) => {
                    setData((d) => ({ ...d, id_material: Number(v), material: null }));
                    if (errors.material) setErrors(p => ({ ...p, material: "" }));
                  }}
                />
              )}
              {errors.material && <p className="text-xs text-destructive mt-1">{errors.material}</p>}
            </div>
          </div>
        </Grupo>

        <Grupo titulo="Tramo">
          {/* Read as a stretch — from, arrow, to — where it was two dropdowns
              side by side that happened to say "Inicio" and "Fin". */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            {loadingData ? (
              <><Skeleton className="h-9 w-full" /><span /><Skeleton className="h-9 w-full" /></>
            ) : (
              <>
                <Combobox
                  placeholder="Inicio"
                  options={listCiudad.map((c) => ({ value: String(c.id), label: c.name ?? "" }))}
                  value={data.id_ciudadA ? String(data.id_ciudadA) : ""}
                  onValueChange={(v) => {
                    setData((d) => ({ ...d, id_ciudadA: Number(v), ciudadA: null }));
                    if (errors.tramo) setErrors(p => ({ ...p, tramo: "" }));
                  }}
                />
                <ArrowRightIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                <Combobox
                  placeholder="Fin"
                  options={listCiudad.map((c) => ({ value: String(c.id), label: c.name ?? "" }))}
                  value={data.id_ciudadB ? String(data.id_ciudadB) : ""}
                  onValueChange={(v) => {
                    setData((d) => ({ ...d, id_ciudadB: Number(v), ciudadB: null }));
                    if (errors.tramo) setErrors(p => ({ ...p, tramo: "" }));
                  }}
                />
              </>
            )}
          </div>
          {errors.tramo && <p className="text-xs text-destructive">{errors.tramo}</p>}
        </Grupo>

        <Grupo
          titulo="Ferretería de sujeción"
          extra={adssSelected.length > 0
            ? `${adssSelected.length} ${adssSelected.length === 1 ? "elegida" : "elegidas"}`
            : undefined}
        >
          {loadingData ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
            </div>
          ) : listAdss.length === 0 ? (
            // "Sin ADSS registradas" is a claim about the database, and until
            // now it was printed whenever the request failed as well — the
            // screen stating as fact something it had no answer for.
            <p className="text-sm text-muted-foreground">
              {estadoOpciones === "listas" ? "Sin ADSS registradas" : "Lista no disponible"}
            </p>
          ) : (
            // Toggles, still announced as checkboxes: what is on is filled and
            // ticked, so the answer reads at a glance where a column of boxes
            // had to be scanned one by one.
            <div className="flex flex-wrap gap-2">
              {listAdss.map((adss) => {
                const marcada = adss.id ? adssSelected.includes(adss.id) : false;
                return (
                  <button
                    key={adss.id}
                    type="button"
                    role="checkbox"
                    aria-checked={marcada}
                    disabled={soloLectura}
                    onClick={() => { if (adss.id) toggleAdss(adss.id); if (errors.adss) setErrors(p => ({ ...p, adss: "" })); }}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
                      marcada
                        ? "border-transparent bg-primary/15 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {marcada && <CheckIcon className="h-3.5 w-3.5 text-primary" />}
                    {adss.name}
                  </button>
                );
              })}
            </div>
          )}
          {errors.adss && <p className="text-xs text-destructive">{errors.adss}</p>}
        </Grupo>

        <Grupo titulo="Foto" extra={isEditing ? undefined : "obligatoria"}>
          <ImageDropzone
            file={imageFile}
            onChange={(f) => { setImageFile(f); if (errors.image) setErrors(p => ({ ...p, image: "" })); }}
            existingUrl={imageUrl(data.image) ?? undefined}
            error={errors.image}
            readOnly={soloLectura}
          />
        </Grupo>
      </div>

      {/* ── Right: where it is. Beside the fields from `lg`, so the map is in
             view the whole time; under them on anything narrower. ── */}
      <div className="min-w-0 lg:sticky lg:top-0">
        <Grupo titulo="Ubicación">
          {/* Enter in the place search looks a place up; it does not save the form. */}
          <div data-no-submit className="relative h-72 lg:h-[26rem] rounded-lg overflow-hidden border border-border isolate">
            <BaseMap
              // A stored pair that is not a place opens on the example, like a
              // pole with none: this form is where such a pole gets corrected,
              // so it has to open.
              center={hasCoords(data) ? { lat: data.lat, lng: data.lng } : { lat: latExample, lng: lngExample }}
              zoom={13}
              style={{ height: "100%" }}
              onMapClick={!soloLectura ? (p) => {
                setData((d) => ({ ...d, lat: p.lat, lng: p.lng }));
                if (errors.location) setErrors((prev) => ({ ...prev, location: "" }));
              } : undefined}
            >
              <MapSearch />
              {isEditing && (
                <FitView
                  coords={allCoords}
                  fit={allCoords.length >= 2}
                  center={{ lat: poste?.lat ?? 0, lng: poste?.lng ?? 0 }}
                  zoom={13}
                />
              )}

              {isEditing && routePath.length >= 2 && (
                <MapLine id="poste-route" positions={routePath.map(fromLatLngTuple)} />
              )}
              {isEditing && ciudadA?.lat && ciudadA?.lng && (
                <MapPoint
                  center={{ lat: ciudadA.lat, lng: ciudadA.lng }}
                  radius={MAP_RADIUS.endpoint}
                  strokeColor={MAP_DOT.endpoint}
                  fillColor={MAP_DOT.endpoint}
                  fillOpacity={1}
                  strokeWidth={0}
                />
              )}
              {isEditing && ciudadB?.lat && ciudadB?.lng && (
                <MapPoint
                  center={{ lat: ciudadB.lat, lng: ciudadB.lng }}
                  radius={MAP_RADIUS.endpoint}
                  strokeColor={MAP_DOT.endpoint}
                  fillColor={MAP_DOT.endpoint}
                  fillOpacity={1}
                  strokeWidth={0}
                />
              )}
              {isEditing && tramoPostes
                .filter((p) => p.id !== poste?.id && hasCoords(p))
                .map((p) => (
                  <MapPoint
                    key={p.id as number}
                    center={{ lat: p.lat, lng: p.lng }}
                    radius={MAP_RADIUS.secondary}
                    strokeColor={MAP_DOT.pole}
                    fillColor={MAP_DOT.poleFill}
                    fillOpacity={1}
                    strokeWidth={1.5}
                  />
                ))}
              {hasCoords(data) && (
                <SonarMarker
                  center={[data.lat, data.lng]}
                  fillColor={MAP_DOT.subject}
                  strokeColor="#ffffff"
                  rgb={MAP_DOT.subjectRgb}
                  dotRadius={MAP_RADIUS.main}
                  weight={1.5}
                  popupMinWidth={160}
                >
                  {isEditing && <>Poste {data.name}</>}
                </SonarMarker>
              )}
            </BaseMap>
          </div>

          <CoordInputs
            id="poste"
            lat={data.lat}
            lng={data.lng}
            disabled={soloLectura}
            invalid={!!errors.location}
            onChange={(lat, lng) => {
              setData((d) => ({ ...d, lat, lng }));
              if (errors.location) setErrors((prev) => ({ ...prev, location: "" }));
            }}
          />
          {errors.location
            ? <p className="text-xs text-destructive">{errors.location}</p>
            : !soloLectura && (
              <p className="text-xs text-muted-foreground">
                Pulsa en el mapa para mover el poste, o escribe las coordenadas.
              </p>
            )}
        </Grupo>
      </div>
    </FormDialog>
  );
}
