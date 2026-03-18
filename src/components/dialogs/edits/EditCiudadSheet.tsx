import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleMarker, MapContainer, useMapEvent } from "react-leaflet";
import ThemedTileLayer from "../../map/ThemedTileLayer";
import MapSearch from "../../map/MapSearch";
import { SesionContext } from "../../../context/SesionContext";
import { editCiudad } from "../../../api/Ciudad.api";
import { uploadImage } from "../../../api/Upload.api";
import { url } from "../../../api/url";
import { CiudadInterface } from "../../../interfaces/interfaces";
import { latExample, lngExample } from "../../../data/example";
import { Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from "../../ui/sheet";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Button } from "../../ui/button";

interface Props {
  ciudad: CiudadInterface | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}

function LocationPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvent("click", (e) => onPick(e.latlng.lat, e.latlng.lng));
  return null;
}

export default function EditCiudadSheet({ ciudad, open, setOpen, onSuccess }: Props) {
  const { sesion } = useContext(SesionContext);
  const [name, setName] = useState("");
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync form state when ciudad prop changes
  useEffect(() => {
    if (ciudad) {
      setName(ciudad.name);
      setLat(ciudad.lat);
      setLng(ciudad.lng);
      setImageFile(null);
    }
  }, [ciudad]);

  const handleClose = () => {
    setImageFile(null);
    setOpen(false);
  };

  const handleSave = async () => {
    if (!ciudad?.id) return;
    if (!name.trim()) { toast.warning("El nombre es requerido"); return; }
    setSaving(true);
    try {
      let imagePath = ciudad.image;
      if (imageFile) {
        const r = await uploadImage(imageFile, sesion.token);
        if (r === "500") { toast.error("Error al subir la imagen"); return; }
        imagePath = r;
      }
      const result = await editCiudad({ ...ciudad, name, lat, lng, image: imagePath }, sesion.token);
      if (result === 200) {
        toast.success("Ciudad actualizada");
        handleClose();
        onSuccess();
      } else {
        toast.error("No se pudo guardar los cambios");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0 w-full sm:max-w-lg">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40">
            <SheetTitle>Editar Ciudad</SheetTitle>
            <SheetDescription>Modifica el nombre, ubicación e imagen de la ciudad.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="ciudad-name">Nombre <span className="text-destructive">*</span></Label>
              <Input
                id="ciudad-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la ciudad"
              />
            </div>

            {/* Lat / Lng */}
            <div className="space-y-1.5">
              <Label>Coordenadas <span className="text-xs text-muted-foreground">(o haz click en el mapa)</span></Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Latitud</p>
                  <Input
                    type="number"
                    step="0.000001"
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Longitud</p>
                  <Input
                    type="number"
                    step="0.000001"
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* Map */}
            <div className="rounded-lg overflow-hidden border border-border isolate">
              <MapContainer
                key={`${ciudad?.id}-${open}`}
                center={ciudad?.lat && ciudad?.lng ? [ciudad.lat, ciudad.lng] : [latExample, lngExample]}
                zoom={ciudad?.lat ? 13 : 5}
                style={{ height: 220 }}
                scrollWheelZoom
                zoomControl={false}
              >
                <ThemedTileLayer />
                  <MapSearch />
                <LocationPicker onPick={(lt, lg) => { setLat(lt); setLng(lg); }} />
                {lat !== 0 && lng !== 0 && (
                  <CircleMarker
                    center={[lat, lng]}
                    radius={8}
                    pathOptions={{ color: "#374151", fillColor: "#374151", fillOpacity: 1, weight: 0 }}
                  />
                )}
              </MapContainer>
            </div>

            {/* Image */}
            <div className="space-y-1.5">
              <Label>Imagen <span className="text-xs text-muted-foreground">(opcional)</span></Label>
              <Input
                type="file"
                accept="image/*"
                className="cursor-pointer"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />
              {(imageFile || ciudad?.image) && (
                <img
                  src={imageFile ? URL.createObjectURL(imageFile) : `${url}${ciudad!.image}`}
                  alt="preview"
                  className="mt-2 max-h-44 w-full rounded-lg object-cover border border-border"
                />
              )}
            </div>
          </div>

          <SheetFooter className="px-6 py-4 border-t border-border/40 flex items-center justify-end gap-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
