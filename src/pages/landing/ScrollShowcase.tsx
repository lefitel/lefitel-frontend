import { Reveal } from "./chrome";
import { screenVars } from "./tokens";
import { CardPart, FilterPart, PlanPart } from "./parts/map";
import { FormPart, SavedPart } from "./parts/event";
import { ChartPart, CriticalsPart, KpiPart, PeriodPart } from "./parts/dashboard";
import { ColumnsPart, ExportPart } from "./parts/report";

/**
 * The public page's look inside the product.
 *
 * Eleven pieces of the system, each animating once as it scrolls into view.
 * This replaced a single window that cycled four whole screens on a timer. Two
 * things were wrong with that: the timer decided how fast a stranger got to
 * read, and a 940-pixel screen shrunk to phone width is not a screenshot, it is
 * a smudge. Pieces solve both. The reader sets the pace with the scrollbar, and
 * a card that is 300 pixels wide is 300 pixels wide on a phone too.
 *
 * What the pieces must not lose is the thread. Broken into eleven specimens
 * they would read as a parts catalogue, so they all follow one pole — P472,
 * hardware off the crossarm — from the plan it sits on to the
 * spreadsheet it ends up in. The captions name it out loud.
 *
 * Captions sit to the left of their piece rather than above it. Stacked, every
 * beat cost an extra hundred and thirty pixels and the section ran to five and
 * a half screens, which is a tour, not the quick look this is meant to be.
 * Beside, the captions line up into one column the eye can run down and the
 * pieces into another.
 */

function Caption({ tag, title, text }: { tag: string; title: string; text: string }) {
  return (
    <div className="max-w-xl">
      <p className="font-mono text-[10px] tracking-[0.18em] text-orange-400/75 uppercase">{tag}</p>
      <h3 className="mt-2.5 text-lg font-bold tracking-tight text-white sm:text-xl">{title}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-white/45">{text}</p>
    </div>
  );
}

/** A wide piece with its caption in the left column. */
function Row({
  id,
  tag,
  title,
  text,
  flip = false,
  children,
}: {
  id: string;
  tag: string;
  title: string;
  text: string;
  /** Piece on the left, caption on the right: for a piece too narrow to fill. */
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-piece={id}
      className={`grid gap-5 lg:grid-cols-12 lg:gap-8 ${flip ? "lg:items-center" : ""}`}
    >
      <Reveal
        className={flip ? "lg:col-span-5 lg:col-start-8 lg:row-start-1" : "lg:col-span-4"}
      >
        <Caption tag={tag} title={title} text={text} />
      </Reveal>
      <Reveal
        delay={0.12}
        className={`min-w-0 ${flip ? "lg:col-span-6 lg:row-start-1" : "lg:col-span-8"}`}
      >
        {children}
      </Reveal>
    </div>
  );
}

/** Two narrow pieces side by side, each under its own caption. */
function Half({
  id,
  tag,
  title,
  text,
  children,
}: {
  id: string;
  tag: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div data-piece={id} className="min-w-0 space-y-5">
      <Reveal>
        <Caption tag={tag} title={title} text={text} />
      </Reveal>
      <Reveal delay={0.12}>{children}</Reveal>
    </div>
  );
}

export function ScrollShowcase() {
  return (
    <section
      style={screenVars}
      className="relative border-t border-white/6 px-6 py-24 sm:py-28"
      aria-label="El sistema por dentro"
    >
      <div className="mx-auto max-w-[1040px]">
        <Reveal className="max-w-2xl">
          <p className="mb-5 text-xs font-semibold tracking-[0.25em] text-orange-400 uppercase">
            La plataforma
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Esto es lo que verás
            <br />
            <span className="text-white/30">cada mañana al entrar.</span>
          </h2>
          <p className="mt-6 text-[0.95rem] leading-relaxed text-white/45">
            Once piezas del sistema, cada una haciendo su trabajo. Todas siguen al mismo poste: el
            P472 del tramo Coroico › Coripata, con la ferretería fuera de la cruceta.
          </p>
        </Reveal>

        {/* measure rule: a quiet nod to the trade, and a break between text and screens */}
        <div
          aria-hidden="true"
          className="mt-12 h-3 w-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, oklch(1 0 0 / 0.13) 0 1px, transparent 1px 14px)",
            maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          }}
        />

        <div className="mt-12 space-y-14 sm:space-y-20">
          <Row
            id="plan"
            tag="Mapa · /app/ciudades"
            title="Cada poste, en su sitio."
            text="Mil quinientos cuarenta y un postes inspeccionados en ochenta y seis ciudades, sobre el plano. El color dice el estado de cada uno."
          >
            <PlanPart />
          </Row>

          <div className="grid gap-14 sm:gap-8 md:grid-cols-2">
            <Half
              id="card"
              tag="Poste · /app/postes"
              title="Un clic, y ahí está todo."
              text="El P472, en el tramo Coroico › Coripata: material, propietario, cuándo se instaló y cuándo se revisó por última vez."
            >
              <CardPart />
            </Half>
            <Half
              id="filter"
              tag="Mapa · filtro de vista"
              title="Solo lo que falta."
              text="De los mil quinientos, ciento cuarenta y ocho esperan cuadrilla. El resto se aparta."
            >
              <FilterPart />
            </Half>
          </div>

          <Row
            id="form"
            tag="Eventos · nuevo evento"
            title="Lo que se encuentra en la calle."
            text="El técnico elige el poste, describe el desperfecto, adjunta la fotografía y marca la gravedad. Un minuto, desde el móvil, al pie del poste. Tramo, propietario y fecha los rellena el sistema."
            flip
          >
            <FormPart />
          </Row>

          <Row
            id="saved"
            tag="Eventos · registro"
            title="Y ya está dentro."
            text="El parte entra en el registro con su observación, su estado y su fecha. A partir de aquí no depende de que nadie se acuerde."
          >
            <div className="pt-5">
              <SavedPart />
            </div>
          </Row>

          <Row
            id="kpi"
            tag="Inicio · indicadores"
            title="Las cifras salen de ahí."
            text="Ningún número se teclea a mano: se cuentan sobre los partes que llegan del campo, con su variación respecto al periodo anterior."
          >
            <KpiPart />
          </Row>

          <Row
            id="chart"
            tag="Inicio · actividad"
            title="Lo que entra y lo que se cierra."
            text="Eventos creados frente a resueltos, día a día. Cuando la línea verde no alcanza a las barras, el trabajo se acumula y se ve al instante."
          >
            <ChartPart />
          </Row>

          <div className="grid gap-14 sm:gap-8 md:grid-cols-2">
            <Half
              id="period"
              tag="Inicio · periodo"
              title="Cambia el periodo, cambia todo."
              text="Quince días, un mes, un trimestre, el año. Los totales y el gráfico se rehacen sobre la marcha."
            >
              <PeriodPart />
            </Half>
            <Half
              id="criticals"
              tag="Inicio · críticos"
              title="Lo que no puede esperar."
              text="Diez eventos de criticidad 1 abiertos, por antigüedad. El P611 lleva tres días."
            >
              <CriticalsPart />
            </Half>
          </div>

          <Row
            id="columns"
            tag="Generador · columnas"
            title="El informe lo arma el cliente."
            text="Se eligen los campos del catálogo — del evento, del poste, de la ciudad — y se montan las columnas. Sin pedírselo a nadie."
          >
            <ColumnsPart />
          </Row>

          <Row
            id="export"
            tag="Generador · resultado"
            title="Y sale en Excel."
            text="Con la condición «criticidad igual a catastrófico» vuelven esos mismos diez, y se descargan en el formato que cada operadora pide."
          >
            <ExportPart />
          </Row>
        </div>
      </div>
    </section>
  );
}
