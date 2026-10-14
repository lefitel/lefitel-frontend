import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createTramo, editTramo, getOpcionesTramo, tramoDelConflicto, type OpcionesTramo,
} from "../../../api/Tramo.api";
import { mensajeDeError } from "../../../api/descarga";
import type { Departamento, Tramo } from "../../../interfaces/interfaces";
import FormDialog from "../FormDialog";
import { Combobox, type ComboboxOption } from "../../ui/combobox";
import { Label } from "../../ui/label";
import { nombreDeCiudad } from "../../../lib/nombreDeCiudad";

export interface TramoSheetProps {
  tramo?: Tramo | null;              // present: editing
  open: boolean;
  setOpen: (v: boolean) => void;
  /** Called with the tramo that now exists: created, edited, or the one a 409 pointed at. */
  onSuccess: (tramo: Tramo) => void;
  /** Lists handed in by a form that already has them; without them the sheet asks `/api/tramo/options`. */
  ciudades?: { id: number; name: string | null }[];
  departamentos?: Departamento[];
  /** Whether the two cities can be changed. False for a tramo that has poles. */
  ciudadesEditables?: boolean;
}

/** The department picker's first entry. Not an id, so it cannot be mistaken for one. */
const NINGUNO = "ninguno";
const DOS_CIUDADES = "Elige dos ciudades distintas";

/** The sentence a refusal carries, when it carries one. */
const fraseDelServidor = (error: unknown): string | null => {
  const frase = (error as { response?: { data?: { message?: unknown } } } | null | undefined)?.response?.data?.message;
  return typeof frase === "string" && frase.trim() !== "" ? frase : null;
};

export default function TramoSheet({
  tramo, open, setOpen, onSuccess, ciudades: ciudadesRecibidas, departamentos: departamentosRecibidos,
  ciudadesEditables = true,
}: TramoSheetProps) {
  const isEditing = !!tramo;
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [departamento, setDepartamento] = useState(NINGUNO);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Lists: the ones the caller already had, or the ones this sheet asks for.
  const recibidas = !!ciudadesRecibidas && !!departamentosRecibidos;
  const [pedidas, setPedidas] = useState<OpcionesTramo | null>(null);
  const [estadoListas, setEstadoListas] = useState<"cargando" | "listo" | "fallo">("cargando");

  useEffect(() => {
    if (!open || recibidas) return;
    let vigente = true;
    setEstadoListas("cargando");
    getOpcionesTramo()
      .then((o) => { if (vigente) { setPedidas(o); setEstadoListas("listo"); } })
      .catch(() => { if (vigente) setEstadoListas("fallo"); });
    return () => { vigente = false; };
  }, [open, recibidas]);

  const listasListas = recibidas || estadoListas === "listo";
  const listaCiudades = ciudadesRecibidas ?? pedidas?.ciudad;
  const listaDepartamentos = departamentosRecibidos ?? pedidas?.departamento;

  useEffect(() => {
    if (!open) { setErrors({}); return; }
    setA(tramo?.ciudades?.[0]?.id != null ? String(tramo.ciudades[0].id) : "");
    setB(tramo?.ciudades?.[1]?.id != null ? String(tramo.ciudades[1].id) : "");
    setDepartamento(tramo?.id_departamento != null ? String(tramo.id_departamento) : NINGUNO);
  }, [open, tramo]);

  const handleClose = () => {
    setErrors({});
    setOpen(false);
  };

  // The tramo's own cities are always in the list, even when the catalogue does
  // not have them (an archived city still bounds a live tramo): a locked picker
  // that showed "Seleccionar..." instead of the city would be a lie.
  const opcionesCiudad = useMemo<ComboboxOption[]>(() => {
    const base = (listaCiudades ?? []).map((c) => ({ value: String(c.id), label: nombreDeCiudad(c) }));
    const extra = (tramo?.ciudades ?? [])
      .filter((c) => c && !base.some((o) => o.value === String(c.id)))
      .map((c) => ({ value: String(c.id), label: nombreDeCiudad(c) }));
    return [...base, ...extra];
  }, [listaCiudades, tramo]);

  const opcionesDepartamento = useMemo<ComboboxOption[]>(() => [
    { value: NINGUNO, label: "Sin departamento" },
    ...(listaDepartamentos ?? []).map((d) => ({ value: String(d.id), label: d.name })),
  ], [listaDepartamentos]);

  const limpiar = (campo: string) => { if (errors[campo]) setErrors((p) => ({ ...p, [campo]: "" })); };

  const handleSave = async () => {
    const cambiaCiudades = !isEditing || ciudadesEditables;
    if (cambiaCiudades && (!a || !b || a === b)) {
      setErrors({ ciudades: DOS_CIUDADES });
      return;
    }

    setSaving(true);
    try {
      let resultado: Tramo;
      if (isEditing) {
        // `null` clears the department; leaving the key out would leave it as it was.
        resultado = await editTramo(tramo!.id, {
          id_departamento: departamento === NINGUNO ? null : Number(departamento),
          ...(ciudadesEditables ? { ciudades: [Number(a), Number(b)] as [number, number] } : {}),
        });
        toast.success("Tramo actualizado");
      } else {
        resultado = await createTramo({
          ciudades: [Number(a), Number(b)],
          // No key at all when there is none: a new tramo has no department to clear.
          ...(departamento === NINGUNO ? {} : { id_departamento: Number(departamento) }),
        });
        toast.success("Tramo creado");
      }
      handleClose();
      onSuccess(resultado);
    } catch (error) {
      const existente = tramoDelConflicto(error);
      if (existente) {
        if (!isEditing && !existente.archivado) {
          // Not a failure: the pair is there, which is what was being looked for.
          toast.info(`Ese tramo ya existía: ${existente.nombre}`);
          handleClose();
          onSuccess(existente);
          return;
        }
        // An archived holder cannot be used, and moving onto another tramo's
        // pair is a refusal: either way nothing is chosen, and the server's
        // sentence says what to do about it.
        setErrors({ ciudades: fraseDelServidor(error) ?? "Ese par de ciudades ya pertenece a otro tramo." });
        return;
      }
      toast.error(mensajeDeError(error, isEditing ? "No se pudo guardar los cambios" : "No se pudo crear el tramo"));
    } finally {
      setSaving(false);
    }
  };

  const mismoPar = isEditing && !!tramo?.ciudades?.some((c) => String(c?.id) === a) && !!tramo.ciudades.some((c) => String(c?.id) === b) && a !== b;

  const dirty = isEditing
    ? a !== String(tramo!.ciudades?.[0]?.id ?? "") || b !== String(tramo!.ciudades?.[1]?.id ?? "")
      || departamento !== (tramo!.id_departamento != null ? String(tramo!.id_departamento) : NINGUNO)
    : !!a || !!b || departamento !== NINGUNO;

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      title={isEditing ? "Editar tramo" : "Nuevo tramo"}
      description={isEditing
        ? "Cambia el departamento o, si no tiene postes, las ciudades que une."
        : "Une dos ciudades. El orden en que las elijas no importa."}
      dirty={dirty}
      missing={[
        (!isEditing || ciudadesEditables) && (!a || !b) && "Ciudades",
      ].filter((c): c is string => !!c)}
      saving={saving}
      submitDisabled={!listasListas}
      submitLabel={isEditing ? "Guardar cambios" : "Crear tramo"}
      onSubmit={() => void handleSave()}
      bodyClassName="space-y-5"
    >
      {!recibidas && estadoListas === "fallo" && (
        <p role="alert" className="text-sm text-destructive">
          No se pudieron cargar las ciudades y los departamentos. Cierra el formulario y vuelve a abrirlo.
        </p>
      )}

      <div className="space-y-1.5">
        <Label>
          Ciudad <span className="text-destructive">*</span>
        </Label>
        <Combobox
          ariaLabel="Ciudad, un extremo"
          options={opcionesCiudad.filter((o) => o.value !== b)}
          value={a}
          onValueChange={(v) => { setA(v); limpiar("ciudades"); }}
          placeholder="Seleccionar ciudad..."
          searchPlaceholder="Buscar ciudad..."
          disabled={isEditing && !ciudadesEditables}
        />
      </div>

      <div className="space-y-1.5">
        <Label>
          Ciudad <span className="text-destructive">*</span>
        </Label>
        <Combobox
          ariaLabel="Ciudad, el otro extremo"
          options={opcionesCiudad.filter((o) => o.value !== a)}
          value={b}
          onValueChange={(v) => { setB(v); limpiar("ciudades"); }}
          placeholder="Seleccionar ciudad..."
          searchPlaceholder="Buscar ciudad..."
          disabled={isEditing && !ciudadesEditables}
        />
        {errors.ciudades && <p role="alert" className="text-xs text-destructive mt-1">{errors.ciudades}</p>}
        {/* The name is the server's: shown only while the two cities are the ones it named. */}
        {mismoPar && <p className="text-xs text-muted-foreground">{tramo!.nombre}</p>}
        {isEditing && !ciudadesEditables && (
          <p className="text-xs text-muted-foreground">Las ciudades no se pueden cambiar mientras el tramo tenga postes.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>
          Departamento <span className="text-xs text-muted-foreground">(opcional)</span>
        </Label>
        <Combobox
          ariaLabel="Departamento"
          options={opcionesDepartamento}
          value={departamento}
          onValueChange={setDepartamento}
          placeholder="Sin departamento"
          searchPlaceholder="Buscar departamento..."
        />
        {!isEditing && <p className="text-xs text-muted-foreground">Se puede asignar después desde la lista.</p>}
      </div>
    </FormDialog>
  );
}
