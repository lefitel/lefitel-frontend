/** What the input of a `CampoDialogo` with this `id` and `error` must carry. */
export const ariaCampo = (id: string, error?: string | null) => ({
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${id}-error` : undefined,
});
