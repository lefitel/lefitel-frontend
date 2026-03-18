import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, useMap, useMapEvent } from "react-leaflet";
import { getPosteByTramo } from "../../../api/Poste.api";
import { fetchOrsRoute } from "../../../lib/orsRoute";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import {
  AdssInterface, AdssPosteInterface, CiudadInterface,
  MaterialInterface, PosteInterface, PropietarioInterface,
} from "../../../interfaces/interfaces";
import { getAdss } from "../../../api/Adss.api";
import { getCiudad } from "../../../api/Ciudad.api";
import { getMaterial } from "../../../api/Material.api";
import { getPropietario } from "../../../api/Propietario.api";
import { createAdssPoste, deleteAdssPoste, getAdssPoste } from "../../../api/AdssPoste.api";
import { uploadImage } from "../../../api/Upload.api";
import { editPoste } from "../../../api/Poste.api";
import { posteExample } from "../../../data/example";
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
import { ImageIcon, Loader2Icon, MapPinIcon } from "lucide-react";

interface Props {
  poste: PosteInterface;
  setPoste: (p: PosteInterface) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  functionApp: () => void;
}

export default function EditPosteSheet({ poste, setPoste, open, setOpen, functionApp }: Props) {
  const { sesion } = useContext(SesionContext);

  const [data, setData] = useState<PosteInterface>(poste);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [adssSelected, setAdssSelected] = useState<number[]>([]);
  const [adssPoste, setAdssPoste] = useState<AdssPosteInterface[]>([]);

  const [listAdss, setListAdss] = useState<AdssInterface[]>([]);
  const [listCiudad, setListCiudad] = useState<CiudadInterface[]>([]);
  const [listMaterial, setListMaterial] = useState<MaterialInterface[]>([]);
  const [listPropietario, setListPropietario] = useState<PropietarioInterface[]>([]);

  const [tramoPostes, setTramoPostes] = useState<PosteInterface[]>([]);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);

  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const rol = sesion.usuario.id_rol;
  const canEdit = can(rol, "postes", "editar");

  // Sync data when poste prop changes
  useEffect(() => { setData(poste); }, [poste]);

  // Load catalogs + current adss selection when sheet opens
  useEffect(() => {
    if (!open || !poste.id) return;
    setLoadingData(true);
    Promise.all([
      getAdssPoste(poste.id as number, sesion.token),
      getAdss(sesion.token),
      getCiudad(sesion.token),
      getMaterial(sesion.token),
      getPropietario(sesion.token),
    ])
      .then(([adssP, adss, ciudades, materiales, propietarios]) => {
        setAdssPoste(adssP);
        setAdssSelected(adssP.map((a) => a.id_adss as number));
        setListAdss(adss);
        setListCiudad(ciudades);
        setListMaterial(materiales);
        setListPropietario(propietarios);
      })
      .catch(() => toast.error("Error al cargar catálogos"))
      .finally(() => setLoadingData(false));
  }, [open, poste.id, sesion.token]);

  // Load tramo route once cities catalog is ready
  useEffect(() => {
    if (!open || !listCiudad.length || !poste.id_ciudadA || !poste.id_ciudadB) return;
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
        const waypoints = [
          [a.lng, a.lat],
          ...sorted.map((p) => [p.lng, p.lat]),
          [b.lng, b.lat],
        ];
        const orsKey = import.meta.env.VITE_ORS_API_KEY as string;
        fetchOrsRoute(waypoints, orsKey)
          .then((route) => setRoutePath(route ?? fallback))
          .catch(() => setRoutePath(fallback));
      })
      .catch(() => { });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listCiudad, poste.id_ciudadA, poste.id_ciudadB]);

  const handleClose = () => {
    setImageFile(null);
    setAdssSelected([]);
    setTramoPostes([]);
    setRoutePath([]);
    setPoste(posteExample);
    setOpen(false);
    functionApp();
  };

  const toggleAdss = (id: number) => {
    setAdssSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleGuardar = async () => {
    if (!data.name.trim()) { toast.warning("Ingresa el número del poste"); return; }
    if (!data.id_ciudadA || !data.id_ciudadB) { toast.warning("Selecciona el tramo"); return; }
    if (data.id_ciudadA === data.id_ciudadB) { toast.warning("El inicio y fin del tramo no pueden ser la misma ciudad"); return; }
    if (!data.id_material) { toast.warning("Selecciona el material"); return; }
    if (!data.id_propietario) { toast.warning("Selecciona el propietario"); return; }
    if (adssSelected.length === 0) { toast.warning("Selecciona al menos un ADSS"); return; }

    setSaving(true);
    try {
      let payload = { ...data };

      if (imageFile) {
        const imageUrl = await uploadImage(imageFile, sesion.token);
        if (!imageUrl || imageUrl === "500") { toast.error("No se pudo subir la imagen"); return; }
        payload = { ...payload, image: imageUrl };
      }

      const res = await editPoste(payload, sesion.token);
      if (Number(res.status) !== 200) { toast.error("No se pudo guardar"); return; }

      // Diff ADSS: add new ones, remove removed ones
      const toAdd = adssSelected.filter((id) => !adssPoste.some((a) => a.id_adss === id));
      const toRemove = adssPoste.filter((a) => !adssSelected.includes(a.id_adss as number));

      await Promise.all([
        ...toAdd.map((id_adss) => createAdssPoste({ id_adss, id_poste: res.data.id as number }, sesion.token)),
        ...toRemove.map((a) => deleteAdssPoste(a.id as number, sesion.token)),
      ]);

      toast.success("Poste actualizado");
      handleClose();
    } catch {
      toast.error("Ocurrió un error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
            <SheetTitle>Editar poste</SheetTitle>
            <SheetDescription>
              {data.name ? `Poste ${data.name}` : "Modifica los datos del poste"}
            </SheetDescription>
          </SheetHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* ID + Creador (read-only) */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">ID</Label>
                <Input value={data.id ?? "—"} disabled />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Registrado por</Label>
                <Input value={data.usuario ? `${data.usuario.name} ${data.usuario.lastname ?? ""}`.trim() : "—"} disabled />
              </div>
            </div>

            {/* Número + Fecha */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Número de poste</Label>
                {loadingData ? <Skeleton className="h-10 w-full" /> : (
                  <Input
                    value={data.name}
                    onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
                    disabled={!canEdit}
                  />
                )}
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
            </div>

            {/* Propietario + Material */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Propietario</Label>
                {loadingData ? <Skeleton className="h-10 w-full" /> : (
                  <Combobox
                    placeholder="Seleccionar..."
                    options={listPropietario.map((p) => ({ value: String(p.id), label: p.name ?? "" }))}
                    value={data.id_propietario ? String(data.id_propietario) : ""}
                    onValueChange={(v) => {
                      const found = listPropietario.find((p) => String(p.id) === v);
                      setData((d) => ({ ...d, id_propietario: Number(v), propietario: found ?? null }));
                    }}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Material</Label>
                {loadingData ? <Skeleton className="h-10 w-full" /> : (
                  <Combobox
                    placeholder="Seleccionar..."
                    options={listMaterial.map((m) => ({ value: String(m.id), label: m.name ?? "" }))}
                    value={data.id_material ? String(data.id_material) : ""}
                    onValueChange={(v) => {
                      const found = listMaterial.find((m) => String(m.id) === v);
                      setData((d) => ({ ...d, id_material: Number(v), material: found ?? null }));
                    }}
                  />
                )}
              </div>
            </div>

            {/* Tramo */}
            <div className="space-y-1.5">
              <Label>Tramo</Label>
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
                      }}
                    />
                    <Combobox
                      placeholder="Fin"
                      options={listCiudad.map((c) => ({ value: String(c.id), label: c.name ?? "" }))}
                      value={data.id_ciudadB ? String(data.id_ciudadB) : ""}
                      onValueChange={(v) => {
                        const found = listCiudad.find((c) => String(c.id) === v);
                        setData((d) => ({ ...d, id_ciudadB: Number(v), ciudadB: found ?? null }));
                      }}
                    />
                  </>
                )}
              </div>
            </div>

            {/* ADSS */}
            <div className="space-y-1.5">
              <Label>ADSS / Ferretería de sujeción</Label>
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
                        onCheckedChange={(_checked) => adss.id && toggleAdss(adss.id)}
                        disabled={!canEdit}
                      />
                      <span className="text-sm">{adss.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Ubicación */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <MapPinIcon className="h-3.5 w-3.5 text-primary" />
                Ubicación
              </Label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Latitud</Label>
                  <Input
                    type="number"
                    step="any"
                    value={data.lat || ""}
                    onChange={(e) => setData((d) => ({ ...d, lat: parseFloat(e.target.value) || 0 }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Longitud</Label>
                  <Input
                    type="number"
                    step="any"
                    value={data.lng || ""}
                    onChange={(e) => setData((d) => ({ ...d, lng: parseFloat(e.target.value) || 0 }))}
                    disabled={!canEdit}
                  />
                </div>
              </div>
              {canEdit && <p className="text-xs text-muted-foreground mb-1">Haz clic en el mapa para mover la ubicación.</p>}
              {(() => {
                const ciudadA = listCiudad.find((c) => c.id === poste.id_ciudadA);
                const ciudadB = listCiudad.find((c) => c.id === poste.id_ciudadB);
                const allCoords: [number, number][] = [
                  ...(ciudadA?.lat && ciudadA?.lng ? [[ciudadA.lat, ciudadA.lng] as [number, number]] : []),
                  ...(ciudadB?.lat && ciudadB?.lng ? [[ciudadB.lat, ciudadB.lng] as [number, number]] : []),
                  ...(data.lat && data.lng ? [[data.lat, data.lng] as [number, number]] : []),
                  ...tramoPostes.filter((p) => p.lat && p.lng).map((p): [number, number] => [p.lat, p.lng]),
                ];
                return (
                  <div className="rounded-lg overflow-hidden border border-border isolate">
                    <MapContainer
                      center={[poste.lat || -17.82, poste.lng || -63.17]}
                      zoom={13}
                      style={{ height: "240px" }}
                      scrollWheelZoom
                      zoomControl={false}
                    >
                      <ThemedTileLayer />
                      <MapSearch />
                      {canEdit && <ClickToPlace setData={setData} />}
                      <RecenterMap lat={poste.lat} lng={poste.lng} />
                      {allCoords.length >= 2 && <FitBounds coords={allCoords} />}

                      {/* Ruta del tramo */}
                      {routePath.length >= 2 && (
                        <Polyline positions={routePath} pathOptions={{ color: "#596BAB", weight: 3, opacity: 0.7 }} />
                      )}

                      {/* Ciudad A */}
                      {ciudadA?.lat && ciudadA?.lng && (
                        <CircleMarker
                          center={[ciudadA.lat, ciudadA.lng]}
                          radius={7}
                          pathOptions={{ color: "#374151", fillColor: "#374151", fillOpacity: 1, weight: 0 }}
                        />
                      )}

                      {/* Ciudad B */}
                      {ciudadB?.lat && ciudadB?.lng && (
                        <CircleMarker
                          center={[ciudadB.lat, ciudadB.lng]}
                          radius={7}
                          pathOptions={{ color: "#374151", fillColor: "#374151", fillOpacity: 1, weight: 0 }}
                        />
                      )}

                      {/* Otros postes del tramo (solo visual, sin popup) */}
                      {tramoPostes
                        .filter((p) => p.id !== poste.id && p.lat && p.lng)
                        .map((p) => (
                          <CircleMarker
                            key={p.id as number}
                            center={[p.lat, p.lng]}
                            radius={5}
                            pathOptions={{ color: "#9ca3af", fillColor: "#9ca3af", fillOpacity: 0.7, weight: 1.5 }}
                          />
                        ))}

                      {/* Marcador editable del poste actual */}
                      {data.lat && data.lng && (
                        <Marker position={[data.lat, data.lng]}>
                          <Popup>Poste {data.name}</Popup>
                        </Marker>
                      )}
                    </MapContainer>
                  </div>
                );
              })()}
            </div>

            {/* Imagen */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-primary" />
                Imagen del poste
              </Label>
              {canEdit && (
                <input
                  type="file"
                  accept="image/*"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
              )}
              <img
                src={imageFile ? URL.createObjectURL(imageFile) : `${url}${data.image}`}
                alt={`Poste ${data.name}`}
                className="w-full max-h-52 object-cover rounded-lg border border-border mt-1"
              />
            </div>

          </div>

          <SheetFooter className="px-6 py-4 border-t border-border/40 shrink-0 flex flex-row justify-end gap-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                Cancelar
              </Button>
              {canEdit && (
                <Button onClick={handleGuardar} disabled={saving || loadingData} className="bg-primary hover:bg-primary/90 text-white">
                  {saving ? <><Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" />Guardando…</> : "Guardar"}
                </Button>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ClickToPlace({
  setData,
}: {
  setData: React.Dispatch<React.SetStateAction<PosteInterface>>;
}) {
  useMapEvent("click", (e) => {
    setData((d) => ({ ...d, lat: e.latlng.lat, lng: e.latlng.lng }));
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
