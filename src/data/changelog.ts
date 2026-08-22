/**
 * What shipped, in the words of someone who has to read it in the app.
 *
 * User-facing copy, so it is written in Spanish and in plain language: no file
 * names, no endpoints, no jargon. Each line answers "what can I do now that I
 * could not do before", or "what stopped going wrong".
 *
 * Newest first. The top entry must match the version in package.json — see
 * changelog.test.ts, which fails the build if a release is tagged without a
 * note, or a note is written for a version that was never released.
 */

export type ChangeKind = "nuevo" | "mejora" | "arreglo";

export interface Change {
  kind: ChangeKind;
  text: string;
}

export interface Release {
  version: string;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  changes: Change[];
}

export const RELEASES: Release[] = [
  {
    version: "1.0.2",
    date: "2026-08-22",
    changes: [
      {
        kind: "nuevo",
        text: "Generador de reportes: se arma el reporte eligiendo los campos, los filtros y el orden de las columnas, y se descarga ya hecho.",
      },
      {
        kind: "nuevo",
        text: "Página pública de presentación, para enseñar el sistema sin dar acceso a nadie.",
      },
      {
        kind: "mejora",
        text: "El menú y las pantallas se dibujan desde los permisos del rol. Antes podían no coincidir: un módulo desaparecía del menú pero su dirección seguía abriéndose, y algún rol nuevo se quedaba dando vueltas entre redirecciones con la pantalla en blanco.",
      },
      {
        kind: "mejora",
        text: "La cabecera con la ruta de navegación ya no se va al hacer scroll: ahora el contenido se desplaza por dentro y la cabecera queda siempre a la vista.",
      },
      {
        kind: "mejora",
        text: "El contenido se desvanece al llegar al borde inferior en vez de cortarse en seco.",
      },
      {
        kind: "nuevo",
        text: "El sistema se puede instalar en el teléfono y queda con su propio icono, como una aplicación más. En Android lo ofrece el navegador; en iPhone hay instrucciones en el menú de usuario.",
      },
      {
        kind: "nuevo",
        text: "Esta misma página: cada versión con lo que trae, y el número de versión siempre visible en el menú de usuario.",
      },
      {
        kind: "nuevo",
        text: "Cuando se publica una versión nueva aparece un aviso para recargar, en lugar de seguir trabajando con la anterior sin saberlo.",
      },
      {
        kind: "mejora",
        text: "Un punto junto a «Novedades» avisa de que hay cambios que aún no has leído, y desaparece al abrir esta página.",
      },
      {
        kind: "arreglo",
        text: "Las etiquetas de criticidad se leían apagadas en modo oscuro; ahora tienen su propio tono para fondo oscuro.",
      },
      {
        kind: "mejora",
        text: "Al añadir la foto de un poste desde el móvil, el botón abre la cámara directamente. Antes había que pasar por un menú intermedio en cada foto.",
      },
      {
        kind: "mejora",
        text: "Las pantallas táctiles tienen botones propios para hacer la foto, elegirla de la galería o cambiarla. Antes la única indicación era «arrastra una imagen aquí», que en un teléfono no se puede hacer.",
      },
      {
        kind: "arreglo",
        text: "El generador avisa cuando el servidor deja algún campo fuera, en lugar de mostrar el reporte incompleto sin decir nada.",
      },
      {
        kind: "arreglo",
        text: "Las exportaciones salen con las fechas correctas y con colores que significan lo mismo en todas ellas.",
      },
      {
        kind: "arreglo",
        text: "Corregido el origen del identificador de sesión y las direcciones de las imágenes, que en algunos casos impedían ver las fotos.",
      },
    ],
  },
];

/** The version this build reports, injected from package.json at compile time. */
export const APP_VERSION = __APP_VERSION__;
