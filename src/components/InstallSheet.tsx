import { ShareIcon, PlusSquareIcon, CheckIcon, MoreVerticalIcon, MonitorDownIcon } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import type { InstallPlatform } from "../hooks/useInstallPrompt";

interface Step {
  icon: typeof ShareIcon;
  text: string;
}

/**
 * How to install by hand, per platform, in the platform's own words.
 *
 * These are shown whenever there is no install prompt to fire — which is most
 * of the time: Safari has none at all, and Chrome withholds its own until it
 * has seen enough interaction. Naming the menus exactly as the system names
 * them matters more than being brief; the reader is looking at the screen and
 * matching words.
 */
const STEPS: Record<InstallPlatform, { title: string; blurb: string; steps: Step[]; note?: string }> = {
  ios: {
    title: "Instalar en el iPhone",
    blurb: "Safari no tiene botón de instalar, así que hay que hacerlo a mano. Es una vez.",
    steps: [
      { icon: ShareIcon, text: "Toca el botón Compartir, en la barra de abajo de Safari." },
      { icon: PlusSquareIcon, text: "Baja por la lista y elige «Añadir a pantalla de inicio»." },
      { icon: CheckIcon, text: "Confirma con «Añadir». El icono aparece junto al resto de tus apps." },
    ],
    note: "Si abriste esta página desde otra aplicación (WhatsApp, el correo), ábrela primero en Safari: desde ahí no aparece la opción.",
  },
  android: {
    title: "Instalar en Android",
    blurb: "Si el navegador no te lo ha ofrecido todavía, se puede hacer desde su menú.",
    steps: [
      { icon: MoreVerticalIcon, text: "Toca los tres puntos, arriba a la derecha del navegador." },
      { icon: PlusSquareIcon, text: "Elige «Instalar aplicación» o «Añadir a pantalla de inicio», según la versión." },
      { icon: CheckIcon, text: "Confirma. El icono queda junto al resto de tus apps." },
    ],
    note: "Chrome suele ofrecerlo solo al cabo de un rato de uso. Desde el menú funciona siempre.",
  },
  desktop: {
    title: "Instalar en el ordenador",
    blurb: "Queda como una ventana propia, sin pestañas ni barra de direcciones.",
    steps: [
      { icon: MonitorDownIcon, text: "Busca el icono de instalar al final de la barra de direcciones." },
      { icon: MoreVerticalIcon, text: "Si no está, abre el menú del navegador y busca «Instalar Osefi»." },
      { icon: CheckIcon, text: "Confirma con «Instalar»." },
    ],
    note: "Funciona en Chrome y Edge. Firefox no instala aplicaciones en el escritorio.",
  },
};

interface Props {
  platform: InstallPlatform;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstallSheet({ platform, open, onOpenChange }: Props) {
  const guide = STEPS[platform];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{guide.title}</DialogTitle>
          <DialogDescription>{guide.blurb}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <ol className="space-y-5">
          {guide.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                <step.icon className="h-4 w-4 text-muted-foreground" />
              </span>
              <span className="pt-1.5 text-sm leading-relaxed">
                <span className="mr-1.5 font-semibold tabular-nums">{i + 1}.</span>
                {step.text}
              </span>
            </li>
          ))}
          </ol>
        </DialogBody>

        {guide.note && (
          <p className="border-t border-border/40 px-6 py-4 text-xs text-muted-foreground">
            {guide.note}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
