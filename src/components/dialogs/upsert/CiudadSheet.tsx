import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { MapContainer, useMapEvent } from "react-leaflet";
import { SonarMarker } from "../../map/SonarMarker";
import ThemedTileLayer from "../../map/ThemedTileLayer";
import MapSearch from "../../map/MapSearch";
import { SesionContext } from "../../../context/SesionContext";
import { createCiudad, editCiudad } from "../../../api/Ciudad.api";
import { uploadImage } from "../../../api/Upload.api";
import { url } from "../../../api/url";
import { CiudadInterface } from "../../../interfaces/interfaces";
import { latExample, lngExample } from "../../../data/example";
import { Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription } from "../../ui/sheet";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Loader2Icon } from "lucide-react";
import { ImageDropzone } from "../../ui/image-dropzone";
import { Button } from "../../ui/button";

interface Props {
  ciudad?: CiudadInterface | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}

function LocationPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvent("click", (e) => onPick(e.latlng.lat, e.latlng.lng));
  return null;
}

export default function CiudadSheet({ ciudad, open, setOpen, onSuccess }: Props) {
  const isEditing = !!ciudad;
  const { sesion } = useContext(SesionContext);
  const [name, setName] = useState("");
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) { setErrors({}); return; }
    if (ciudad) {
      setName(ciudad.name);
      setLat(ciudad.lat);
      setLng(ciudad.lng);
    } else {
      setName("");
      setLat(0);
      setLng(0);
    }
    setImageFile(null);
  }, [open, ciudad]);

  const handleClose = () => {
    setImageFile(null);
    setErrors({});
    setOpen(false);
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "El nombre es requerido";
    if (!isEditing && !imageFile) newErrors.image = "La imagen es requerida";
    if (lat === 0 && lng === 0) newErrors.location = "Selecciona una ubicación en el mapa";
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      let imagePath = ciudad?.image ?? "";
      if (imageFile) {
        const r = await uploadImage(imageFile, sesion.token);
        if (r === "500") { toast.error("Error al subir la imagen"); return; }
        imagePath = r;
      }

      if (isEditing) {
        const result = await editCiudad({ ...ciudad!, name, lat, lng, image: imagePath }, sesion.token);
        if (result === 200) {
          toast.success("Ciudad actualizada");
          handleClose();
          onSuccess();
        } else {
          toast.error("No se pudo guardar los cambios");
        }
      } else {
        const result = await createCiudad({ name, image: imagePath, lat, lng }, sesion.token);
        if (Number(result) === 200) {
          toast.success("Ciudad creada");
          handleClose();
          onSuccess();
        } else {
          toast.error("No se pudo crear la ciudad");
        }
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <SheetTitle>{isEditing ? "Editar Ciudad" : "Nueva Ciudad"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Modifica el nombre, ubicación e imagen de la ciudad."
              : "Registra una nueva ciudad como nodo de red."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-3 items-start content-start">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ciudad-name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ciudad-name"
              value={name}
              onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: "" })); }}
              placeholder="Nombre de la ciudad"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              Coordenadas <span className="text-destructive">*</span>
              <span className="text-xs text-muted-foreground ml-1.5 font-normal">(haz clic en el mapa)</span>
            </Label>
            <div className="relative h-72 rounded-lg overflow-hidden border border-border isolate">
              <MapContainer
                key={`${ciudad?.id ?? "new"}-${open}`}
                center={lat !== 0 && lng !== 0 ? [lat, lng] : [latExample, lngExample]}
                zoom={lat !== 0 ? 13 : 5}
                style={{ height: "100%" }}
                scrollWheelZoom
                zoomControl={false}
              >
                <ThemedTileLayer />
                <MapSearch />
                <LocationPicker onPick={(lt, lg) => { setLat(lt); setLng(lg); if (errors.location) setErrors(p => ({ ...p, location: "" })); }} />
                {lat !== 0 && lng !== 0 && (
                  <SonarMarker
                    center={[lat, lng]}
                    fillColor="#596BAB"
                    strokeColor="#ffffff"
                    rgb="89, 107, 171"
                    dotRadius={8}
                    weight={1.5}
                  />
                )}
              </MapContainer>

              <div className="absolute bottom-3 left-3 right-3 z-1000 flex gap-2">
                <div className="flex items-center gap-2 bg-background/90 supports-backdrop-filter:backdrop-blur-sm border border-border rounded-md px-2.5 py-1.5 flex-1 shadow-sm">
                  <span className="text-xs text-muted-foreground shrink-0">Lat</span>
                  <Input
                    type="number"
                    step="0.000001"
                    value={lat}
                    onChange={(e) => { setLat(parseFloat(e.target.value) || 0); if (errors.location) setErrors(p => ({ ...p, location: "" })); }}
                    className="h-5 text-xs border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <div className="flex items-center gap-2 bg-background/90 supports-backdrop-filter:backdrop-blur-sm border border-border rounded-md px-2.5 py-1.5 flex-1 shadow-sm">
                  <span className="text-xs text-muted-foreground shrink-0">Lng</span>
                  <Input
                    type="number"
                    step="0.000001"
                    value={lng}
                    onChange={(e) => { setLng(parseFloat(e.target.value) || 0); if (errors.location) setErrors(p => ({ ...p, location: "" })); }}
                    className="h-5 text-xs border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>
            </div>
            {errors.location && <p className="text-xs text-destructive mt-1">{errors.location}</p>}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              Imagen{" "}
              {isEditing
                ? <span className="text-xs text-muted-foreground">(opcional)</span>
                : <span className="text-destructive">*</span>}
            </Label>
            <ImageDropzone
              file={imageFile}
              onChange={(f) => { setImageFile(f); if (errors.image) setErrors(p => ({ ...p, image: "" })); }}
              existingUrl={ciudad?.image ? `${url}${ciudad.image}` : undefined}
              error={errors.image}
            />
          </div>
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border/40">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white">
            {saving ? <><Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" />Guardando…</> : isEditing ? "Guardar" : "Crear ciudad"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
