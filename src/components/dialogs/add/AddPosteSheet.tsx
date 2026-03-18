import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MapContainer, Marker, Popup, useMapEvent } from "react-leaflet";
import { SesionContext } from "../../../context/SesionContext";
import { AdssInterface, CiudadInterface, MaterialInterface, PosteInterface, PropietarioInterface } from "../../../interfaces/interfaces";
import { getAdss } from "../../../api/Adss.api";
import { getCiudad } from "../../../api/Ciudad.api";
import { getMaterial } from "../../../api/Material.api";
import { getPropietario } from "../../../api/Propietario.api";
import { uploadImage } from "../../../api/Upload.api";
import { createPoste } from "../../../api/Poste.api";
import { createAdssPoste } from "../../../api/AdssPoste.api";
import { posteExample, latExample, lngExample } from "../../../data/example";
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
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}

const EMPTY = posteExample;

export default function AddPosteSheet({ open, setOpen, onSuccess }: Props) {
  const { sesion } = useContext(SesionContext);

  // Form state
  const [data, setData] = useState<PosteInterface>({ ...EMPTY });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [adssSelected, setAdssSelected] = useState<number[]>([]);

  // Catalogs
  const [listAdss, setListAdss] = useState<AdssInterface[]>([]);
  const [listCiudad, setListCiudad] = useState<CiudadInterface[]>([]);
  const [listMaterial, setListMaterial] = useState<MaterialInterface[]>([]);
  const [listPropietario, setListPropietario] = useState<PropietarioInterface[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load catalogs when sheet opens
  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    Promise.all([
      getAdss(sesion.token),
      getCiudad(sesion.token),
      getMaterial(sesion.token),
      getPropietario(sesion.token),
    ])
      .then(([adss, ciudades, materiales, propietarios]) => {
        setListAdss(adss);
        setListCiudad(ciudades);
        setListMaterial(materiales);
        setListPropietario(propietarios);
      })
      .catch(() => toast.error("Error al cargar catálogos"))
      .finally(() => setLoadingData(false));
  }, [open, sesion.token]);

  const reset = () => {
    setData({ ...EMPTY });
    setImageFile(null);
    setAdssSelected([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    setOpen(false);
  };

  const toggleAdss = (id: number) => {
    setAdssSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleGuardar = async () => {
    if (!data.name.trim()) { toast.warning("Ingresa el número del poste"); return; }
    if (!data.id_ciudadA || !data.id_ciudadB) { toast.warning("Selecciona el tramo (inicio y fin)"); return; }
    if (data.id_ciudadA === data.id_ciudadB) { toast.warning("El inicio y fin del tramo no pueden ser la misma ciudad"); return; }
    if (!data.id_material) { toast.warning("Selecciona el material"); return; }
    if (!data.id_propietario) { toast.warning("Selecciona el propietario"); return; }
    if (adssSelected.length === 0) { toast.warning("Selecciona al menos un ADSS"); return; }
    if (!imageFile) { toast.warning("Sube una imagen del poste"); return; }

    setSaving(true);
    try {
      const imageUrl = await uploadImage(imageFile, sesion.token);
      if (!imageUrl || imageUrl === "500") { toast.error("No se pudo subir la imagen"); return; }

      const payload: PosteInterface = {
        ...data,
        image: imageUrl,
        id_usuario: sesion.usuario.id ?? 0,
      };
      const res = await createPoste(payload, sesion.token);
      if (Number(res.status) !== 200) { toast.error("No se pudo crear el poste"); return; }

      await Promise.all(
        adssSelected.map((id_adss) =>
          createAdssPoste({ id_adss, id_poste: res.data.id as number }, sesion.token)
        )
      );

      toast.success("Poste creado correctamente");
      reset();
      onSuccess();
    } catch {
      toast.error("Ocurrió un error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <SheetTitle>Nuevo poste</SheetTitle>
          <SheetDescription>Completa los datos para registrar un nuevo poste en la red.</SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Número + Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Número de poste</Label>
              {loadingData ? <Skeleton className="h-10 w-full" /> : (
                <Input
                  placeholder="Ej: P-001"
                  value={data.name}
                  onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
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
                <>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </>
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
                  placeholder={String(latExample)}
                  value={data.lat || ""}
                  onChange={(e) => setData((d) => ({ ...d, lat: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Longitud</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder={String(lngExample)}
                  value={data.lng || ""}
                  onChange={(e) => setData((d) => ({ ...d, lng: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Haz clic en el mapa para fijar la ubicación.</p>
            <div className="rounded-lg overflow-hidden border border-border isolate">
              <MapContainer
                center={[data.lat || latExample, data.lng || lngExample]}
                zoom={13}
                style={{ height: "240px" }}
                scrollWheelZoom
                zoomControl={false}
              >
                <ThemedTileLayer />
                  <MapSearch />
                <ClickToPlace setData={setData} />
                {(data.lat && data.lng) ? (
                  <Marker position={[data.lat, data.lng]}>
                    <Popup>Ubicación del poste</Popup>
                  </Marker>
                ) : null}
              </MapContainer>
            </div>
          </div>

          {/* Imagen */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-primary" />
              Imagen del poste
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
            {imageFile ? (
              <img
                src={URL.createObjectURL(imageFile)}
                alt="Preview"
                className="w-full max-h-48 object-cover rounded-lg border border-border mt-2"
              />
            ) : null}
          </div>

        </div>

        <SheetFooter className="px-6 py-4 border-t border-border/40 shrink-0 flex flex-row justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={saving || loadingData} className="bg-primary hover:bg-primary/90 text-white">
            {saving ? <><Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" />Guardando…</> : "Guardar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Leaflet click helper — defined outside to avoid re-renders
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
