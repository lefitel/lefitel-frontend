import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleMarker, MapContainer, Polyline, Popup, useMap, useMapEvent } from "react-leaflet";
import { getPosteByTramo } from "../../../api/Poste.api";
import { fetchOrsRoute } from "../../../lib/orsRoute";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import {
  AdssInterface, CiudadInterface,
  MaterialInterface, PosteInterface, PropietarioInterface,
} from "../../../interfaces/interfaces";
import { getAdss } from "../../../api/Adss.api";
import { getCiudad } from "../../../api/Ciudad.api";
import { getMaterial } from "../../../api/Material.api";
import { getPropietario } from "../../../api/Propietario.api";
import { getAdssPoste } from "../../../api/AdssPoste.api";
import { uploadImage } from "../../../api/Upload.api";
import { createPoste, editPoste } from "../../../api/Poste.api";
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
import ThemedTileLayer from "../../map/ThemedTileLayer";
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

  const [listAdss, setListAdss] = useState<AdssInterface[]>([]);
  const [listCiudad, setListCiudad] = useState<CiudadInterface[]>([]);
  const [listMaterial, setListMaterial] = useState<MaterialInterface[]>([]);
  const [listPropietario, setListPropietario] = useState<PropietarioInterface[]>([]);

  const [tramoPostes, setTramoPostes] = useState<PosteInterface[]>([]);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);

  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});


  useEffect(() => {
    if (poste) setData(poste);
  }, [poste]);

  useEffect(() => {
    if (!open) return;
    setLoadingData(true);

    const setLists = (
      adss: AdssInterface[],
      ciudades: CiudadInterface[],
      materiales: MaterialInterface[],
      propietarios: PropietarioInterface[]
    ) => {
      setListAdss(adss);
      setListCiudad(ciudades);
      setListMaterial(materiales);
      setListPropietario(propietarios);
    };

    if (isEditing && poste?.id) {
      Promise.all([
        getAdss(sesion.token),
        getCiudad(sesion.token),
        getMaterial(sesion.token),
        getPropietario(sesion.token),
        getAdssPoste(poste.id as number, sesion.token),
      ])
        .then(([adss, ciudades, materiales, propietarios, adssP]) => {
          setLists(adss, ciudades, materiales, propietarios);
          setAdssSelected(adssP.map((a) => a.id_adss as number));
        })
        .catch(() => toast.error("Error al cargar catálogos"))
        .finally(() => setLoadingData(false));
    } else {
      setData({ ...posteExample });
      setAdssSelected([]);
      Promise.all([
        getAdss(sesion.token),
        getCiudad(sesion.token),
        getMaterial(sesion.token),
        getPropietario(sesion.token),
      ])
        .then(([adss, ciudades, materiales, propietarios]) => {
          setLists(adss, ciudades, materiales, propietarios);
        })
        .catch(() => toast.error("Error al cargar catálogos"))
        .finally(() => setLoadingData(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, poste?.id, sesion.token]);

  useEffect(() => {
    if (!open || !isEditing || !listCiudad.length || !poste?.id_ciudadA || !poste?.id_ciudadB) return;
    const a = listCiudad.find((c) => c.id === poste.id_ciudadA);
    const b = listCiudad.find((c) => c.id === poste.id_ciudadB);
    if (!a?.lat || !a?.lng || !b?.lat || !b?.lng) return;

    setTramoPostes([]);
    setRoutePath([]);

    getPosteByTramo(poste.id_ciudadA, poste.id_ciudadB, sesion.token)
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
        const imageUrl = await uploadImage(imageFile, sesion.token);
        if (!imageUrl || imageUrl === "500") { toast.error("No se pudo subir la imagen"); return; }
        payload = { ...payload, image: imageUrl };
      }

      if (isEditing) {
        const res = await editPoste(payload, sesion.token);
        if (Number(res.status) !== 200) { toast.error("No se pudo guardar"); return; }
        toast.success("Poste actualizado");
      } else {
        payload = { ...payload, id_usuario: sesion.usuario.id ?? 0 };
        const res = await createPoste(payload, sesion.token);
        if (Number(res.status) !== 200) { toast.error("No se pudo crear el poste"); return; }
        toast.success("Poste creado correctamente");
      }

      handleClose();
      onSuccess();
    } catch {
      toast.error("Ocurrió un error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const ciudadA = listCiudad.find((c) => c.id === (poste?.id_ciudadA ?? data.id_ciudadA));
  const ciudadB = listCiudad.find((c) => c.id === (poste?.id_ciudadB ?? data.id_ciudadB));
  const allCoords: [number, number][] = isEditing ? [
    ...(ciudadA?.lat && ciudadA?.lng ? [[ciudadA.lat, ciudadA.lng] as [number, number]] : []),
    ...(ciudadB?.lat && ciudadB?.lng ? [[ciudadB.lat, ciudadB.lng] as [number, number]] : []),
    ...(data.lat && data.lng ? [[data.lat, data.lng] as [number, number]] : []),
    ...tramoPostes.filter((p) => p.lat && p.lng).map((p): [number, number] => [p.lat, p.lng]),
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
                className={errors.name ? "border-destructive" : ""}
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
                  const found = listPropietario.find((p) => String(p.id) === v);
                  setData((d) => ({ ...d, id_propietario: Number(v), propietario: found ?? null }));
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
                  const found = listMaterial.find((m) => String(m.id) === v);
                  setData((d) => ({ ...d, id_material: Number(v), material: found ?? null }));
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
                      const found = listCiudad.find((c) => String(c.id) === v);
                      setData((d) => ({ ...d, id_ciudadA: Number(v), ciudadA: found ?? null }));
                      if (errors.tramo) setErrors(p => ({ ...p, tramo: "" }));
                    }}
                  />
                  <Combobox
                    placeholder="Fin"
                    options={listCiudad.map((c) => ({ value: String(c.id), label: c.name ?? "" }))}
                    value={data.id_ciudadB ? String(data.id_ciudadB) : ""}
                    onValueChange={(v) => {
                      const found = listCiudad.find((c) => String(c.id) === v);
                      setData((d) => ({ ...d, id_ciudadB: Number(v), ciudadB: found ?? null }));
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
              <p className="text-sm text-muted-foreground">Sin ADSS registradas</p>
            ) : (
              <div className="grid grid-cols-2 gap-y-1">
                {listAdss.map((adss) => (
                  <label key={adss.id} className="flex items-center gap-2 cursor-pointer select-none py-0.5">
                    <Checkbox
                      checked={adss.id ? adssSelected.includes(adss.id) : false}
                      onCheckedChange={(_checked) => { adss.id && toggleAdss(adss.id); if (errors.adss) setErrors(p => ({ ...p, adss: "" })); }}
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
              <MapContainer
                center={[data.lat || latExample, data.lng || lngExample]}
                zoom={13}
                style={{ height: "100%" }}
                scrollWheelZoom
                zoomControl={false}
              >
                <ThemedTileLayer />
                <MapSearch />
                {(!isEditing || canEdit) && <ClickToPlace setData={setData} onPlace={() => { if (errors.location) setErrors(p => ({ ...p, location: "" })); }} />}
                {isEditing && <RecenterMap lat={poste?.lat ?? 0} lng={poste?.lng ?? 0} />}
                {isEditing && allCoords.length >= 2 && <FitBounds coords={allCoords} />}

                {isEditing && routePath.length >= 2 && (
                  <Polyline positions={routePath} pathOptions={{ color: "#596BAB", weight: 3, opacity: 0.7 }} />
                )}
                {isEditing && ciudadA?.lat && ciudadA?.lng && (
                  <CircleMarker
                    center={[ciudadA.lat, ciudadA.lng]}
                    radius={7}
                    pathOptions={{ color: "#374151", fillColor: "#374151", fillOpacity: 1, weight: 0 }}
                  />
                )}
                {isEditing && ciudadB?.lat && ciudadB?.lng && (
                  <CircleMarker
                    center={[ciudadB.lat, ciudadB.lng]}
                    radius={7}
                    pathOptions={{ color: "#374151", fillColor: "#374151", fillOpacity: 1, weight: 0 }}
                  />
                )}
                {isEditing && tramoPostes
                  .filter((p) => p.id !== poste?.id && p.lat && p.lng)
                  .map((p) => (
                    <CircleMarker
                      key={p.id as number}
                      center={[p.lat, p.lng]}
                      radius={5}
                      pathOptions={{ color: "#9ca3af", fillColor: "#9ca3af", fillOpacity: 0.7, weight: 1.5 }}
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
                  >
                    {isEditing && <Popup>Poste {data.name}</Popup>}
                  </SonarMarker>
                )}
              </MapContainer>

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
              <Button onClick={handleGuardar} disabled={saving || loadingData} className="bg-primary hover:bg-primary/90 text-white">
                {saving ? <><Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" />Guardando…</> : "Guardar"}
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ClickToPlace({ setData, onPlace }: { setData: React.Dispatch<React.SetStateAction<PosteInterface>>; onPlace?: () => void }) {
  useMapEvent("click", (e) => {
    setData((d) => ({ ...d, lat: e.latlng.lat, lng: e.latlng.lng }));
    onPlace?.();
  });
  return null;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], map.getZoom());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return null;
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length >= 2) map.fitBounds(coords, { padding: [30, 30] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords.length]);
  return null;
}
