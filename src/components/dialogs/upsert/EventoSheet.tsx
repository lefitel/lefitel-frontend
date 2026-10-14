import { useContext, useEffect, useState } from "react";
import { ImageDropzone } from "../../ui/image-dropzone";
import { Textarea } from "../../ui/textarea";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { nombreDelTramo } from "../../../lib/tramo";
import { createEvento, editEvento, searchEvento } from "../../../api/Evento.api";
import { todosLosPostes } from "../../../api/Poste.api";
import { mensajeDeError } from "../../../api/descarga";
import { getRevision } from "../../../api/Revision.api";
import { getSolucion_evento } from "../../../api/Solucion.api";
import { getEventoObs } from "../../../api/EventoObs.api";
import {
  estadoTrasFallo, getOpcionesEvento, EstadoOpciones, OpcionObs, OpcionSimple,
} from "../../../api/opciones.api";
import { uploadImage } from "../../../api/Upload.api";
import { imageUrl } from "../../../lib/imageUrl";
import {
  EventoInterface, PosteInterface, RevisionInterface, SolucionInterface,
} from "../../../interfaces/interfaces";
import { Combobox } from "../../ui/combobox";
import { Label } from "../../ui/label";
import { Badge } from "../../ui/badge";
import { Skeleton } from "../../ui/skeleton";
import { DatePicker } from "../../ui/date-picker";
import FormDialog from "../FormDialog";
import ObsPicker from "../ObsPicker";
import { Switch } from "../../ui/switch";
import { CalendarIcon, ExternalLinkIcon } from "lucide-react";

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
  eventoId?: number | null;
  posteId?: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}

export default function EventoSheet({ eventoId, posteId, open, setOpen, onSuccess }: Props) {
  const isEditing = !!eventoId;
  const { sesion } = useContext(SesionContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [evento, setEvento] = useState<EventoInterface | null>(null);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Create-only fields
  const [revDesc, setRevDesc] = useState("");
  const [revDate, setRevDate] = useState<Date>(new Date());

  // Edit-only fields
  const [revisions, setRevisions] = useState<RevisionInterface[]>([]);
  const [solucion, setSolucion] = useState<SolucionInterface | null>(null);

  const [listObs, setListObs] = useState<OpcionObs[]>([]);
  const [listTipoObs, setListTipoObs] = useState<OpcionSimple[]>([]);
  /**
   * Why the observation accordion is empty, when it is.
   *
   * The two lists now come from `/api/evento/options`, which asks for
   * `eventos.ver`. This sheet has five mount points across four files, and
   * three of them are outside anything that guarantees that permission: the
   * pole list (`postes.crear` on the trigger) and both on the pole detail page
   * (`eventos.crear` on one, `eventos.editar` on the other). All three sit
   * behind `postes.ver`, not `eventos.ver`, so a role holding `eventos.crear`
   * or `eventos.editar` without `eventos.ver` reaches a form the server
   * refuses.
   *
   * **What that means differs between the two modes, and so does the
   * sentence.** Creating an incident needs at least one observation, so
   * without the lists there is nothing to do. Editing one does not:
   * `selectedObs` comes from `getEventoObs`, a separate request about this
   * incident which keeps working, so the description can still be corrected
   * and saved with its observations intact. Telling that user they cannot
   * register the incident would simply be false.
   */
  const [estadoOpciones, setEstadoOpciones] = useState<EstadoOpciones>("cargando");
  const [selectedObs, setSelectedObs] = useState<number[]>([]);
  /** The observations the incident arrived with. What `selectedObs` is compared against to know if anything changed. */
  const [obsInicial, setObsInicial] = useState<number[]>([]);

  /**
   * Opened with neither an incident nor a pole: the pole is chosen here.
   *
   * That used to be a second form, `AddEventoPageSheet`, a copy of this one
   * with a combobox added — its accordion and its validation written out
   * again. The home screen and the incident list open this form that way now.
   */
  const eligePoste = !isEditing && !posteId;
  const [listPoste, setListPoste] = useState<PosteInterface[]>([]);
  const [selectedPosteId, setSelectedPosteId] = useState(0);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setEstadoOpciones("cargando");

    // The catalogues load **beside** the incident, not with it. They used to
    // share one `Promise.all` in edit mode, which was harmless while they came
    // from two ungated addresses: now a refusal on the catalogues would reject
    // the whole batch and draw this sheet completely blank — no description, no
    // revisions, no solution — for an incident the role is perfectly entitled
    // to read. Two questions, two answers.
    const opciones = getOpcionesEvento()
      .then((o) => {
        setListObs(o.obs);
        setListTipoObs(o.tipoObs);
        setEstadoOpciones("listas");
      })
      .catch((error) => {
        setListObs([]);
        setListTipoObs([]);
        setEstadoOpciones(estadoTrasFallo(error));
      });

    const detalle = isEditing && eventoId
      ? Promise.all([
        searchEvento(eventoId),
        getRevision(eventoId),
        getSolucion_evento(eventoId).catch(() => null),
        getEventoObs(eventoId),
      ])
        .then(([ev, revs, sol, evObs]) => {
          setEvento(ev);
          setDescription(ev.description);
          setPriority(ev.priority ?? false);
          setRevisions(revs);
          setSolucion(sol);
          const ids = evObs.map((eo) => eo.id_obs);
          setSelectedObs(ids);
          setObsInicial(ids);
        })
        .catch(() => toast.error("Error al cargar el evento"))
      : Promise.resolve();

    // The pole register is its own request, not a block inside
    // `/api/evento/options`: putting it there would serve the whole register
    // under `eventos.ver`, which is worse than the round trip it saves.
    // Separate also means a refusal on one does not empty the other.
    //
    // And a refusal is possible: `GET /api/poste/` asks for `postes.ver`,
    // while this form opens on `eventos.crear`. A role can register incidents
    // without reading the pole register, and then the combobox is empty for a
    // reason worth saying — the sentence is the server's own.
    const postes = eligePoste
      ? todosLosPostes()
        .then(setListPoste)
        .catch((error) => {
          setListPoste([]);
          toast.error(mensajeDeError(
            error,
            "No se pudo cargar la lista de postes, así que no se puede elegir uno.",
          ));
        })
      : Promise.resolve();

    Promise.all([opciones, detalle, postes]).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventoId]);

  const handleClose = () => {
    setEvento(null);
    setDescription("");
    setPriority(false);
    setImageFile(null);
    setRevDesc("");
    setRevDate(new Date());
    setRevisions([]);
    setSolucion(null);
    setSelectedObs([]);
    setObsInicial([]);
    setSelectedPosteId(0);
    setErrors({});
    setOpen(false);
  };

  const toggleObs = (id: number) => {
    setSelectedObs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!description.trim()) newErrors.description = "La descripción es requerida";
    if (selectedObs.length === 0) newErrors.obs = "Selecciona al menos una observación";
    if (!isEditing) {
      if (eligePoste && !selectedPosteId) newErrors.poste = "Selecciona un poste";
      if (!imageFile) newErrors.image = "La imagen es requerida";
      if (!revDesc.trim()) newErrors.revDesc = "La descripción de la revisión inicial es requerida";
    }
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      if (isEditing) {
        if (!evento?.id) return;
        let imagePath = evento.image;
        if (imageFile) {
          const r = await uploadImage(imageFile);
          if (!r.ok) { toast.error(r.message); return; }
          imagePath = r.path;
        }
        await editEvento(
          { ...evento, description, priority, image: imagePath, id_usuario: evento.id_usuario ?? sesion.usuario.id ?? 0, obs_ids: selectedObs }
        );
        toast.success("Evento actualizado");
      } else {
        const subida = await uploadImage(imageFile!);
        if (!subida.ok) { toast.error(subida.message); return; }
        const uploadResult = subida.path;
        await createEvento(
          {
            description,
            image: uploadResult,
            date: revDate,
            state: false,
            priority,
            id_poste: posteId ?? selectedPosteId,
            id_usuario: sesion.usuario.id ?? 0,
            obs_ids: selectedObs,
            revision: { description: revDesc, date: revDate },
          }
        );
        toast.success("Evento creado");
      }

      handleClose();
      onSuccess();
    } catch (error) {
      toast.error(mensajeDeError(error, "Error al guardar"));
    } finally {
      setSaving(false);
    }
  };

  const resuelto = isEditing && !!evento?.state;
  const canEdit = !isEditing || (can(sesion.usuario.id_rol, "eventos", "editar") && !resuelto);
  /**
   * Opened to be read. A resolved incident, or a role without `eventos.editar`.
   *
   * The second case used to draw the whole form, every field live, above a
   * footer with no button to save it: somebody could rewrite the description
   * and find out at the end that there was nothing to press.
   */
  const soloLectura = isEditing && !canEdit;

  const posteElegido = listPoste.find((p) => p.id === selectedPosteId);
  const poste = isEditing ? evento?.poste : posteElegido;
  const tramo = nombreDelTramo(poste) || null;

  /** Whether closing now would lose something typed. The frame asks before it does. */
  const cambiado = isEditing
    ? !!evento && (
      description !== evento.description
      || priority !== (evento.priority ?? false)
      || !!imageFile
      || [...selectedObs].sort().join() !== [...obsInicial].sort().join()
    )
    : !!(description || priority || imageFile || revDesc || selectedObs.length || selectedPosteId);

  const faltan = [
    eligePoste && !selectedPosteId && "Poste",
    !description.trim() && "Descripción",
    !isEditing && !imageFile && "Foto",
    selectedObs.length === 0 && "Observaciones",
    !isEditing && !revDesc.trim() && "Primera revisión",
  ].filter((c): c is string => !!c);

  const estado = resuelto
    ? <Badge className="bg-primary/10 text-primary border-transparent shadow-none text-xs">Resuelto</Badge>
    : <Badge className="bg-amber-500/10 text-amber-600 border-transparent shadow-none text-xs">Pendiente</Badge>;

  /** Where the incident is and who raised it — one strip, where it was a table of five rows. */
  const contexto = isEditing && evento && (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
      <span className="text-muted-foreground">
        Poste{" "}
        {evento.poste?.id ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            onClick={() => { handleClose(); navigate(`/app/postes/${evento.poste!.id}`); }}
          >
            {evento.poste.name}
            <ExternalLinkIcon className="h-3 w-3" />
          </button>
        ) : (
          <span className="font-medium text-foreground">{evento.poste?.name ?? "—"}</span>
        )}
      </span>
      {evento.poste?.propietario?.name && (
        <span className="text-muted-foreground">
          Propietario <span className="font-medium text-foreground">{evento.poste.propietario.name}</span>
        </span>
      )}
      {evento.usuario && (
        <span className="text-muted-foreground">
          Creado por{" "}
          <span className="font-medium text-foreground">{evento.usuario.name} {evento.usuario.lastname}</span>
        </span>
      )}
      <span className="ml-auto">{estado}</span>
    </div>
  );

  const solucionCard = solucion && (
    <Grupo titulo="Solución">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarIcon className="h-3 w-3" />
          {new Date(solucion.date).toLocaleDateString("es-ES")}
        </div>
        <p className="text-sm">{solucion.description}</p>
        {solucion.image && (
          <img src={imageUrl(solucion.image) ?? undefined} alt="Foto de la solución" className="mt-1 max-h-40 rounded-lg object-contain border border-border" />
        )}
      </div>
    </Grupo>
  );

  const revisionesList = revisions.length === 0 ? (
    <p className="text-xs text-muted-foreground">Sin revisiones registradas</p>
  ) : (
    <div className="space-y-2">
      {revisions.map((rev, i) => (
        <div key={rev.id ?? i} className="rounded-lg border border-border px-3 py-2.5 space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarIcon className="h-3 w-3" />
            {new Date(rev.date).toLocaleDateString("es-ES")}
          </div>
          <p className="text-sm">{rev.description}</p>
        </div>
      ))}
    </div>
  );

  return (
    <FormDialog
      open={open}
      onClose={handleClose}
      size="wide"
      title={isEditing
        ? (loading ? <Skeleton className="h-6 w-32" /> : `Evento #${evento?.id ?? ""}`)
        : "Nuevo evento"}
      description={
        soloLectura && !resuelto
          ? "Solo lectura: tu rol puede ver los eventos, no editarlos."
          : resuelto
            ? "Este evento está resuelto y ya no se edita."
            : tramo
              ? `Tramo ${tramo}`
              : isEditing
                ? "Edita los datos del evento."
                : eligePoste
                  ? "Registra un evento en un poste de la red."
                  : "Registra un evento en este poste."
      }
      dirty={!soloLectura && cambiado}
      missing={faltan}
      saving={saving}
      submitLabel={isEditing ? "Guardar cambios" : "Crear evento"}
      onSubmit={soloLectura ? undefined : () => void handleSave()}
      submitDisabled={loading}
      bodyClassName="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-start"
    >
      {loading ? (
        <div className="space-y-3 lg:col-span-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : soloLectura ? (
        // ── Read: what happened and how it ended, not a form with its fields off ──
        <>
          <div className="space-y-6 min-w-0">
            {contexto}
            <Grupo titulo="Qué pasó">
              <p className="text-sm whitespace-pre-wrap">{description || "—"}</p>
              {priority && <p className="text-xs font-medium text-destructive">Evento prioritario</p>}
              <ImageDropzone file={null} onChange={() => {}} existingUrl={imageUrl(evento?.image) ?? undefined} readOnly />
            </Grupo>
            {solucionCard}
          </div>
          <div className="space-y-6 min-w-0">
            <Grupo titulo="Observaciones">
              {selectedObs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin observaciones</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {selectedObs.map((id) => (
                    <li key={id} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {listObs.find((o) => o.id === id)?.name ?? `Observación #${id}`}
                    </li>
                  ))}
                </ul>
              )}
            </Grupo>
            <Grupo titulo="Revisiones" extra={revisions.length || undefined}>
              {revisionesList}
            </Grupo>
          </div>
        </>
      ) : (
        <>
          {/* ── Left: where, what, and the first look at it ── */}
          <div className="space-y-6 min-w-0">
            {contexto}

            {eligePoste && (
              <Grupo titulo="Dónde">
                <div className="space-y-1.5">
                  <Label>Poste <span className="text-destructive">*</span></Label>
                  <Combobox
                    options={listPoste.map((p) => ({ value: String(p.id), label: p.name }))}
                    value={selectedPosteId ? String(selectedPosteId) : ""}
                    onValueChange={(v) => { setSelectedPosteId(Number(v)); if (errors.poste) setErrors(p => ({ ...p, poste: "" })); }}
                    placeholder="Buscar poste..."
                  />
                  {errors.poste && <p className="text-xs text-destructive mt-1">{errors.poste}</p>}
                </div>
                {posteElegido && (
                  <p className="text-xs text-muted-foreground">
                    {nombreDelTramo(posteElegido) || "—"}
                    {posteElegido.propietario?.name && <> · {posteElegido.propietario.name}</>}
                  </p>
                )}
              </Grupo>
            )}

            <Grupo titulo="Qué pasa">
              <div className="space-y-1.5">
                <Label htmlFor="evento-description">Descripción <span className="text-destructive">*</span></Label>
                <Textarea
                  id="evento-description"
                  className="resize-none min-h-20" aria-invalid={!!errors.description}
                  placeholder="Describe el problema encontrado..."
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors(p => ({ ...p, description: "" })); }}
                />
                {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
              </div>

              {/* Said with what it does. It was a switch and two words; what it
                  changes — the colour on every map, and the pole's own state —
                  was something to find out afterwards. */}
              <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <Switch id="evento-priority" checked={priority} onCheckedChange={setPriority} />
                <div>
                  <Label htmlFor="evento-priority" className="cursor-pointer">Evento prioritario</Label>
                  <p className="text-xs text-muted-foreground">Sale en rojo en los mapas y pone el poste en estado crítico.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Foto {!isEditing && <span className="text-destructive">*</span>}</Label>
                <ImageDropzone
                  file={imageFile}
                  onChange={(f) => { setImageFile(f); if (errors.image) setErrors(p => ({ ...p, image: "" })); }}
                  existingUrl={imageUrl(evento?.image) ?? undefined}
                  error={errors.image}
                />
              </div>
            </Grupo>

            {!isEditing && (
              <Grupo titulo="Primera revisión">
                <div className="space-y-1.5">
                  <Label>Fecha</Label>
                  <DatePicker value={revDate} onSelect={(d) => d && setRevDate(d)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="evento-revision">Qué se vio al revisarlo <span className="text-destructive">*</span></Label>
                  <Textarea
                    id="evento-revision"
                    className="resize-none min-h-16" aria-invalid={!!errors.revDesc}
                    placeholder="Describe la inspección inicial..."
                    value={revDesc}
                    onChange={(e) => { setRevDesc(e.target.value); if (errors.revDesc) setErrors(p => ({ ...p, revDesc: "" })); }}
                  />
                  {errors.revDesc && <p className="text-xs text-destructive mt-1">{errors.revDesc}</p>}
                </div>
              </Grupo>
            )}

            {isEditing && (
              // To be read, not edited: folded, so the form above stays the form.
              <details className="group">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Revisiones ({revisions.length})
                </summary>
                <div className="pt-3">{revisionesList}</div>
              </details>
            )}
            {isEditing && solucionCard}
          </div>

          {/* ── Right: the observations, all of them in view ── */}
          <div className="min-w-0">
            <Grupo
              titulo={isEditing ? "Observaciones" : "Observaciones *"}
              extra={selectedObs.length > 0
                ? `${selectedObs.length} ${selectedObs.length === 1 ? "elegida" : "elegidas"}`
                : undefined}
            >
              <ObsPicker
                tipos={listTipoObs}
                obs={listObs}
                selected={selectedObs}
                onToggle={(id) => { toggleObs(id); if (errors.obs) setErrors(p => ({ ...p, obs: "" })); }}
                estado={estadoOpciones}
                editing={isEditing}
              />
              {errors.obs && <p className="text-xs text-destructive">{errors.obs}</p>}
            </Grupo>
          </div>
        </>
      )}
    </FormDialog>
  );
}
