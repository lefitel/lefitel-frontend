// What this screen is, for whoever opens it and does not know.
//
// It sits behind an icon rather than arriving as a first-visit walkthrough, and
// that is a choice, not a shortcut. A walkthrough shows up before the reader
// has a question, is seen exactly once, and needs somewhere to remember it was
// seen — per browser, or a column and an endpoint. The moment the explanation
// is actually wanted is not minute zero: it is the afternoon somebody groups by
// tramo and the report is refused. An icon is there both times.
//
// It is deliberately short. The help that does the real work lives next to the
// thing it explains — the level of detail names what a row will be, the field
// picker says what a "Contar…" is, the column panel states the grouping rule
// while a report is grouping. This is the map, not the manual.

import { InfoIcon } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";

/** One step of the screen: what it is for, in the order it is used. */
const STEPS: { title: string; body: string }[] = [
  {
    title: "Nivel de detalle",
    body:
      "Lo primero y lo que más manda: decide qué representa una fila. Los mismos datos dan tablas " +
      "distintas según sea una fila por evento o una por revisión. Cambiarlo después descarta lo " +
      "que no exista en el nivel nuevo, y le avisa antes.",
  },
  {
    title: "Columnas",
    body:
      "Lo que se ve, en el orden en que se verá. Puede renombrar la cabecera, moverla y ordenar " +
      "por ella. Los campos que empiezan por «Contar» no son un dato guardado: se cuentan al " +
      "generar.",
  },
  {
    title: "Filtros",
    body:
      "Lo que se queda fuera. Sin filtros entra todo. Con dos o más puede elegir si han de " +
      "cumplirse todos o basta con cualquiera.",
  },
  {
    title: "Agrupar",
    body:
      "Convierte el listado en un resumen: una fila por cada valor distinto en vez de una por " +
      "registro. En cuanto agrupa, toda columna tiene que estar agrupada o llevar un resumen.",
  },
  {
    title: "Generar",
    body:
      "El único botón que trae datos. Con «Auto» encendido la tabla se refresca sola; apáguelo si " +
      "su reporte tarda. El número de filas que ve al lado se calcula antes de pedirlas.",
  },
  {
    title: "Guardar",
    body:
      "Guarda la configuración, no los datos: al abrirlo se vuelve a generar. Con un reporte suyo " +
      "abierto el botón pasa a llamarse «Actualizar» y sobrescribe ese reporte, también para el " +
      "equipo si estaba compartido.",
  },
];

const PageHelp = () => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        aria-label="Cómo funciona el generador"
      >
        <InfoIcon className="h-4 w-4" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="max-h-[70vh] w-96 overflow-y-auto">
      <p className="text-sm">
        Arme la tabla que necesite y expórtela. Se construye de arriba abajo por el panel de la
        izquierda, y el resultado se va viendo a la derecha.
      </p>

      <dl className="mt-3 space-y-3">
        {STEPS.map((step) => (
          <div key={step.title}>
            <dt className="text-sm font-medium">{step.title}</dt>
            <dd className="text-xs text-muted-foreground">{step.body}</dd>
          </div>
        ))}
      </dl>

      {/*
        Said here because nothing else on the screen says it. The switch beside
        the export buttons is called "Fotos en el Excel", which is accurate and
        reads to most people as "fotos", and the column of photographs comes out
        of the PDF as a column of "Sí". Somebody exports a PDF for a client
        expecting the photographs to be in it.
      */}
      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        <strong className="font-medium text-foreground">Ojo con el PDF:</strong> no lleva
        fotografías. Si las necesita, exporte a Excel con «Fotos en el Excel» encendido.
      </p>
    </PopoverContent>
  </Popover>
);

export default PageHelp;
