// Six reports somebody can press instead of building one.
//
// It stands where the empty state used to: a sentence telling the reader to go
// choose columns, in the widest and emptiest part of a screen that offers 52
// fields across 12 groups. That instruction is fine for whoever already knows
// the shape of the data and useless for everybody else — and role 3 is called
// "Cliente", holds the permissions for this screen, and is exactly everybody
// else. Nobody from outside assembles a report out of 52 fields.
//
// Built as a divided list rather than a grid of cards on purpose: the saved
// report panel on the left is already a list of reports you can open, and these
// are reports you can open. Two vocabularies for the same act would be one more
// thing to learn on the screen that has the most to learn already.

import { ArrowRightIcon } from "lucide-react";
import type { CatalogRoot, ReportTemplate } from "../../../api/generador.api";

interface Props {
  templates: ReportTemplate[];
  roots: CatalogRoot[];
  onPick: (template: ReportTemplate) => void;
}

const TemplateGallery = ({ templates, roots, onPick }: Props) => (
  <div className="space-y-3">
    <div>
      <p className="text-sm font-medium text-foreground">Empiece por uno de estos</p>
      <p className="text-sm text-muted-foreground">
        Se abren armados y listos para generar. Puede cambiarles lo que quiera: son un punto de
        partida, no algo cerrado.
      </p>
    </div>

    <ul className="divide-y rounded-md border">
      {templates.map((template) => {
        // What one row of that report means, taken from the catalog rather than
        // written again here. It is also the quietest way to teach the level of
        // detail: six examples, and the ones that count things say so.
        const meaning = roots.find((r) => r.key === template.config.root)?.rowMeaning;

        return (
          <li key={template.key}>
            <button
              type="button"
              onClick={() => onPick(template)}
              className="group flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{template.name}</span>
                <span className="block text-xs text-muted-foreground">{template.description}</span>
                {meaning && (
                  <span className="mt-0.5 block text-xs text-muted-foreground/80">{meaning}</span>
                )}
              </span>
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </li>
        );
      })}
    </ul>

    <p className="text-sm text-muted-foreground">
      O arme el suyo desde cero: elija las columnas en el panel de configuración y las irá viendo
      aquí.
    </p>
  </div>
);

export default TemplateGallery;
