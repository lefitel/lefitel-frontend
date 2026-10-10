import { useEffect, useState } from "react";
import { toast } from "sonner";
import BaseMap from "../../map/BaseMap";
import { SonarMarker } from "../../map/SonarMarker";
import { MAP_RADIUS, MAP_DOT } from "../../map/mapConstants";
import MapSearch from "../../map/MapSearch";
import { createCiudad, editCiudad } from "../../../api/Ciudad.api";
import { uploadImage } from "../../../api/Upload.api";
import { mensajeDeError } from "../../../api/descarga";
import { imageUrl } from "../../../lib/imageUrl";
import { CiudadInterface } from "../../../interfaces/interfaces";
import { latExample, lngExample } from "../../../data/example";
import FormDialog from "../FormDialog";
import CoordInputs from "../../map/CoordInputs";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { ImageDropzone } from "../../ui/image-dropzone";

interface Props {
  ciudad?: CiudadInterface | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}

export default function CiudadSheet({ ciudad, open, setOpen, onSuccess }: Props) {
  const isEditing = !!ciudad;
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
        const r = await uploadImage(imageFile);
        if (!r.ok) { toast.error(r.message); return; }
        imagePath = r.path;
      }

      if (isEditing) {
        await editCiudad({ ...ciudad!, name, lat, lng, image: imagePath });
        toast.success("Ciudad actualizada");
      } else {
        await createCiudad({ name, image: imagePath, lat, lng });
        toast.success("Ciudad creada");
      }
      handleClose();
      onSuccess();
    } catch (error) {
      // La frase del servidor, no una nuestra. Aquí importa más que en casi
      // ningún sitio: la causa habitual de un rechazo es un nombre repetido o
      // unas coordenadas fuera de rango, y «No se pudo guardar los cambios» no
      // dice cuál de las dos ni deja arreglarlo sin adivinar.
      toast.error(mensajeDeError(error, isEditing ? "No se pudo guardar los cambios" : "No se pudo crear la ciudad"));
    } finally {
      setSaving(false);
    }
  };

  const sinUbicacion = lat === 0 && lng === 0;

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      title={isEditing ? "Editar ciudad" : "Nueva ciudad"}
      description={isEditing
        ? "Modifica el nombre, la ubicación o la foto de la ciudad."
        : "Un nodo de la red: los tramos corren de una ciudad a otra."}
      dirty={
        name !== (ciudad?.name ?? "") || lat !== (ciudad?.lat ?? 0) || lng !== (ciudad?.lng ?? 0) || !!imageFile
      }
      missing={[
        !name.trim() && "Nombre",
        sinUbicacion && "Ubicación",
        !isEditing && !imageFile && "Foto",
      ].filter((c): c is string => !!c)}
      saving={saving}
      submitLabel={isEditing ? "Guardar cambios" : "Crear ciudad"}
      onSubmit={() => void handleSave()}
      bodyClassName="space-y-5"
    >
      <div className="space-y-1.5">
        <Label htmlFor="ciudad-name">
          Nombre <span className="text-destructive">*</span>
        </Label>
        <Input
          id="ciudad-name"
          value={name}
          onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: "" })); }}
          placeholder="Nombre de la ciudad"
          aria-invalid={!!errors.name}
        />
        {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label>
          Ubicación <span className="text-destructive">*</span>
        </Label>
        {/* Enter in the place search looks a place up; it does not save the form. */}
        <div data-no-submit className="relative h-64 rounded-lg overflow-hidden border border-border isolate">
          <BaseMap
            key={`${ciudad?.id ?? "new"}-${open}`}
            center={lat !== 0 && lng !== 0
              ? { lat, lng }
              : { lat: latExample, lng: lngExample }}
            zoom={lat !== 0 ? 13 : 5}
            style={{ height: "100%" }}
            onMapClick={(p) => {
              setLat(p.lat);
              setLng(p.lng);
              if (errors.location) setErrors((prev) => ({ ...prev, location: "" }));
            }}
          >
            <MapSearch />
            {lat !== 0 && lng !== 0 && (
              <SonarMarker
                center={[lat, lng]}
                fillColor={MAP_DOT.subject}
                strokeColor="#ffffff"
                rgb={MAP_DOT.subjectRgb}
                dotRadius={MAP_RADIUS.main}
                weight={1.5}
              />
            )}
          </BaseMap>
        </div>
        <CoordInputs
          id="ciudad"
          lat={lat}
          lng={lng}
          invalid={!!errors.location}
          onChange={(nuevaLat, nuevaLng) => {
            setLat(nuevaLat);
            setLng(nuevaLng);
            if (errors.location) setErrors((prev) => ({ ...prev, location: "" }));
          }}
        />
        {errors.location
          ? <p className="text-xs text-destructive">{errors.location}</p>
          : <p className="text-xs text-muted-foreground">Pulsa en el mapa para colocar la ciudad, o escribe las coordenadas.</p>}
      </div>

      <div className="space-y-1.5">
        <Label>
          Foto{" "}
          {isEditing
            ? <span className="text-xs text-muted-foreground">(opcional)</span>
            : <span className="text-destructive">*</span>}
        </Label>
        <ImageDropzone
          file={imageFile}
          onChange={(f) => { setImageFile(f); if (errors.image) setErrors(p => ({ ...p, image: "" })); }}
          existingUrl={imageUrl(ciudad?.image) ?? undefined}
          error={errors.image}
        />
      </div>
    </FormDialog>
  );
}
