// Six reports somebody can press instead of building one.
//
// They live in the "Plantillas" tab of the configuration panel, and only there.
// They were also listed in the empty results panel for a while, which put the
// same templates on screen twice and read as the page repeating itself rather than as
// two ways in.
//
// Built as a divided list rather than a grid of cards on purpose: the tab
// beside this one is already a list of reports you can open, and these are
// reports you can open. Two vocabularies for the same act would be one more
// thing to learn on the screen that has the most to learn already.

import { ArrowRightIcon } from "lucide-react";
import type { CatalogRoot, ReportTemplate } from "../../../api/generador.api";

interface Props {
  templates: ReportTemplate[];
  roots: CatalogRoot[];
  onPick: (template: ReportTemplate) => void;
}

const TemplateGallery = ({ templates, roots, onPick }: Props) => (
  <div className="space-y-2">
    <p className="text-xs text-muted-foreground">
      Se abren armadas y listas para generar. Puede cambiarles lo que quiera: son un punto de
      partida, no algo cerrado.
    </p>

    <ul className="divide-y rounded-md border">
      {templates.map((template) => {
        // What one row of that report means, taken from the catalog rather than
        // written again here. It is also the quietest way to teach the level of
        // detail: a handful of examples, and the ones that count things say so.
        const meaning = roots.find((r) => r.key === template.config.root)?.rowMeaning;

        return (
          <li key={template.key}>
            <button
              type="button"
              onClick={() => onPick(template)}
              className="group flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{template.name}</span>
                {/*
                  The description is the whole point of the row: a list of names on
                  their own is a list of guesses, and this is what somebody chooses
                  between them by. It was dropped for a while when this list sat
                  stacked under the saved reports, where three lines times the number of
                  templates was a wall — inside a tab it replaces that list instead of
                  adding to it, so the height is no longer borrowed from anyone.
                */}
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
  </div>
);

export default TemplateGallery;
