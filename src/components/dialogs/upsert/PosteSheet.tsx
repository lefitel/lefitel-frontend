import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { getPosteByTramo } from "../../../api/Poste.api";
import { fetchOrsRoute } from "../../../lib/orsRoute";
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
import { url } from "../../../api/url";
import { DatePicker } from "../../ui/date-picker";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Combobox } from "../../ui/combobox";
import { Checkbox } from "../../ui/checkbox";
import { Skeleton } from "../../ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription,
} from "../../ui/sheet";
import BaseMap from "../../map/BaseMap";
import MapPoint from "../../map/MapPoint";
import MapLine from "../../map/MapLine";
import { FitView } from "../../map/useFitCoords";
import { fromLatLngTuple, type LatLng } from "../../map/mapGeo";
import MapSearch from "../../map/MapSearch";
import { Loader2Icon } from "lucide-react";
import { SonarMarker } from "../../map/SonarMarker";
import { ImageDropzone } from "../../ui/image-dropzone";

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

    // Silent when the catalogues were already refused: since C5 both this and
    // `/api/poste/options` ask for `postes.ver`, so one refusal produces both
    // failures, and the sentence the sheet already shows on screen — "no tiene
    // permiso para consultar los catálogos de postes" — is the true one. A
    // second toast contradicting it would be this file answering a question
    // the screen has already answered better.
    const propios = isEditing && poste?.id
      ? getAdssPoste(poste.id as number)
        .then((adssP) => setAdssSelected(adssP.map((a) => a.id_adss as number)))
        .catch((error) => {
          setAdssSelected([]);
          if (estadoTrasFallo(error) === "listas") {
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
        const dx = b.lat - a.lat;
        const dy = b.lng - a.lng;
        const sorted = postes
          .filter((p) => p.lat && p.lng)
          .sort((p1, p2) =>
            (p1.lat - a.lat) * dx + (p1.lng - a.lng) * dy -
            ((p2.lat - a.lat) * dx + (p2.lng - a.lng) * dy)
          );
        setTramoPostes(sorted);
        const fallback: [number, number][] = [
          [a.lat, a.lng],
          ...sorted.map((p): [number, number] => [p.lat, p.lng]),
          [b.lat, b.lng],
        ];
        const waypoints = [[a.lng, a.lat], ...sorted.map((p) => [p.lng, p.lat]), [b.lng, b.lat]];
        const orsKey = import.meta.env.VITE_ORS_API_KEY as string;
        fetchOrsRoute(waypoints, orsKey)
          .then((route) => setRoutePath(route ?? fallback))
          .catch(() => setRoutePath(fallback));
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
    ...(ciudadA?.lat && ciudadA?.lng ? [{ lat: ciudadA.lat, lng: ciudadA.lng }] : []),
    ...(ciudadB?.lat && ciudadB?.lng ? [{ lat: ciudadB.lat, lng: ciudadB.lng }] : []),
    ...(data.lat && data.lng ? [{ lat: data.lat, lng: data.lng }] : []),
    ...tramoPostes.filter((p) => p.lat && p.lng).map((p) => ({ lat: p.lat, lng: p.lng })),
  ] : [];

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <SheetTitle>{isEditing ? "Editar poste" : "Nuevo poste"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? (data.name ? `Poste ${data.name}` : "Modifica los datos del poste")
              : "Completa los datos para registrar un nuevo poste en la red."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-3 items-start content-start">

          {(estadoOpciones === "denegado" || estadoOpciones === "fallo") && (
            <div className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
              <p className="text-sm text-destructive">
                {estadoOpciones === "denegado"
                  ? "No tiene permiso para consultar los catálogos de postes, así que este formulario no se puede completar."
                  : "No se pudieron cargar los catálogos. Cierre y vuelva a abrir para reintentarlo."}
              </p>
            </div>
          )}

          {isEditing && (
            <div className="sm:col-span-2 grid grid-cols-3 gap-x-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">ID</Label>
                <Input value={data.id ?? "—"} disabled />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Registrado por</Label>
                <Input value={data.usuario ? `${data.usuario.name} ${data.usuario.lastname ?? ""}`.trim() : "—"} disabled />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Número de poste <span className="text-destructive">*</span></Label>
            {loadingData ? <Skeleton className="h-10 w-full" /> : (
              <Input
                placeholder="Ej: P-001"
                value={data.name}
                onChange={(e) => { setData((d) => ({ ...d, name: e.target.value })); if (errors.name) setErrors(p => ({ ...p, name: "" })); }}
                disabled={isEditing && !canEdit}
                aria-invalid={!!errors.name}
              />
            )}
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Fecha</Label>
            {loadingData ? <Skeleton className="h-10 w-full" /> : (
              <DatePicker
                value={data.date ? new Date(data.date) : undefined}
                onSelect={(date) => setData((d) => ({ ...d, date: date ?? new Date() }))}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Propietario <span className="text-destructive">*</span></Label>
            {loadingData ? <Skeleton className="h-10 w-full" /> : (
              <Combobox
                placeholder="Seleccionar..."
                options={listPropietario.map((p) => ({ value: String(p.id), label: p.name ?? "" }))}
                value={data.id_propietario ? String(data.id_propietario) : ""}
                onValueChange={(v) => {
                  // The nested object is cleared rather than replaced, here and
                  // in the three below. Nothing in this sheet reads it, and
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
            {loadingData ? <Skeleton className="h-10 w-full" /> : (
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

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tramo <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 gap-3">
              {loadingData ? (
                <><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></>
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
            {errors.tramo && <p className="text-xs text-destructive mt-1">{errors.tramo}</p>}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>ADSS / Ferretería de sujeción <span className="text-destructive">*</span></Label>
            {loadingData ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
              </div>
            ) : listAdss.length === 0 ? (
              // "Sin ADSS registradas" is a claim about the database, and until
              // now it was printed whenever the request failed as well — the
              // screen stating as fact something it had no answer for.
              <p className="text-sm text-muted-foreground">
                {estadoOpciones === "listas" ? "Sin ADSS registradas" : "Lista no disponible"}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-y-1">
                {listAdss.map((adss) => (
                  <label key={adss.id} className="flex items-center gap-2 cursor-pointer select-none py-0.5">
                    <Checkbox
                      checked={adss.id ? adssSelected.includes(adss.id) : false}
                      onCheckedChange={() => { if (adss.id) toggleAdss(adss.id); if (errors.adss) setErrors(p => ({ ...p, adss: "" })); }}
                      disabled={isEditing && !canEdit}
                    />
                    <span className="text-sm">{adss.name}</span>
                  </label>
                ))}
              </div>
            )}
            {errors.adss && <p className="text-xs text-destructive mt-1">{errors.adss}</p>}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Ubicación <span className="text-destructive">*</span></Label>
            <div className="relative h-72 rounded-lg overflow-hidden border border-border isolate">
              <BaseMap
                center={{ lat: data.lat || latExample, lng: data.lng || lngExample }}
                zoom={13}
                style={{ height: "100%" }}
                onMapClick={(!isEditing || canEdit) ? (p) => {
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
                  <MapLine id="poste-route" positions={routePath.map(fromLatLngTuple)} color="#596BAB" width={3} opacity={0.7} />
                )}
                {isEditing && ciudadA?.lat && ciudadA?.lng && (
                  <MapPoint
                    center={{ lat: ciudadA.lat, lng: ciudadA.lng }}
                    radius={7}
                    strokeColor="#374151"
                    fillColor="#374151"
                    fillOpacity={1}
                    strokeWidth={0}
                  />
                )}
                {isEditing && ciudadB?.lat && ciudadB?.lng && (
                  <MapPoint
                    center={{ lat: ciudadB.lat, lng: ciudadB.lng }}
                    radius={7}
                    strokeColor="#374151"
                    fillColor="#374151"
                    fillOpacity={1}
                    strokeWidth={0}
                  />
                )}
                {isEditing && tramoPostes
                  .filter((p) => p.id !== poste?.id && p.lat && p.lng)
                  .map((p) => (
                    <MapPoint
                      key={p.id as number}
                      center={{ lat: p.lat, lng: p.lng }}
                      radius={5}
                      strokeColor="#9ca3af"
                      fillColor="#9ca3af"
                      fillOpacity={0.7}
                      strokeWidth={1.5}
                    />
                  ))}
                {data.lat && data.lng && (
                  <SonarMarker
                    center={[data.lat, data.lng]}
                    fillColor="#596BAB"
                    strokeColor="#ffffff"
                    rgb="89, 107, 171"
                    dotRadius={isEditing ? 10 : 8}
                    weight={1.5}
                    popupMinWidth={160}
                  >
                    {isEditing && <>Poste {data.name}</>}
                  </SonarMarker>
                )}
              </BaseMap>

              <div className="absolute bottom-3 left-3 right-3 z-1000 flex gap-2">
                <div className="flex items-center gap-2 bg-background/90 supports-backdrop-filter:backdrop-blur-sm border border-border rounded-md px-2.5 py-1.5 flex-1 shadow-sm">
                  <span className="text-xs text-muted-foreground shrink-0">Lat</span>
                  <Input
                    type="number"
                    step="any"
                    placeholder={String(latExample)}
                    value={data.lat || ""}
                    onChange={(e) => { setData((d) => ({ ...d, lat: parseFloat(e.target.value) || 0 })); if (errors.location) setErrors(p => ({ ...p, location: "" })); }}
                    disabled={isEditing && !canEdit}
                    className="h-5 text-xs border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <div className="flex items-center gap-2 bg-background/90 supports-backdrop-filter:backdrop-blur-sm border border-border rounded-md px-2.5 py-1.5 flex-1 shadow-sm">
                  <span className="text-xs text-muted-foreground shrink-0">Lng</span>
                  <Input
                    type="number"
                    step="any"
                    placeholder={String(lngExample)}
                    value={data.lng || ""}
                    onChange={(e) => { setData((d) => ({ ...d, lng: parseFloat(e.target.value) || 0 })); if (errors.location) setErrors(p => ({ ...p, location: "" })); }}
                    disabled={isEditing && !canEdit}
                    className="h-5 text-xs border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
            </div>
            {errors.location && <p className="text-xs text-destructive mt-1">{errors.location}</p>}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              Imagen del poste{!isEditing && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            <ImageDropzone
              file={imageFile}
              onChange={(f) => { setImageFile(f); if (errors.image) setErrors(p => ({ ...p, image: "" })); }}
              existingUrl={data.image ? `${url}${data.image}` : undefined}
              error={errors.image}
              readOnly={isEditing && !canEdit}
            />
          </div>

        </div>

        <SheetFooter className="px-6 py-4 border-t border-border/40 shrink-0">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={saving}>
              Cancelar
            </Button>
            {(!isEditing || canEdit) && (
              <Button onClick={handleGuardar} disabled={saving || loadingData || estadoOpciones !== "listas"}>
                {saving ? <><Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" />Guardando…</> : "Guardar"}
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
