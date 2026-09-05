// A short explanation, folded away next to the heading it belongs to.
//
// The configuration panels used to carry their explanations as a line of text
// under the title. Four of those, in a band that is now above the table, is
// four lines of height taken from the report — permanently, and read once.
//
// This is not the same thing as the help that stays on screen. The grouping
// rule appears in the column panel *while a report is grouping*, because it
// explains something happening right then and hiding it would put it back where
// it was: inside a refusal, after the fact. What goes in here is what somebody
// reads once and then knows.

import { InfoIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";

interface Props {
  /** Names the control this explains, for anyone listening rather than looking. */
  label: string;
  children: React.ReactNode;
}

const CardHelp = ({ label, children }: Props) => (
  <Popover>
    <PopoverTrigger asChild>
      <button
        type="button"
        aria-label={`Qué es ${label}`}
        className="shrink-0 text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        <InfoIcon className="h-3.5 w-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-72 text-xs leading-relaxed text-muted-foreground">
      {children}
    </PopoverContent>
  </Popover>
);

export default CardHelp;
