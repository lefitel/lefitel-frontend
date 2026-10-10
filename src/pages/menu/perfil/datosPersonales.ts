import type { UsuarioInterface } from "../../../interfaces/interfaces";

export interface DatosPersonales {
  name: string;
  lastname: string;
  phone: string;
  /** `YYYY-MM-DD`, the shape `editUsuario` and the date picker both work in. */
  birthday: string;
}

/**
 * The four personal fields of a loaded record, in the shape this card and its
 * dialog work in. `birthday` arrives from the API as a string, so the first
 * ten characters are the date; a `Date` never reaches here.
 */
export function datosPersonalesDe(u: UsuarioInterface): DatosPersonales {
  return {
    name: u.name || "",
    lastname: u.lastname || "",
    phone: u.phone || "",
    birthday: u.birthday ? String(u.birthday).slice(0, 10) : "",
  };
}
