// Writing a CSV cell that a spreadsheet will not execute.
//
// The two report screens still build their files in the browser — the pole,
// incident and user lists stopped, and ask the server now — and both carried
// the same eight-line escaper, copied. It quoted commas, quotation marks and
// newlines, and defended against nothing: every value in those files is text
// somebody typed into a form in the ERP, and a cell beginning with `=` is a
// formula that runs on the machine of whoever opens the file, which is usually
// not the person who typed it and is often the client.
//
// The server has its own version of this in `api/src/exports/tabla.ts`, and the
// two differ in one deliberate way. There the columns are typed, so the guard
// is applied to text columns and skipped for numeric ones. Here the rows are
// already `string[]` with the types thrown away, so the exemption has to be
// recognised from the value: anything that is *entirely* a number is left
// alone. That matters and is not a nicety — Bolivia is south and west, so every
// latitude and longitude in these reports begins with a minus sign, and
// defending them would turn every coordinate in the file into text.

/** The characters that make a spreadsheet read a cell as a formula. */
const PELIGROSO = /^[=+\-@\t\r]/;

/** A value that is nothing but a number, in either decimal notation. */
const SOLO_NUMERO = /^-?\d+(?:[.,]\d+)?$/;

/**
 * One CSV cell: quoted where it must be, and defused where it could run.
 *
 * The leading apostrophe is what tells a spreadsheet "what follows is text". It
 * is consumed when the file is opened and does not show — but only inside a
 * quoted field, which is why a defused cell is always quoted.
 *
 * The everyday case this fixes is not an attack: a telephone written
 * `+59170000000`, which is the only way to write a Bolivian number, arrives in
 * Excel as a formula and displays as `#¡NOMBRE?`.
 */
export const celdaCsv = (valor: string): string => {
  const seguro = PELIGROSO.test(valor) && !SOLO_NUMERO.test(valor) ? `'${valor}` : valor;
  return /["\n\r,;]/.test(seguro) || seguro !== valor
    ? `"${seguro.replace(/"/g, '""')}"`
    : seguro;
};
